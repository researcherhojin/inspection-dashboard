// 자동화 규칙: 해당 없음 · 데이터끼리 비교 · 1번 패드 위치 — 실제 데이터로 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import { AUTO_RULES } from '../../src/core/autoRules.js';
import { applies, expectedValue } from '../../src/core/criteria.js';
import { statusOf } from '../../src/core/status.js';

const csv = (id, f) => Papa.parse(fs.readFileSync(`public/datasets/${id}/${f}`, 'utf8'), { header: true, skipEmptyLines: true }).data;
const json = (id, f) => JSON.parse(fs.readFileSync(`public/datasets/${id}/${f}`, 'utf8'));
const runAuto = (id) => {
  const rec = json(id, 'recipes.json');
  const out = { checked: 0, bad: [] };
  for (const it of csv(id, 'items.csv'))
    for (const a of rec.auto) {
      const r = AUTO_RULES[a.rule](it);
      if (r) {
        out.checked++;
        if (!r.ok) out.bad.push(it.ref);
      }
    }
  return out;
};

test('자동 비교: PCB 칩 크기(BOM ↔ CAD) 107건 · LifeTrac 도면명 길이 10건, 실제 데이터는 모두 일치', () => {
  assert.deepEqual(runAuto('pcb-lightsabre'), { checked: 107, bad: [] });
  assert.deepEqual(runAuto('lifetrac-iii'), { checked: 10, bad: [] });
});

test('자동 비교 규칙은 어긋나면 잡아냄 (일부러 틀린 행)', () => {
  assert.equal(AUTO_RULES['package-size']({ group: 'RES 1K 0402', name: '', value: '', spec: 'R_0603_1608Metric' }).ok, false);
  assert.equal(AUTO_RULES['title-length']({ value: '55 INCH FRONT-VERTICAL TUBE', length_in: '56' }).ok, false);
  // 지름을 뜻하는 표기("ROD, 1 INCH", "1 INCH PIN" 처럼 길이 열이 없는 것)는 비교하지 않음
  assert.equal(AUTO_RULES['title-length']({ value: 'ROD, 1 INCH', length_in: '5.5' }), null);
  assert.equal(AUTO_RULES['title-length']({ value: '1 INCH PIN (8IN LONG)', length_in: '' }), null);
});

test('해당 없음: 극성 검사는 전해 커패시터(CP_*)만 — 세라믹은 빼고 판정', () => {
  const rec = json('pcb-lightsabre', 'recipes.json');
  const tpl = rec.templates.find((t) => t.id === 'R-커패시터');
  const pol = tpl.checks.find((c) => c.id === 'polarity');
  const items = csv('pcb-lightsabre', 'items.csv').filter((it) => it.category === '커패시터');
  assert.equal(items.filter((it) => !applies(pol, it)).length, 54);
  const c1 = items.find((it) => it.ref === 'C1');
  const ds = { recipes: rec };
  // 세라믹 C1: 유무 · 납땜만 이상 없음 → 합격 (극성 칸이 비어도)
  assert.equal(statusOf(ds, rec.templates, c1, { checks: { present: true, solder: true } }), 'pass');
  // 전해 C3: 극성이 비면 아직 검사 중
  const c3 = items.find((it) => it.ref === 'C3');
  assert.equal(statusOf(ds, rec.templates, c3, { checks: { present: true, solder: true } }), 'progress');
});

test('맞춰 볼 값: IC 품번 · 저항 BOM 값(분류 접두어 제거) · 각관 단면 규격', () => {
  const pcb = csv('pcb-lightsabre', 'items.csv');
  assert.equal(expectedValue({ expect: 'part_no' }, pcb.find((i) => i.ref === 'U5')), 'ES9018K2M');
  assert.equal(expectedValue({ expect: 'group' }, pcb.find((i) => i.ref === 'R1')), 'RES 1K OHM 5% 1/16W 0402');
  const lt = csv('lifetrac-iii', 'items.csv');
  assert.equal(expectedValue({ expect: 'spec' }, lt.find((i) => i.ref === 'P01')), '□4.000×4.000×.250 R.250');
});

test('1번 패드 좌표는 모두 그 부품의 검사 영역 안, 다이오드는 파일에 적힌 K', () => {
  const pls = csv('pcb-lightsabre', 'placements.csv').filter((p) => p.pin1_x !== '');
  assert.ok(pls.length > 100);
  for (const p of pls) {
    const [x, y, w, h, px, py] = [p.x, p.y, p.w, p.h, p.pin1_x, p.pin1_y].map(Number);
    assert.ok(Math.abs(px - x) <= w / 2 + 1e-6 && Math.abs(py - y) <= h / 2 + 1e-6, `${p.ref} 1번 패드가 영역 밖`);
  }
  const items = Object.fromEntries(csv('pcb-lightsabre', 'items.csv').map((i) => [i.ref, i]));
  for (const p of pls.filter((q) => items[q.ref]?.category === '다이오드')) assert.equal(p.pin1_label, 'K', p.ref);
});
