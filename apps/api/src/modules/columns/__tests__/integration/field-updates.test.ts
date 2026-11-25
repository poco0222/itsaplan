import { beforeEach, expect, test } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

beforeEach(resetDb);

async function setup() {
  const api = authedApi((await signUpTestUser()).cookie);
  await createProject(api, { key: 'ROLL', name: 'Rolling Plan' });
  const project = api.projects({ projectKey: 'ROLL' });
  const { columns } = (await project.get()).data!;
  const open = columns.find(({ stateType }) => stateType === 'started')!.id;
  const done = columns.find(({ stateType }) => stateType === 'completed')!.id;
  const progress = (await project['custom-fields'].post({ name: 'Progress', fieldType: 'number' }))
    .data!.id;
  const date = (await project['custom-fields'].post({ name: 'Actual date', fieldType: 'date' }))
    .data!.id;
  const rules = [
    { type: 'number' as const, fieldId: progress, value: 100 },
    { type: 'date' as const, fieldId: date, timeZone: 'Asia/Taipei' },
  ];
  const configure = (fieldUpdates = rules) =>
    project.columns({ columnId: done }).patch({ fieldUpdates });
  const add = async (columnId = open) => {
    const { data } = await project.issues.post({ title: 'Work item', columnId });
    return data!.id;
  };
  return { api, project, open, done, progress, date, rules, configure, add };
}

test('saves status field rules with project, type and permission checks', async () => {
  const { api, project, done, date, progress, rules, configure } = await setup();
  expect((await configure()).status).toBe(200);
  expect((await project.get()).data?.columns.find(({ id }) => id === done)?.fieldUpdates).toEqual(
    rules,
  );
  expect((await configure([{ type: 'number', fieldId: date, value: 100 }])).status).toBe(400);
  expect(
    (await configure([{ type: 'date', fieldId: date, timeZone: 'Mars/Olympus' }])).status,
  ).toBe(400);
  expect((await configure([rules[0], rules[0]])).status).toBe(400);
  await createProject(api, { key: 'OTHER', name: 'Other project' });
  const foreign = (
    await api.projects({ projectKey: 'OTHER' })['custom-fields'].post({
      name: 'Number',
      fieldType: 'number',
    })
  ).data!.id;
  expect((await configure([{ type: 'number', fieldId: foreign, value: 100 }])).status).toBe(400);
  const outsider = authedApi((await signUpTestUser()).cookie);
  expect(
    (
      await outsider
        .projects({ projectKey: 'ROLL' })
        .columns({ columnId: done })
        .patch({
          fieldUpdates: [{ type: 'number', fieldId: progress, value: 99 }],
        })
    ).status,
  ).toBe(403);
  expect((await configure([])).data?.fieldUpdates).toEqual([]);
});

test('writes on entry and restores on reopening through single and bulk status changes', async () => {
  const { api, project, open, done, progress, date, configure, add } = await setup();
  const historical = api.issues({ issueId: await add(done) });
  const blankId = await add();
  const itemId = await add();
  const blank = api.issues({ issueId: blankId });
  const item = api.issues({ issueId: itemId });
  const weight = (await project['custom-fields'].post({ name: 'Weight', fieldType: 'number' }))
    .data!.id;
  const value = async (issue: typeof item, fieldId: number) =>
    (await issue.get()).data?.fields.find((field) => field.fieldId === fieldId)?.value;
  await item.fields({ fieldId: progress }).put({ value: 60 });
  await item.fields({ fieldId: weight }).put({ value: 40 });
  expect((await configure()).status).toBe(200);
  expect(await value(historical, date)).toBeNull();
  expect((await historical.patch({ columnId: done })).status).toBe(200);
  expect(await value(historical, progress)).toBeNull();
  expect(
    (await project.issues.bulk.patch({ ids: [itemId, blankId], patch: { columnId: done } })).status,
  ).toBe(200);
  const today = new Date(
    `${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format()}T00:00:00Z`,
  );
  expect(await value(item, progress)).toBe(100);
  expect<unknown>(await value(item, date)).toEqual(today);
  expect(await value(item, weight)).toBe(40);
  expect(await value(blank, progress)).toBe(100);
  const anotherDone = (
    await project.columns.post({
      name: 'Accepted',
      stateType: 'completed',
      fieldUpdates: [{ type: 'number', fieldId: progress, value: 90 }],
    })
  ).data!.id;
  expect((await item.patch({ columnId: anotherDone })).status).toBe(200);
  expect(await value(item, progress)).toBe(90);
  expect((await item.patch({ columnId: open })).status).toBe(200);
  expect((await blank.patch({ columnId: open })).status).toBe(200);
  expect(await value(item, progress)).toBe(60);
  expect(await value(item, date)).toBeNull();
  expect(await value(blank, progress)).toBeNull();
  expect(await value(blank, date)).toBeNull();
  expect((await item.fields({ fieldId: date }).put({ value: '2000-01-01' })).status).toBe(200);
  const closed = await item.patch({ columnId: done });
  expect(closed.status).toBe(200);
  expect(await value(item, progress)).toBe(100);
  expect<unknown>(await value(item, date)).toEqual(today);
});
