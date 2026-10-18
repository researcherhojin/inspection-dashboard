// KiCad 가 내보낸 기판 3D 모델(STEP) → 브라우저용 glTF(GLB) 변환 + 부품 번호(ref) 매칭
//
// 사용법:
//   node scripts/step-to-glb.mjs <board.step> <데이터셋 폴더>
//   예) node scripts/step-to-glb.mjs LightSABRE_DAC.3D-model.step public/datasets/pcb-lightsabre
//
// STEP 안의 부품 인스턴스에는 부품 번호가 없고 '패키지 이름'만 있습니다.
// 그래서 데이터셋의 placements.csv(부품 중심 좌표)와 items.csv(패키지)를 이용해
//   1) 패키지 이름이 같고  2) 위치가 가장 가까운 부품
// 으로 번호를 붙입니다. 이름 없는 하위 형상은 가장 가까운 부품에 붙입니다. 결과는 model-map.json 에 기록합니다.

import fs from 'node:fs';
import path from 'node:path';
import occtimportjs from 'occt-import-js';
import Papa from 'papaparse';
import { Document, NodeIO } from '@gltf-transform/core';

const [stepPath, dsDir] = process.argv.slice(2);
if (!stepPath || !dsDir) {
  console.error('사용법: node scripts/step-to-glb.mjs <board.step> <데이터셋 폴더>');
  process.exit(1);
}

const csv = (f) => Papa.parse(fs.readFileSync(path.join(dsDir, f), 'utf8'), { header: true, skipEmptyLines: true }).data;
const items = Object.fromEntries(csv('items.csv').map((r) => [r.ref, r]));
const placements = csv('placements.csv').map((p) => ({ ...p, x: +p.x, y: +p.y, w: +p.w, h: +p.h }));
const meta = JSON.parse(fs.readFileSync(path.join(dsDir, 'meta.json'), 'utf8'));

const occt = await occtimportjs();
const res = occt.ReadStepFile(new Uint8Array(fs.readFileSync(stepPath)), {
  linearUnit: 'millimeter',
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.001,
  angularDeflection: 0.5,
});
if (!res.success) throw new Error('STEP 파일을 읽지 못했습니다');

const bbox = (arr) => {
  const a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) (a[k] = Math.min(a[k], arr[i + k])), (b[k] = Math.max(b[k], arr[i + k]));
  return [a, b];
};

// STEP(기판 중심이 원점, Y 위쪽) ↔ KiCad 좌표(Y 아래쪽): 기판 외곽 중심을 맞춤
const pcbMesh = res.meshes.find((m) => /_PCB$|PCB/.test(m.name));
const [pa, pb] = bbox(pcbMesh.attributes.position.array);
const vb = meta.viewBox; // [x0, y0, w, h] — 여백 포함, 기판 중심은 가운데
const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
const stepToPcb = (x, y) => [x - (pa[0] + pb[0]) / 2 + cx, -(y - (pa[1] + pb[1]) / 2) + cy];

// 각 메시를 부품에 배정
const byRef = new Map();
const log = { matchedByPackage: 0, matchedByPosition: 0, board: 0, unmatched: [] };
const usedPkgMatch = new Set();
const meshes = res.meshes.map((m, i) => {
  const [a, b] = bbox(m.attributes.position.array);
  const [x, y] = stepToPcb((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  return { i, m, x, y, top: b[2] > 0.8 };
});
// 1) 패키지 이름이 있는 메시: 같은 패키지 중 가장 가까운 부품
for (const e of meshes) {
  if (e.m === pcbMesh) continue;
  if (!e.m.name) continue;
  const cands = placements.filter((p) => items[p.ref]?.spec === e.m.name && !usedPkgMatch.has(p.ref));
  let best = null, bd = Infinity;
  for (const p of cands) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < bd) (bd = d), (best = p);
  }
  if (best && bd < 6) {
    usedPkgMatch.add(best.ref);
    e.ref = best.ref;
    e.dist = bd;
    log.matchedByPackage++;
  }
}
// 2) 이름 없는 하위 형상·남은 것: 영역 안에 들어가는 가장 작은 부품, 없으면 가장 가까운 부품(5mm 이내)
for (const e of meshes) {
  if (e.ref || e.m === pcbMesh) continue;
  const inside = placements.filter((p) => Math.abs(p.x - e.x) <= p.w / 2 + 0.5 && Math.abs(p.y - e.y) <= p.h / 2 + 0.5);
  inside.sort((a, b) => a.w * a.h - b.w * b.h);
  let best = inside[0];
  if (!best) {
    let bd = Infinity;
    for (const p of placements) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < bd) (bd = d), (best = p);
    }
    if (bd > 5) best = null;
  }
  if (best) {
    e.ref = best.ref;
    e.dist = Math.hypot(best.x - e.x, best.y - e.y);
    log.matchedByPosition++;
  } else log.unmatched.push({ name: e.m.name || '(이름 없음)', x: +e.x.toFixed(2), y: +e.y.toFixed(2) });
}
for (const e of meshes) {
  const key = e.m === pcbMesh ? '__board' : e.ref || '__other';
  if (key === '__board') log.board++;
  if (!byRef.has(key)) byRef.set(key, []);
  byRef.get(key).push(e.m);
}

