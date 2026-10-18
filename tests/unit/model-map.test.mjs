// 3D 모델 ↔ 부품 번호 매칭 결과 검증 (scripts/step-to-glb.mjs 가 만든 model-map.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';

const dir = 'public/datasets/pcb-lightsabre';
const map = JSON.parse(fs.readFileSync(`${dir}/model-map.json`, 'utf8'));
const items = Papa.parse(fs.readFileSync(`${dir}/items.csv`, 'utf8'), { header: true, skipEmptyLines: true }).data;
const recipes = JSON.parse(fs.readFileSync(`${dir}/recipes.json`, 'utf8'));

test('검사 대상 부품은 모두 3D 모델에 있음', () => {
  const excluded = new Set(recipes.exclude.categories);
  const targets = items.filter((it) => !excluded.has(it.category)).map((it) => it.ref);
  const missing = targets.filter((r) => !map.refs.includes(r));
  assert.deepEqual(missing, []);
  assert.equal(map.unmatched.length, 0);
});

test('패키지로 매칭한 부품의 위치 오차 0.5mm 미만', () => {
  assert.ok(map.packageMatchDistanceMm.max < 0.5, `최대 오차 ${map.packageMatchDistanceMm.max}mm`);
});

test('3D 모델이 없는 것은 피듀셜·로고·홀·테스트 포인트뿐', () => {
  for (const r of map.noModel) assert.match(r, /^(FID|GFX|H|TP)\d+$/);
});
