import { beforeEach, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';
import { migrateDeliveryPlans } from '../../../../../../../scripts/migrate-delivery-plans';

beforeEach(resetDb);

async function setup() {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  expect((await createProject(api, { key: 'DEL', name: 'Delivery fixtures' })).status).toBe(201);
  const project = api.projects({ projectKey: 'DEL' });
  const view = (await project.get()).data!;
  const type = async (name: string) => (await project['issue-types'].post({ name })).data!.id;
  const field = async (name: string) =>
    (await project['custom-fields'].post({ name, fieldType: 'number' })).data!.id;
  const weight = await field('Weight');
  const progress = await field('Reported progress');
  const settings = {
    moduleTypeId: await type('Module'),
    nodeTypeId: await type('Node'),
    taskTypeId: await type('Execution'),
    maintenanceTypeId: await type('Maintenance'),
    nodeWeightId: weight,
    taskWeightId: weight,
    nodeProgressId: progress,
    taskProgressId: progress,
  };
  const column = (stateType: string) =>
    view.columns.find((item) => item.stateType === stateType)!.id;
  const started = column('started');
  const done = column('completed');
  const canceled = column('canceled');
  const add = async (title: string, typeId: number, parentId?: number, columnId = started) => {
    const response = await project.issues.post({
      title,
      typeId,
      parentId,
      columnId,
      dueDate: '2020-12-10',
    });
    expect(response.status).toBe(201);
    return response.data!.id;
  };
  const item = (issueId: number) => api.issues({ issueId });
  const delivery = (issueId: number) => project['delivery-workflow']({ issueId });
  const get = async (issueId: number) => (await delivery(issueId).get()).data!.item!;
  const set = async (id: number, fieldId: number, value: number) => {
    expect((await item(id).fields({ fieldId }).put({ value })).status).toBe(200);
  };
  const scope = project.settings['delivery-workflow'];
  const enable = async () => expect((await scope.put(settings)).status).toBe(200);
  return {
    user,
    api,
    project,
    projectRef: view.project.ref,
    settings,
    scope,
    started,
    done,
    canceled,
    weight,
    progress,
    add,
    item,
    delivery,
    get,
    set,
    enable,
  };
}

test('migrates existing work and rolls up native plans as delivery changes', async () => {
  const {
    api,
    project,
    projectRef,
    settings,
    add,
    set,
    item,
    enable,
    get,
    started,
    done,
    canceled,
  } = await setup();
  await enable();
  const modules = await Promise.all(
    Array.from({ length: 4 }, (_, i) => add(`Module ${i + 1}`, settings.moduleTypeId)),
  );
  const nodes = await Promise.all(
    Array.from({ length: 13 }, (_, i) =>
      add(
        `Node ${i + 1}`,
        settings.nodeTypeId,
        modules[i < 2 ? 0 : 1 + (i % 3)],
        i === 0 ? done : started,
      ),
    ),
  );
  const tasks = await Promise.all(
    Array.from({ length: 15 }, (_, i) =>
      add(
        `Task ${i + 1}`,
        settings.taskTypeId,
        nodes[i < 2 ? 1 : 2 + (i % 11)],
        i === 0 ? done : started,
      ),
    ),
  );
  await item(modules[0]).patch({ description: 'Original module description' });
  await set(nodes[0], settings.nodeWeightId, 30);
  await set(nodes[1], settings.nodeWeightId, 70);
  await set(tasks[0], settings.taskWeightId, 20);
  await set(tasks[1], settings.taskWeightId, 80);
  await set(tasks[1], settings.taskProgressId, 25);
  expect(await get(nodes[1])).toMatchObject({ progress: 40 });

  const db = new SQL(process.env.DATABASE_URL!);
  try {
    await db`
      INSERT INTO issue_attachment (issue_id, s3_key, filename, content_type, size_bytes)
      VALUES (${modules[0]}, 'test/module', 'original-module.txt', 'text/plain', 12),
             (${tasks[0]}, 'test/execution', 'execution-output.txt', 'text/plain', 12)
    `;
    const attachments = async () => [
      (await item(modules[0]).attachments.get()).data,
      (await item(tasks[0]).attachments.get()).data,
    ];
    const originalAttachments = await attachments();
    expect(originalAttachments.map((items) => items?.length)).toEqual([1, 1]);
    const snapshot = async () => {
      const rows = await db<
        {
          id: number;
          parent_id: number | null;
          type_id: number | null;
          column_id: number;
          initiative_id: number | null;
          archived_at: Date | null;
        }[]
      >`SELECT id, parent_id, type_id, column_id, initiative_id, archived_at FROM issue ORDER BY id`;
      const history = await db`SELECT * FROM issue_status ORDER BY id`;
      const fields = await db`SELECT * FROM issue_field_value ORDER BY issue_id, field_id`;
      return { rows, history, fields };
    };
    const before = await snapshot();
    expect(await migrateDeliveryPlans(db, projectRef, false)).toMatchObject({
      status: 'preview',
      nodes: 13,
      tasks: 15,
      conflicts: [],
    });
    expect(await snapshot()).toEqual(before);
    expect((await project.initiatives.get()).data?.total).toBe(0);
    const [source] = await db`SELECT sequence_number FROM issue WHERE id = ${modules[0]}`;
    expect(await migrateDeliveryPlans(db, projectRef, true)).toMatchObject({
      status: 'applied',
      nodes: 13,
      tasks: 15,
    });
    expect(await migrateDeliveryPlans(db, projectRef, true)).toMatchObject({
      status: 'already-applied',
    });
    const after = await snapshot();
    expect(await attachments()).toEqual(originalAttachments);
    expect(after.history).toEqual(before.history);
    expect(after.fields).toEqual(before.fields);
    expect(after.rows.map((row) => [row.id, row.column_id, row.type_id])).toEqual(
      before.rows.map((row) => [row.id, row.column_id, row.type_id]),
    );
    expect(
      after.rows
        .filter((row) => row.archived_at)
        .map((row) => row.id)
        .sort(),
    ).toEqual([...modules].sort());
    expect(
      after.rows.filter((row) => tasks.includes(row.id)).map((row) => [row.id, row.parent_id]),
    ).toEqual(
      before.rows.filter((row) => tasks.includes(row.id)).map((row) => [row.id, row.parent_id]),
    );

    const list = await project.initiatives.get();
    expect(list.status).toBe(200);
    expect(list.data?.total).toBe(4);
    const plan = list.data!.items.find((p) => p.title === 'Module 1')!;
    expect(plan).toMatchObject({
      status: 'active',
      description: 'Original module description',
      delivery: {
        nodeTypeId: settings.nodeTypeId,
        sourceNumber: source.sequence_number,
        progress: 58,
        problem: null,
      },
    });
    expect(new Date(plan.targetDate!).toISOString()).toStartWith('2020-12-10');
    const detail = api.initiatives({ initiativeId: plan.id });
    const planDelivery = async () => (await detail.get()).data!.delivery;
    expect((await planDelivery())?.progress).toBe(58);

    expect((await item(tasks[0]).get()).data).toMatchObject({
      parentId: nodes[1],
      initiative: { id: plan.id },
    });
    await set(tasks[1], settings.taskProgressId, 100);
    expect((await planDelivery())?.progress).toBe(100);
    expect(await get(nodes[1])).toMatchObject({ completed: false });
    expect((await item(tasks[1]).patch({ columnId: done })).status).toBe(200);
    expect(await get(nodes[1])).toMatchObject({ completed: true });
    expect((await detail.patch({ status: 'completed' })).data?.status).toBe('completed');
    expect((await item(tasks[1]).patch({ columnId: started })).status).toBe(200);
    expect(await get(nodes[1])).toMatchObject({ completed: false });
    await set(tasks[1], settings.taskProgressId, 0);
    expect((await planDelivery())?.progress).toBe(44);

    expect((await item(nodes[0]).patch({ columnId: canceled })).status).toBe(200);
    expect(await planDelivery()).toMatchObject({ progress: null, problem: 'weights' });
    await set(nodes[1], settings.nodeWeightId, 100);
    expect((await planDelivery())?.progress).toBe(20);
    await set(tasks[0], settings.taskWeightId, 10);
    expect(await planDelivery()).toMatchObject({ progress: null, problem: 'child' });

    const next = (await project.initiatives.post({ title: 'Next plan' })).data!;
    expect(next.delivery).toMatchObject({ progress: null, problem: 'children' });
    const newNode = await project.issues.post({
      title: 'New node',
      columnId: started,
      typeId: settings.nodeTypeId,
      initiativeId: plan.id,
    });
    expect(newNode.status).toBe(201);
    const newTask = await add('New task', settings.taskTypeId, newNode.data!.id);
    expect((await item(newTask).get()).data).toMatchObject({ initiative: { id: plan.id } });
    expect((await item(newNode.data!.id).patch({ initiativeId: next.id })).status).toBe(200);
    expect((await item(newTask).get()).data).toMatchObject({
      parentId: newNode.data!.id,
      initiative: { id: next.id },
    });
    expect((await api.initiatives({ initiativeId: next.id }).delete()).status).toBe(204);
    expect((await item(newTask).get()).data).toMatchObject({
      parentId: newNode.data!.id,
      initiative: null,
    });
  } finally {
    await db.close();
  }
});

test('rolls the migration back if applying fails after plans are inserted', async () => {
  const { project, projectRef, settings, add, enable } = await setup();
  await enable();
  const module = await add('Module to roll back', settings.moduleTypeId);
  const node = await add('Original node', settings.nodeTypeId, module);
  const task = await add('Original task', settings.taskTypeId, node);
  const db = new SQL(process.env.DATABASE_URL!);
  try {
    const rows = () => db`SELECT id, parent_id, initiative_id, archived_at FROM issue ORDER BY id`;
    const before = await rows();
    await db`ALTER TABLE issue_type ADD CONSTRAINT test_plan_migration_failure CHECK (name <> '节点')`;
    try {
      await expect(migrateDeliveryPlans(db, projectRef, true)).rejects.toThrow(
        'test_plan_migration_failure',
      );
      expect(await rows()).toEqual(before);
      expect((await project.initiatives.get()).data?.total).toBe(0);
    } finally {
      await db`ALTER TABLE issue_type DROP CONSTRAINT test_plan_migration_failure`;
    }
    expect(await migrateDeliveryPlans(db, projectRef, true)).toMatchObject({
      status: 'applied',
      nodes: 1,
      tasks: 1,
    });
    const [kept] = await db`SELECT parent_id FROM issue WHERE id = ${task}`;
    expect(kept.parent_id).toBe(node);
  } finally {
    await db.close();
  }
});

test('enrolls existing issues and applies the hierarchy with exact weighted progress', async () => {
  const {
    scope,
    settings: s,
    add,
    get,
    set,
    item,
    project,
    weight,
    progress,
    started,
    done,
  } = await setup();
  const module = await add('Module', s.moduleTypeId);
  const node = await add('Node', s.nodeTypeId, module);
  const completed = await add('Done', s.taskTypeId, node, done);
  const open = await add('Open', s.taskTypeId, node);
  const taskWeight = (
    await project['custom-fields'].post({ name: 'Task weight', fieldType: 'number' })
  ).data!.id;
  expect((await project['delivery-workflow'].get()).data).toEqual([]);
  expect((await scope.put({ ...s, taskTypeId: s.nodeTypeId })).status).toBe(400);
  expect((await scope.put({ ...s, taskWeightId: taskWeight })).status).toBe(200);
  expect(
    (await project.issues.post({ title: 'Orphan', columnId: started, typeId: s.taskTypeId }))
      .status,
  ).toBe(409);
  expect((await item(node).patch({ columnId: done })).status).toBe(409);
  expect((await item(open).fields({ fieldId: taskWeight }).put({ value: 101 })).status).toBe(400);
  await set(node, weight, 100);
  await set(completed, taskWeight, 30);
  await set(open, taskWeight, 50);
  expect(await get(node)).toMatchObject({
    progress: null,
    problem: 'weights',
    progressFieldId: progress,
    weightFieldId: weight,
    progressReadOnly: true,
  });
  expect(await get(module)).toMatchObject({
    progress: null,
    problem: 'child',
    progressFieldId: progress,
    weightFieldId: null,
    progressReadOnly: true,
  });
  expect(await get(completed)).toMatchObject({
    progress: 100,
    progressFieldId: progress,
    progressReadOnly: true,
  });
  expect(await get(open)).toMatchObject({
    progress: 0,
    progressFieldId: progress,
    weightFieldId: taskWeight,
    progressReadOnly: false,
  });
  await set(open, taskWeight, 70);
  expect((await get(node)).progress).toBe(30);
  await set(open, progress, 40);
  expect((await get(module)).progress).toBe(58);
  const direct = await add('Directly managed node', s.nodeTypeId, module);
  await set(node, weight, 55);
  await set(direct, weight, 45);
  await set(direct, progress, 50);
  expect((await get(module)).progress).toBeCloseTo(54.4);
  expect((await item(completed).get()).data?.dueDate).toBeDefined();
  const existing = await add('Work already tracked', s.moduleTypeId);
  await set(existing, progress, 21);
  expect(await get(direct)).toMatchObject({
    childTypeId: s.taskTypeId,
    progress: 50,
    progressReadOnly: false,
  });
  expect((await item(existing).patch({ parentId: direct, typeId: s.taskTypeId })).status).toBe(200);
  expect(await get(existing)).toMatchObject({ role: 'task', moduleId: module, progress: 21 });
});

test('recalculates completion and status after reopening and cancellation', async () => {
  const {
    settings: s,
    add,
    get,
    set,
    item,
    enable,
    weight,
    progress,
    started,
    done,
    canceled,
  } = await setup();
  await enable();
  const module = await add('Module', s.moduleTypeId);
  const node = await add('Node', s.nodeTypeId, module);
  const a = await add('First', s.taskTypeId, node);
  const b = await add('Canceled later', s.taskTypeId, node);
  await set(node, weight, 100);
  await set(a, weight, 80);
  await set(b, weight, 20);
  await set(a, progress, 50);
  expect((await item(a).patch({ columnId: done })).status).toBe(200);
  expect((await item(b).patch({ columnId: canceled })).status).toBe(200);
  expect((await get(node)).problem).toBe('weights');
  expect((await item(module).get()).data?.columnId).toBe(started);
  await set(a, weight, 100);
  expect((await item(node).get()).data?.columnId).toBe(done);
  expect((await item(module).get()).data?.columnId).toBe(done);
  expect((await item(b).get()).data?.columnId).toBe(canceled);
  expect((await item(a).patch({ columnId: started })).status).toBe(200);
  expect(await get(a)).toMatchObject({ progress: 50, progressReadOnly: false });
  expect((await item(node).get()).data?.columnId).toBe(started);
  expect((await item(module).get()).data?.columnId).toBe(started);
  expect(await get(module)).toMatchObject({ progress: 50, completedAt: null });
});

test('records one concurrent handoff, locks delivery and reverses with an audit record', async () => {
  const {
    api,
    project,
    settings: s,
    add,
    get,
    set,
    item,
    delivery,
    enable,
    weight,
    started,
    done,
  } = await setup();
  await enable();
  const module = await add('Module', s.moduleTypeId);
  const node = await add('Node', s.nodeTypeId, module);
  expect((await delivery(module).handoff.post()).status).toBe(409);
  await set(node, weight, 100);
  expect((await item(node).patch({ columnId: done })).status).toBe(200);
  const member = await signUpTestUser();
  const outsider = authedApi(member.cookie);
  expect(
    (
      await outsider
        .projects({ projectKey: 'DEL' })
        ['delivery-workflow']({ issueId: module })
        .handoff.post()
    ).status,
  ).toBe(403);
  const role = await createRole(api, 'DEL', {
    name: 'Workflow editor without work item editing',
    permissions: { workflow_config: { read: true, edit: true }, work_items: { read: true } },
  });
  const invite = (await project.invites.post({ email: member.email, role: 'member' })).data!;
  await outsider.invites({ token: invite.token }).accept.post();
  expect(
    (
      await project
        .members({ userId: member.userId })
        .patch({ role: 'member', roleId: role.data!.id })
    ).status,
  ).toBe(204);
  const memberDelivery = outsider
    .projects({ projectKey: 'DEL' })
    ['delivery-workflow']({ issueId: module });
  expect((await memberDelivery.get()).status).toBe(200);
  expect((await memberDelivery.handoff.post()).status).toBe(403);
  const endpoints = delivery(module);
  const attempts = await Promise.all([endpoints.handoff.post(), endpoints.handoff.post()]);
  expect(attempts.map(({ status }) => status)).toEqual([200, 200]);
  expect(attempts[0].data).toEqual(attempts[1].data);
  const handoffId = attempts[0].data!.id;
  const maintenance = await add('Operational follow-up', s.maintenanceTypeId, module);
  expect(await get(module)).toMatchObject({ progress: 100, phase: 'maintenance' });
  expect((await item(node).patch({ columnId: started })).status).toBe(409);
  expect((await item(node).fields({ fieldId: weight }).put({ value: 90 })).status).toBe(409);
  expect((await project.columns({ columnId: done }).patch({ stateType: 'started' })).status).toBe(
    409,
  );
  expect((await item(module).delete({ query: { subtasks: 'cascade' } })).status).toBe(409);
  expect((await item(maintenance).get()).status).toBe(200);
  expect(
    (
      await project.issues.post({
        title: 'Another node',
        columnId: started,
        typeId: s.nodeTypeId,
        parentId: module,
      })
    ).status,
  ).toBe(409);
  expect((await endpoints.reversal.post({ handoffId, reason: ' ' })).status).toBe(400);
  expect((await endpoints.reversal.post({ handoffId, reason: 'Wrong handoff' })).status).toBe(200);
  const detail = (await endpoints.get()).data!;
  expect(detail.item).toMatchObject({ phase: 'delivery', progress: 100 });
  expect(detail.history).toMatchObject([{ id: handoffId, reversalReason: 'Wrong handoff' }]);
  expect(detail.history[0].confirmedAt).toBeTruthy();
  expect(detail.history[0].reversedAt).toBeTruthy();
  expect((await item(maintenance).get()).data?.parent?.id).toBe(module);
  expect((await item(node).patch({ columnId: started })).status).toBe(200);
});

test('marks only the selected completion period as unknown', async () => {
  const { project, settings: s, add, get, item, enable, started, done } = await setup();
  await enable();
  const module = await add('Module', s.moduleTypeId);
  const node = await add('Node', s.nodeTypeId, module);
  const task = await add('Imported completed work', s.taskTypeId, node, done);
  expect((await get(task)).completedAt).toBeTruthy();
  const endpoint = project['delivery-workflow']['legacy-completions'];
  expect((await endpoint.post({ issueIds: [task, node] })).status).toBe(400);
  expect((await get(task)).completedAt).toBeTruthy();
  expect((await endpoint.post({ issueIds: [task] })).status).toBe(200);
  expect(await get(task)).toMatchObject({ progress: 100, completedAt: null });
  expect((await item(task).get()).data?.columnId).toBe(done);
  await item(task).patch({ columnId: started });
  await item(task).patch({ columnId: done });
  expect((await get(task)).completedAt).toBeTruthy();
  expect((await item(task).get()).data?.dueDate).toBeDefined();
});

test('serializes handoff against a simultaneous reopen', async () => {
  const {
    settings: s,
    add,
    get,
    item,
    delivery,
    set,
    enable,
    weight,
    started,
    done,
  } = await setup();
  await enable();
  const module = await add('Module', s.moduleTypeId);
  const node = await add('Node', s.nodeTypeId, module);
  const task = await add('Task', s.taskTypeId, node);
  await set(node, weight, 100);
  await set(task, weight, 100);
  await item(task).patch({ columnId: done });

  const [handoff, reopen] = await Promise.all([
    delivery(module).handoff.post(),
    item(task).patch({ columnId: started }),
  ]);
  if (handoff.status === 200) {
    expect(reopen.status).toBe(409);
    expect(await get(module)).toMatchObject({ phase: 'maintenance', progress: 100 });
  } else {
    expect(handoff.status).toBe(409);
    expect(reopen.status).toBe(200);
    expect(await get(module)).toMatchObject({ phase: 'delivery', progress: 0, completed: false });
  }
});
