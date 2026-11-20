import assert from 'node:assert/strict';
import { it } from 'node:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Maps } from '@/utils/project';
import common from '../../../../../messages/en/common.json';
import issueMessages from '../../../../../messages/en/issue.json';
import workItems from '../../../../../messages/en/workItems.json';
import { SubtasksProvider } from '../../context/useSubtasks';
import { orderedColumns } from '../../utils/table';
import { TableIssueCells } from './TableIssueCells';
import { TableRowSubtasks } from './TableRowSubtasks';

const issue = (
  id: number,
  parentId: number | null,
  title: string,
  fieldValues: Issue['fieldValues'] = [],
) =>
  ({
    id,
    parentId,
    title,
    columnId: 1,
    sequenceNumber: id,
    identifier: `ROLL-${id}`,
    fieldValues,
  }) as Issue;
const project = {
  project: { ref: 'test.ROLL', timeEstimateEnabled: true },
  columns: [],
  issueTypes: [],
} as unknown as ProjectDetail;
const messages = { common, issue: issueMessages, workItems };
const progressField: CustomField = {
  id: 5,
  name: 'Progress',
  fieldType: 'number',
  issueTypeId: null,
  memberScope: null,
  showInBody: false,
  position: 0,
  options: [],
};

it('renders subtask values in the selected column order', () => {
  const subtask: Issue = {
    id: 2,
    projectId: 1,
    parentId: 1,
    sequenceNumber: 2,
    identifier: 'ROLL-2',
    title: 'Verify interface',
    columnId: 1,
    cycle: { id: 3, name: 'Week 48', status: 'upcoming' },
    typeId: 4,
    estimateMinutes: 90,
    dueDate: '2099-11-26',
    initiative: null,
    assigneeUserId: null,
    delegateUserId: null,
    description: '',
    priority: null,
    estimatePoints: null,
    loggedMinutes: 0,
    startDate: null,
    position: 0,
    createdAt: '2099-11-20T00:00:00Z',
    updatedAt: '2099-11-20T00:00:00Z',
    statusSince: '2099-11-20T00:00:00Z',
    archivedAt: null,
    shareToken: null,
    shareExtended: false,
    shareExpiresAt: null,
    labelIds: [],
    fieldValues: [{ fieldId: 5, value: 75, valueEnd: null, optionIds: [] }],
  };
  const unscheduled: Issue = {
    ...subtask,
    id: 3,
    sequenceNumber: 3,
    identifier: 'ROLL-3',
    title: 'Review handoff',
    cycle: null,
    typeId: null,
    estimateMinutes: null,
    dueDate: null,
    fieldValues: [],
  };
  const nested: Issue = {
    ...subtask,
    ...issue(4, 2, 'Record findings', subtask.fieldValues),
  };
  const maps: Maps = {
    typeById: new Map([
      [
        4,
        {
          id: 4,
          projectId: 1,
          name: 'Task',
          icon: '',
          color: '#000',
          isDefault: true,
          position: 0,
        },
      ],
    ]),
    labelById: new Map(),
    assigneeById: new Map(),
    columnById: new Map([
      [
        1,
        {
          id: 1,
          projectId: 1,
          name: 'In progress',
          stateType: 'started',
          color: '#00f',
          position: 0,
          wipLimit: null,
          wipMode: 'soft',
          autoAssignUserId: null,
        },
      ],
    ]),
  };
  const columns = orderedColumns(
    ['cycle', 'type', 'estimateTime', 'status', 'dueDate', 'cf:5'],
    [progressField],
  );
  const client = new QueryClient();
  const render = (readOnly: boolean, deliveryById?: Map<number, DeliveryItem>) =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          <SubtasksProvider issues={[subtask, unscheduled, nested]} enabled>
            <TableRowSubtasks
              project={project}
              readOnly={readOnly}
              issueId={1}
              deliveryById={deliveryById}
              maps={maps}
              orderedColumns={columns}
              showId
              alignTop={false}
              onOpenIssue={() => {}}
            />
          </SubtasksProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  const dom = new JSDOM(render(true));
  try {
    const titles = [...dom.window.document.querySelectorAll('button:not([aria-expanded])')];
    assert.deepEqual(
      titles.map((title) => title.textContent?.trim()),
      ['ROLL-2Verify interface', 'ROLL-4Record findings', 'ROLL-3Review handoff'],
    );
    assert.ok(titles[0].parentElement?.classList.contains('ps-6'));
    assert.ok(titles[1].parentElement?.classList.contains('ps-12'));
    const values = titles.map((title) =>
      Array.from(title.closest('.grid-cols-subgrid')?.children ?? [])
        .slice(1)
        .map((cell) => cell.textContent),
    );
    assert.deepEqual(values, [
      ['Week 48', 'Task', '1h 30m', 'In progress', 'Nov 26', '75'],
      ['Week 48', 'Task', '1h 30m', 'In progress', 'Nov 26', '75'],
      ['—', '—', '—', 'In progress', '—', '—'],
    ]);

    dom.window.document.body.innerHTML = render(false);
    const editButtons = [...dom.window.document.querySelectorAll('.ps-12')]
      .find((title) => title.textContent?.includes('Record findings'))
      ?.parentElement?.querySelectorAll(':scope > div.contents button');
    assert.deepEqual(
      [...(editButtons ?? [])].map((button) => button.textContent),
      ['Week 48', 'Task', '1h 30m', 'In progress', 'Nov 26', '75'],
    );

    const completed: DeliveryItem = {
      id: 4,
      moduleId: 1,
      childTypeId: null,
      role: 'task',
      phase: 'delivery',
      progress: 100,
      progressFieldId: 5,
      progressReadOnly: true,
      problem: null,
      canConfirm: false,
      completed: true,
      completedAt: null,
    };
    const managed: DeliveryItem = {
      ...completed,
      id: 2,
      role: 'node',
      progress: null,
      problem: 'weights',
      completed: false,
    };
    const direct: DeliveryItem = {
      ...managed,
      id: 3,
      progressReadOnly: false,
      problem: 'progress',
    };
    dom.window.document.body.innerHTML = render(
      false,
      new Map([managed, direct, completed].map((item) => [item.id, item])),
    );
    const cell = (title: string) =>
      [...dom.window.document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes(title))
        ?.closest('.grid-cols-subgrid')?.lastElementChild;
    assert.equal(cell('Record findings')?.textContent, '100%');
    assert.equal(cell('Record findings')?.querySelector('button'), null);
    assert.match(cell('Verify interface')?.textContent ?? '', /100%/);
    assert.equal(cell('Verify interface')?.querySelector('button'), null);
    assert.equal(cell('Review handoff')?.querySelector('button')?.textContent, '—');
  } finally {
    client.clear();
    dom.window.close();
  }
});

