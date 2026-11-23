import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import issue from '../../../../../messages/zh-CN/issue.json';
import workItems from '../../../../../messages/zh-CN/workItems.json';
import { TableSectionHeader } from './TableSectionHeader';

const render = (
  collapsed: boolean,
  planProgress?: React.ComponentProps<typeof TableSectionHeader>['planProgress'],
) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="zh-CN" messages={{ issue, workItems }} timeZone="Asia/Taipei">
      <TableSectionHeader
        group={{ key: 'i1', name: 'Plan', assign: null, values: [1] }}
        count={2}
        collapsed={collapsed}
        disabled={false}
        dropId="sec:i1"
        onDrop={() => {}}
        onToggle={() => {}}
        onAddIssue={() => {}}
        canAdd={false}
        planProgress={planProgress}
      />
    </NextIntlClientProvider>,
  );

test('keeps weighted plan progress in the configured column when collapsed or expanded', () => {
  const planProgress = {
    delivery: { progress: 88.8, problem: null },
    column: 3,
    gridTemplate: 'minmax(360px,1fr) 160px 130px',
    lastColumn: true,
  };
  const collapsed = render(true, planProgress);
  assert.match(collapsed, /aria-expanded="false"/);
  assert.match(collapsed, /grid-template-columns:minmax\(360px,1fr\) 160px 130px/);
  assert.match(collapsed, /grid-column:3[^>]*>88\.8%/);
  assert.match(
    render(false, { ...planProgress, column: 2, gridTemplate: 'minmax(360px,1fr) 200px 160px' }),
    /grid-column:2[^>]*>88\.8%/,
  );
  assert.doesNotMatch(render(true), /grid-column:|88\.8%/);
});

test('shows zero and reuses the Plans calculation warning', () => {
  const placement = { column: 2, gridTemplate: '1fr 160px', lastColumn: true };
  const html = render(true, { ...placement, delivery: { progress: 0, problem: null } });
  assert.match(html, />0%</);
  assert.match(
    render(true, { ...placement, delivery: { progress: null, problem: 'weights' } }),
    /占比须合计 100%/,
  );
});
