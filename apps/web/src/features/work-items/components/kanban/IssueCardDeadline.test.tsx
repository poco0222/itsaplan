import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { StateType } from '@/lib/api/endpoints/columns';
import type { IssueFieldValueEntry } from '@/lib/api/endpoints/issues';
import workItems from '../../../../../messages/en/workItems.json';
import { KanbanDeadlineContext } from '../../context/kanbanDeadlineContext';
import { IssueCardDeadline } from './IssueCardDeadline';

function card({
  dueDate = '2026-11-23',
  today = '2026-11-20',
  stateType = 'started',
  actual,
  actualDateFieldId = 2,
}: {
  dueDate?: string;
  today?: string;
  stateType?: StateType;
  actual?: IssueFieldValueEntry['value'];
  actualDateFieldId?: number | null;
} = {}) {
  const issue = {
    statusSince: '2026-12-01T00:00:00.000Z',
    fieldValues:
      actual === undefined ? [] : [{ fieldId: 2, value: actual, valueEnd: null, optionIds: [] }],
  };
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ workItems }} timeZone="UTC">
      <TooltipProvider>
        <KanbanDeadlineContext.Provider
          value={{ today, actualDateFieldId: actualDateFieldId ?? undefined }}
        >
          <IssueCardDeadline issue={issue} dueDate={dueDate} stateType={stateType} />
        </KanbanDeadlineContext.Provider>
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

describe('Kanban deadline badges', () => {
  it('uses exclusive calendar-day windows and changes at the day boundary', () => {
    for (const day of [20, 21, 22, 23, 24, 25, 26]) {
      const html = card({ dueDate: `2026-11-${day}` });
      assert.equal(html.includes('Due within 3 days'), day <= 23);
      assert.equal(html.includes('Due within 5 days'), day === 24 || day === 25);
    }
    assert.match(card({ dueDate: '2026-11-24', today: '2026-11-21' }), /Due within 3 days/);
    assert.match(card({ today: '2026-11-24' }), /bg-overdue/);
  });

  it('preserves overdue styling only for a valid past deadline on an open issue', () => {
    assert.match(card({ dueDate: '2026-11-19', stateType: 'unstarted' }), /bg-overdue/);
    for (const html of [
      card({ dueDate: '2026-10-40' }),
      card({ dueDate: '2026-11-19', stateType: 'canceled' }),
      card({ stateType: 'unstarted' }),
    ]) {
      assert.doesNotMatch(html, /Due within|bg-overdue/);
    }
  });

  it('shows the selected actual date beside the deadline only when completed late', () => {
    const dueDate = '2026-10-08';
    const completed = { dueDate, stateType: 'completed' as const };
    const html = card({ ...completed, actual: '2026-10-15' });
    assert.match(html, /Oct 8/);
    assert.match(html, /Completed late · Actual Oct 15/);
    assert.doesNotMatch(html, /Dec 1|bg-overdue/);
    for (const actual of [undefined, '', '2026-10-08', '2026-10-07', '2026-10-40', 1]) {
      assert.doesNotMatch(card({ ...completed, actual }), /Completed late/);
    }
    assert.doesNotMatch(
      card({ ...completed, actual: '2026-10-15', actualDateFieldId: null }),
      /Completed late/,
    );
    assert.doesNotMatch(
      card({ ...completed, actual: '2026-10-15', stateType: 'canceled' }),
      /Completed late/,
    );
  });
});
