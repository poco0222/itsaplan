import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import issue from '../../../../../messages/zh-CN/issue.json';
import InitiativeDeliveryProgress from './InitiativeDeliveryProgress';

test('shows weighted delivery progress and explains an unavailable allocation', () => {
  const render = (progress: number | null, problem: 'weights' | null) =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale="zh-CN" messages={{ issue }} timeZone="Asia/Taipei">
        <InitiativeDeliveryProgress
          delivery={{ progress, problem, nodeTypeId: 3, sourceNumber: null }}
        />
      </NextIntlClientProvider>,
    );

  const valid = render(58, null);
  assert.ok(valid.includes('aria-valuenow="58"'));
  assert.ok(valid.includes('58%'));
  assert.ok(render(null, 'weights').includes('占比须合计 100%'));
});
