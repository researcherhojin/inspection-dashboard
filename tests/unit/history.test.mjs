import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushHistory, popHistory, HISTORY_LIMIT, COALESCE_MS } from '../../src/core/history.js';

test('같은 칸 연속 입력은 하나로 묶고, 처음 상태로 되돌림', () => {
  let past = [];
  past = pushHistory(past, { r: 0 }, 'P01:length', 1000);
  past = pushHistory(past, { r: 1 }, 'P01:length', 1500); // 5 → 55
  past = pushHistory(past, { r: 2 }, 'P01:length', 2000); // 55 → 55.2
  assert.equal(past.length, 1);
  assert.deepEqual(popHistory(past).results, { r: 0 });
});

test('다른 칸이거나 시간이 지나면 따로 기록', () => {
  let past = pushHistory([], { r: 0 }, 'P01:a', 0);
  past = pushHistory(past, { r: 1 }, 'P01:b', 100);
  past = pushHistory(past, { r: 2 }, 'P01:b', 100 + COALESCE_MS + 1);
  assert.equal(past.length, 3);
  past = pushHistory(past, { r: 3 }, null, 100 + COALESCE_MS + 2); // 키 없음 = 항상 따로
  past = pushHistory(past, { r: 4 }, null, 100 + COALESCE_MS + 3);
  assert.equal(past.length, 5);
});

test('최대 개수를 넘으면 오래된 것부터 버림, 빈 기록에서 되돌리기', () => {
  let past = [];
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) past = pushHistory(past, { r: i }, `k${i}`, i * 10000);
  assert.equal(past.length, HISTORY_LIMIT);
  assert.deepEqual(past[0].results, { r: 5 });
  assert.deepEqual(popHistory([]), { past: [], results: null });
});
