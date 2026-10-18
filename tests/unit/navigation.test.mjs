import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderedRefs, stepRef, nextPending, pendingCount } from '../../src/core/navigation.js';

// 최소 데이터셋: 그룹 2개, 레시피는 check 하나
const ds = {
  groups: [{ refs: ['A1', 'A2'] }, { refs: ['B1', 'B2'] }],
  items: Object.fromEntries(['A1', 'A2', 'B1', 'B2'].map((r) => [r, { ref: r, category: r === 'B2' ? 'X' : 'C', docIds: [] }])),
  placementsByRef: {},
  recipes: { exclude: { categories: ['X'] } },
};
const templates = [{ id: 't', appliesTo: { category: 'C' }, checks: [{ id: 'ok', type: 'check' }] }];

test('orderedRefs: 그룹 순서 그대로', () => {
  assert.deepEqual(orderedRefs(ds), ['A1', 'A2', 'B1', 'B2']);
});

test('stepRef: 끝에서 멈춤, 선택 없으면 처음/끝', () => {
  const o = orderedRefs(ds);
  assert.equal(stepRef(o, 'A2', 1), 'B1');
  assert.equal(stepRef(o, 'B2', 1), 'B2');
  assert.equal(stepRef(o, 'A1', -1), 'A1');
  assert.equal(stepRef(o, null, 1), 'A1');
  assert.equal(stepRef(o, null, -1), 'B2');
  assert.equal(stepRef([], 'A1', 1), null);
});

test('nextPending: 완료·제외 항목 건너뛰고, 끝에서 처음으로 돌아감', () => {
  const o = orderedRefs(ds);
  const results = { A2: { checks: { ok: true } } }; // A2 합격, B2 는 제외 분류
  assert.equal(nextPending(ds, templates, results, o, 'A1'), 'B1');
  assert.equal(nextPending(ds, templates, results, o, 'B1'), 'A1');
  assert.equal(nextPending(ds, templates, results, o, null), 'A1');
  const allDone = { A1: { checks: { ok: true } }, A2: { checks: { ok: true } }, B1: { checks: { ok: false } } };
  assert.equal(nextPending(ds, templates, allDone, o, 'A1'), null); // 불합격도 '판정 완료'
  assert.equal(pendingCount(ds, templates, results), 2);
  // 보류는 미검사가 아님. 현재 항목 말고 다른 미검사가 없으면 null
  const held = { ...results, B1: { manual: 'hold', checks: {} } };
  assert.equal(nextPending(ds, templates, held, o, 'A1'), null);
  assert.equal(nextPending(ds, templates, held, o, 'B1'), 'A1');
});
