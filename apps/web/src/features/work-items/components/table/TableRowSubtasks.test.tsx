import assert from 'node:assert/strict';
import { it } from 'node:test';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { Maps } from '@/utils/project';
import common from '../../../../../messages/en/common.json';
import workItems from '../../../../../messages/en/workItems.json';
import { SubtasksProvider } from '../../context/useSubtasks';
import { orderedColumns } from '../../utils/table';
import { TableRowSubtasks } from './TableRowSubtasks';

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
      <SubtasksProvider issues={[subtask, unscheduled]} enabled>
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
    const titles = [...dom.window.document.querySelectorAll('button')];
    const values = titles.map((title) =>
      Array.from(title.parentElement?.children ?? [])
        .slice(1)
        .map((cell) => cell.textContent),
    );
    assert.deepEqual(values, [
      ['Week 48', 'Task', '1h 30m', 'In progress', 'Nov 26', '75'],
      ['—', '—', '—', 'In progress', '—', '—'],
    ]);
  } finally {
    dom.window.close();
  }
});
