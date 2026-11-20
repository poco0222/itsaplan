import assert from 'node:assert/strict';
import { it } from 'node:test';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { Maps } from '@/utils/project';
import common from '../../../../../messages/en/common.json';
import workItems from '../../../../../messages/en/workItems.json';
import { SubtasksProvider } from '../../context/useSubtasks';
import { orderedColumns } from '../../utils/table';
import { TableRowSubtasks } from './TableRowSubtasks';

const issue = (id: number, parentId: number, title: string) =>
  ({ id, parentId, title, columnId: 1, sequenceNumber: id, identifier: `ROLL-${id}` }) as Issue;

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
  const nested: Issue = { ...subtask, ...issue(4, 2, 'Record findings') };
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
    [
      {
        id: 5,
        name: 'Progress',
        fieldType: 'number',
        issueTypeId: null,
        memberScope: null,
        showInBody: false,
        position: 0,
        options: [],
      },
    ],
  );
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ common, workItems }} timeZone="UTC">
      <SubtasksProvider issues={[subtask, unscheduled, nested]} enabled>
        <TableRowSubtasks
          issueId={1}
          maps={maps}
          orderedColumns={columns}
          showId
          alignTop={false}
          onOpenIssue={() => {}}
        />
      </SubtasksProvider>
    </NextIntlClientProvider>,
  );
  const dom = new JSDOM(html);
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
  } finally {
    dom.window.close();
  }
});

it('folds each nested branch and keeps its controls separate from the parent row', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const globals = [
    'window',
    'document',
    'navigator',
    'Node',
    'Element',
    'HTMLElement',
    'IS_REACT_ACT_ENVIRONMENT',
  ] as const;
  const originals = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  for (const name of globals) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[name],
    });
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.querySelector('#root')!);
  const issues = [
    issue(2, 1, 'Verify interface'),
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
  const render = (collapsed: boolean, enabled = true) =>
    act(() =>
      root.render(
        <NextIntlClientProvider locale="en" messages={{ workItems }} timeZone="UTC">
          <div
            onClick={() => parentEvents.push('click')}
            onPointerDown={() => parentEvents.push('pointerdown')}
            onKeyDown={(event) => {
              event.preventDefault();
              parentEvents.push('keydown');
            }}
          >
            <SubtasksProvider issues={issues} enabled={enabled} collapsed={collapsed}>
              <TableRowSubtasks
                issueId={1}
                maps={maps}
                orderedColumns={[]}
                showId={false}
                alignTop={false}
                onOpenIssue={(id) => opened.push(id)}
              />
            </SubtasksProvider>
          </div>
        </NextIntlClientProvider>,
      ),
    );
  const button = (title: string) =>
    [...document.querySelectorAll('button')].find((element) => element.textContent === title);

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
    dom.window.close();
    globals.forEach((name, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
});
