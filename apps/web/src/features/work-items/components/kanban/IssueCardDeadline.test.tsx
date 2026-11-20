import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { StateType } from '@/lib/api/endpoints/columns';
import type { IssueFieldValueEntry } from '@/lib/api/endpoints/issues';
import { getDisplayLocale, setDisplayLocale } from '@/utils/dates';
import { STATUS_META } from '@/utils/initiativeMeta';
import workItems from '../../../../../messages/en/workItems.json';
import workItemsZh from '../../../../../messages/zh-CN/workItems.json';
import { KanbanDeadlineContext } from '../../context/kanbanDeadlineContext';
import { IssueCardDeadline } from './IssueCardDeadline';

function card({
  dueDate = '2026-11-23',
  today = '2026-11-20',
  stateType = 'started',
  actual,
  actualDateFieldId = 2,
  deliveryCompletion,
  locale = 'en',
}: {
  dueDate?: string;
  today?: string;
  stateType?: StateType;
  actual?: IssueFieldValueEntry['value'];
  actualDateFieldId?: number | null;
  deliveryCompletion?: string | null;
  locale?: 'en' | 'zh-CN';
} = {}) {
  const issue = {
    id: 1,
    statusSince: '2026-12-01T00:00:00.000Z',
    fieldValues:
      actual === undefined ? [] : [{ fieldId: 2, value: actual, valueEnd: null, optionIds: [] }],
  };
  const deliveryById =
    deliveryCompletion === undefined
      ? undefined
      : new Map([
          [
            issue.id,
            {
              id: issue.id,
              moduleId: issue.id,
              childTypeId: null,
              role: 'module' as const,
              phase: 'delivery' as const,
              progress: 100,
              progressFieldId: null,
              progressReadOnly: true,
              problem: null,
              canConfirm: true,
              completed: true,
              completedAt: deliveryCompletion,
            },
          ],
        ]);
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={{ workItems: locale === 'zh-CN' ? workItemsZh : workItems }}
      timeZone="UTC"
    >
      <TooltipProvider>
        <KanbanDeadlineContext.Provider
          value={{ today, actualDateFieldId: actualDateFieldId ?? undefined, deliveryById }}
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
      const withinThreeDays = day <= 23;
      const withinFiveDays = day === 24 || day === 25;
      assert.equal(html.includes('Due within 3 days'), withinThreeDays);
      assert.equal(html.includes(`background-color:${STATUS_META.active.color}`), withinThreeDays);
      assert.equal(html.includes('text-pro-foreground'), withinThreeDays);
      assert.equal(html.includes('Due within 5 days'), withinFiveDays);
      assert.equal(
        html.includes('bg-blue-500/10 text-blue-700 dark:text-blue-400'),
        withinFiveDays,
      );
    }
    assert.match(card({ dueDate: '2026-11-24', today: '2026-11-21' }), /Due within 3 days/);
    assert.match(card({ today: '2026-11-24' }), /bg-overdue/);
  });

  it('uses the red due date style for a valid past deadline on an open issue', () => {
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
    assert.match(html, /bg-overdue[^"]*text-destructive-text[^"]*"[^>]*>Completed late · Oct 15/);
    assert.equal(html.match(/bg-overdue/g)?.length, 1);
    assert.doesNotMatch(html, /Dec 1/);
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

  it('renders compact Simplified Chinese labels and the localized completion date', () => {
    const locale = 'zh-CN';
    const previousLocale = getDisplayLocale();
    setDisplayLocale(locale);
    try {
      assert.match(card({ locale }), /3日内到期/);
      assert.match(card({ locale, dueDate: '2026-11-25' }), /5日内到期/);
      assert.match(
        card({ locale, dueDate: '2026-10-08', actual: '2026-10-15', stateType: 'completed' }),
        /延期完成 · 10月15日/,
      );
    } finally {
      setDisplayLocale(previousLocale);
    }
  });

  it('uses the effective completion date for delivery and respects an unknown imported date', () => {
    const issue = { dueDate: '2026-10-08', actual: '2026-10-16', stateType: 'completed' as const };
    const completion = new Date(2026, 9, 15, 12).toISOString();
    assert.match(card({ ...issue, deliveryCompletion: completion }), /Completed late · Oct 15/);
    assert.doesNotMatch(card({ ...issue, deliveryCompletion: null }), /Completed late/);
  });
});
