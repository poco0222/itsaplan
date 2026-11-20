import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import { toDateStr } from '@/utils/dates';
import { RelativeTimeProvider, useCurrentTime, useRelativeTime } from './relativeTimeContext';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'setInterval',
  'clearInterval',
  'Date',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let intervalRegistrations: number;
let refreshClock: () => void;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function RelativeTimeProbe({ value }: { value: string }) {
  const relativeTime = useRelativeTime();
  return <span>{relativeTime(value)}</span>;
}

function CurrentDayProbe() {
  return <span>{toDateStr(useCurrentTime())}</span>;
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  intervalRegistrations = 0;

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    setInterval: {
      configurable: true,
      value: (callback: () => void) => {
        intervalRegistrations += 1;
        refreshClock = callback;
        return 1;
      },
    },
    clearInterval: { configurable: true, value: () => undefined },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });

  const { createRoot } = await import('react-dom/client');
  const rootElement = document.querySelector('#root');
  assert.ok(rootElement);
  root = createRoot(rootElement);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('RelativeTimeProvider', () => {
  it('uses the wall clock before the first interval tick', () => {
    const current = new Date();
    const requestTime = new Date(current.getTime() - 2 * 60_000);

    act(() =>
      root.render(
        <NextIntlClientProvider locale="en" messages={{}} now={requestTime} timeZone="UTC">
          <RelativeTimeProvider>
            <RelativeTimeProbe value={current.toISOString()} />
            <RelativeTimeProbe value={current.toISOString()} />
          </RelativeTimeProvider>
        </NextIntlClientProvider>,
      ),
    );

    assert.equal(intervalRegistrations, 1);
    assert.deepEqual(
      [...document.querySelectorAll('span')].map((element) => element.textContent),
      ['now', 'now'],
    );
  });

  it('updates the local calendar day at the next clock tick after midnight', () => {
    let wallTime = new Date(2026, 10, 20, 23, 59).getTime();
    const ClockDate = new Proxy(Date, {
      construct: (DateConstructor, args) =>
        Reflect.construct(DateConstructor, args.length ? args : [wallTime]),
    });
    globalThis.Date = ClockDate;
    act(() =>
      root.render(
        <NextIntlClientProvider locale="en" now={new Date(wallTime)} timeZone="UTC">
          <RelativeTimeProvider>
            <CurrentDayProbe />
          </RelativeTimeProvider>
        </NextIntlClientProvider>,
      ),
    );
    assert.equal(document.querySelector('span')?.textContent, '2026-11-20');
    wallTime += 60_000;
    act(() => refreshClock());
    assert.equal(document.querySelector('span')?.textContent, '2026-11-21');
  });
});