it('folds branches and edits time and numbers without activating the parent row', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const globals = [
    'window',
    'document',
    'navigator',
    'Node',
    'Element',
    'HTMLElement',
    'IS_REACT_ACT_ENVIRONMENT',
    'fetch',
  ] as const;
  const originals = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  const requests: { path: string; method?: string; body: unknown }[] = [];
  const fetchIssue = async (input: string | URL, init?: RequestInit) => {
    requests.push({
      path: new URL(String(input)).pathname,
      method: init?.method,
      body: JSON.parse(String(init?.body)),
    });
    return Response.json({});
  };
  for (const name of globals) {
    let value: unknown;
    if (name === 'IS_REACT_ACT_ENVIRONMENT') value = true;
    else if (name === 'fetch') value = fetchIssue;
    else value = dom.window[name];
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value,
    });
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.querySelector('#root')!);
  const client = new QueryClient();
  const topLevel = issue(1, null, 'Parent');
  const issues = [
    issue(2, 1, 'Verify interface', [{ fieldId: 5, value: 75, valueEnd: null, optionIds: [] }]),
    issue(3, 1, 'Review handoff'),
    issue(4, 2, 'Record findings'),
    issue(5, 3, 'Send summary'),
  ];
  const maps: Maps = {
    typeById: new Map(),
    labelById: new Map(),
    assigneeById: new Map(),
    columnById: new Map(),
  };
  const opened: number[] = [];
  const parentEvents: string[] = [];
  const numericColumns = orderedColumns(
    ['cf:5', 'cf:6'],
    [progressField, { ...progressField, id: 6, name: 'Weight' }],
  );
  const render = (collapsed: boolean, enabled = true) =>
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
            <div
              onClick={() => parentEvents.push('click')}
              onPointerDown={() => parentEvents.push('pointerdown')}
              onKeyDown={(event) => {
                event.preventDefault();
                parentEvents.push('keydown');
              }}
            >
              <div id="parent-cells">
                <TableIssueCells
                  project={project}
                  readOnly={false}
                  issue={topLevel}
                  maps={maps}
                  orderedColumns={numericColumns}
                />
              </div>
              <SubtasksProvider issues={issues} enabled={enabled} collapsed={collapsed}>
                <TableRowSubtasks
                  project={project}
                  readOnly={false}
                  issueId={1}
                  maps={maps}
                  orderedColumns={[...orderedColumns(['estimateTime'], []), ...numericColumns]}
                  showId={false}
                  alignTop={false}
                  onOpenIssue={(id) => opened.push(id)}
                />
              </SubtasksProvider>
            </div>
          </NextIntlClientProvider>
        </QueryClientProvider>,
      ),
    );
  const button = (title: string) =>
    [...document.querySelectorAll('button')].find((element) => element.textContent === title);
  const editCells = (title: string) =>
    button(title)
      ?.closest('.grid-cols-subgrid')
      ?.querySelectorAll<HTMLButtonElement>('div.contents button');
  const typeValue = (input: HTMLInputElement, value: string) => {
    act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        value,
      );
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  const press = (input: HTMLInputElement, key: string) => {
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }));
  };
  const editNumber = (trigger: HTMLButtonElement, value: string) => {
    const cell = trigger.parentElement;
    act(() => {
      trigger.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
      trigger.click();
    });
    const input = cell?.querySelector('input[type="number"]');
    assert.ok(input instanceof dom.window.HTMLInputElement);
    assert.equal(document.activeElement, input);
    assert.equal(input.value, value);
    return input;
  };

  try {
    render(true);
    assert.equal(button('Record findings'), undefined);
    const toggle =
      button('Verify interface')?.parentElement?.querySelector('button[aria-expanded]');
    assert.ok(toggle instanceof dom.window.HTMLButtonElement);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    act(() => {
      toggle.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
      for (const key of ['Enter', ' ']) {
        const event = new dom.window.KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        assert.equal(toggle.dispatchEvent(event), true);
      }
      toggle.click();
    });
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.ok(button('Record findings'));
    assert.equal(button('Send summary'), undefined);
    assert.deepEqual(opened, []);
    act(() => {
      button('Verify interface')!.click();
      button('Record findings')!.click();
    });
    assert.deepEqual(opened, [2, 4]);
    assert.deepEqual(parentEvents, []);

    const estimate = editCells('Record findings')?.[0];
    assert.ok(estimate);
    act(() => estimate.click());
    const input = document.querySelector('input');
    assert.ok(input);
    typeValue(input, '90m');
    await act(async () => input.blur());
    assert.deepEqual(requests, [
      { path: '/issues/4', method: 'PATCH', body: { estimateMinutes: 90 } },
    ]);

    const parentNumber = editNumber(document.querySelector('#parent-cells button')!, '');
    typeValue(parentNumber, '12');
    act(() => parentNumber.blur());
    let progress = editNumber(editCells('Verify interface')![1], '75');
    typeValue(progress, '20');
    act(() => press(progress, 'Escape'));
    assert.equal(editCells('Verify interface')![1].textContent, '75');
    assert.equal(requests.length, 1);

    const weight = editNumber(editCells('Record findings')![2], '');
    typeValue(weight, '32.5');
    await act(async () => press(weight, 'Enter'));
    progress = editNumber(editCells('Verify interface')![1], '75');
    typeValue(progress, '');
    const save = progress.parentElement?.querySelector('button');
    assert.ok(save);
    await act(async () => save.click());
    assert.deepEqual(requests.slice(1), [
      { path: '/issues/4/fields/6', method: 'PUT', body: { value: 32.5 } },
      { path: '/issues/2/fields/5', method: 'PUT', body: { value: null } },
    ]);
    assert.deepEqual(parentEvents, []);

    render(false);
    assert.ok(button('Send summary'));
    act(() => toggle.click());
    assert.equal(button('Record findings'), undefined);
    assert.ok(button('Send summary'));
    render(true);
    assert.equal(button('Send summary'), undefined);
    render(false);
    assert.ok(button('Record findings'));
    render(false, false);
    assert.equal(button('Verify interface'), undefined);
  } finally {
    act(() => root.unmount());
    client.clear();
    dom.window.close();
    globals.forEach((name, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
});
