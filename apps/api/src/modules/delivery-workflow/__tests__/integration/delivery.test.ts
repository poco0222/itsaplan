import { beforeEach, expect, test } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';

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

test('enrolls existing issues and applies the hierarchy with exact weighted progress', async () => {
  const {
    scope,
    settings: s,
    add,
    get,
    set,
    item,
    enable,
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
  expect((await project['delivery-workflow'].get()).data).toEqual([]);
  expect((await scope.put({ ...s, taskTypeId: s.nodeTypeId })).status).toBe(400);
  await enable();
  expect(
    (await project.issues.post({ title: 'Orphan', columnId: started, typeId: s.taskTypeId }))
      .status,
  ).toBe(409);
  expect((await item(node).patch({ columnId: done })).status).toBe(409);
  expect((await item(open).fields({ fieldId: weight }).put({ value: 101 })).status).toBe(400);
  await set(node, weight, 100);
  await set(completed, weight, 30);
  await set(open, weight, 50);
  expect(await get(node)).toMatchObject({ progress: null, problem: 'weights' });
  expect(await get(module)).toMatchObject({ progress: null, problem: 'child' });
  await set(open, weight, 70);
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
  expect(await get(direct)).toMatchObject({ childTypeId: s.taskTypeId });
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