// glTF 만들기: 부품 번호마다 노드 하나 (Z 위 → glTF 의 Y 위로 회전)
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('board');
const root = doc.createNode('board').setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
scene.addChild(root);
const matCache = new Map();
const material = (rgb) => {
  const k = rgb.map((v) => v.toFixed(3)).join(',');
  if (!matCache.has(k)) matCache.set(k, doc.createMaterial(k).setBaseColorFactor([...rgb, 1]).setRoughnessFactor(0.55).setMetallicFactor(0.05));
  return matCache.get(k);
};
const DEFAULT = [0.55, 0.57, 0.6];
// 이 STEP 에는 색 정보가 없어서(COLOUR_RGB 0개) 패키지 종류로 색을 정함 — 실물과 다를 수 있음
const hex = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2); // sRGB → linear
const PACKAGE_COLORS = [
  [/^C_\d/, '#b8915e'], // 세라믹 커패시터
  [/^R_\d/, '#2b2b2b'], // 칩 저항
  [/^LED_/, '#efe9c9'],
  [/^L_\d/, '#3d3d3d'],
  [/^CP_Elec/, '#c9cdd2'], // 알루미늄 전해
  [/^(SOT|MSOP|QFN|OSC|D_SMB)/, '#232323'],
  [/^(SKT|PinHeader)/, '#262626'],
  [/(PJ-|Barrel|DC|Converter|TRRS)/, '#1d1d1d'], // 잭·커넥터·DC 컨버터
  [/^Oscillator/, '#c9cdd2'],
];
const BOARD_COLOR = hex('#16211b'); // 솔더마스크
const colorFor = (ref, meshName) => {
  const pkg = (ref && items[ref]?.spec) || meshName || '';
  const hit = PACKAGE_COLORS.find(([re]) => re.test(pkg));
  return hit ? hex(hit[1]) : DEFAULT;
};
let triangles = 0;
for (const [ref, list] of byRef) {
  const mesh = doc.createMesh(ref);
  for (const m of list) {
    const base = ref === '__board' ? BOARD_COLOR : colorFor(ref.startsWith('__') ? null : ref, m.name);
    const pos = new Float32Array(m.attributes.position.array);
    const nrm = m.attributes.normal ? new Float32Array(m.attributes.normal.array) : null;
    const idx = new Uint32Array(m.index.array);
    triangles += idx.length / 3;
    // 면(brep face)마다 색이 다를 수 있어 색별로 나눠 primitive 생성
    const groups = new Map();
    const faces = m.brep_faces?.length ? m.brep_faces : [{ first: 0, last: idx.length / 3 - 1, color: m.color }];
    for (const f of faces) {
      const c = f.color || m.color || base;
      const k = c.join(',');
      if (!groups.has(k)) groups.set(k, { c, tris: [] });
      for (let t = f.first; t <= f.last; t++) groups.get(k).tris.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
    }
    const posAcc = doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer);
    const nrmAcc = nrm ? doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer) : null;
    for (const { c, tris } of groups.values()) {
      const prim = doc
        .createPrimitive()
        .setAttribute('POSITION', posAcc)
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris)).setBuffer(buffer))
        .setMaterial(material(c));
      if (nrmAcc) prim.setAttribute('NORMAL', nrmAcc);
      mesh.addPrimitive(prim);
    }
  }
  root.addChild(doc.createNode(ref).setMesh(mesh));
}

// 매칭 품질: 패키지로 맞춘 메시의 중심과 부품 중심 사이 거리(mm)
const pkgD = meshes.filter((e) => e.m.name && e.ref && e.dist !== undefined && e.m !== pcbMesh).map((e) => e.dist);
log.packageMatchDistanceMm = { max: +Math.max(...pkgD).toFixed(3), mean: +(pkgD.reduce((a, b) => a + b, 0) / pkgD.length).toFixed(3) };

const out = path.join(dsDir, 'model.glb');
fs.writeFileSync(out, await new NodeIO().writeBinary(doc));
const refs = [...byRef.keys()].filter((k) => !k.startsWith('__'));
fs.writeFileSync(
  path.join(dsDir, 'model-map.json'),
  JSON.stringify({ source: path.basename(stepPath), colors: 'STEP 에 색 정보가 없어 패키지 종류별로 지정', triangles, refs, ...log, noModel: Object.keys(items).filter((r) => !refs.includes(r)) }, null, 2) + '\n',
);
console.log(`✔ ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB, 삼각형 ${triangles.toLocaleString()}) · 부품 ${refs.length}개 매칭 (패키지 ${log.matchedByPackage}, 위치 ${log.matchedByPosition}) · 미매칭 ${log.unmatched.length}`);
