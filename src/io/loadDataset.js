// 데이터셋 폴더(public/datasets/<id>/)를 읽어 화면에서 쓰는 내부 모델로 바꿉니다.
// 파일 형식은 docs/dataset-schema.md 를 참고하세요.
import Papa from 'papaparse';

const BASE = `${import.meta.env.BASE_URL}datasets`;

export const datasetUrl = (id, file) => `${BASE}/${id}/${file}`;

const REQUIRED = {
  'items.csv': ['ref', 'category', 'group'],
  'placements.csv': ['ref', 'x', 'y', 'w', 'h', 'side'],
  'docs.csv': ['doc_id', 'title'],
};

async function fetchText(id, file, optional = false) {
  const res = await fetch(datasetUrl(id, file));
  // 개발 서버는 없는 파일에 index.html 을 돌려주므로 내용도 확인
  const text = res.ok ? await res.text() : null;
  if (!res.ok || text.trimStart().startsWith('<!doctype')) {
    if (optional) return null;
    throw new Error(`${file} 파일을 찾을 수 없습니다 (datasets/${id}/${file})`);
  }
  return text;
}

function parseCsv(text, file, errors) {
  const { data, meta } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const missing = (REQUIRED[file] || []).filter((c) => !meta.fields.includes(c));
  if (missing.length) errors.push(`${file}: 필수 열이 없습니다 → ${missing.join(', ')}`);
  return data.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])));
}

const isViewBox = (v) => Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

function validateMeta(meta, errors) {
  if (!Array.isArray(meta.sides) || meta.sides.length === 0) {
    errors.push('meta.json: "sides" 가 없거나 비어 있습니다 → 예: [{ "id": "top", "label": "앞면", "drawing": "drawing-top.svg" }]');
    return;
  }
  meta.sides.forEach((s, i) => {
    if (!s || !s.id) errors.push(`meta.json: sides[${i}] 에 "id" 가 없습니다`);
  });
  const sidesHaveVb = meta.sides.every((s) => isViewBox(s?.viewBox));
  if (!isViewBox(meta.viewBox) && !sidesHaveVb) errors.push('meta.json: "viewBox" 가 없습니다 → 숫자 4개 [x, y, 폭, 높이], 예: [0, 0, 1600, 1200]');
}

export async function loadDatasetIndex() {
  const res = await fetch(`${BASE}/index.json`);
  if (!res.ok) throw new Error('datasets/index.json 을 찾을 수 없습니다');
  return res.json();
}

export async function loadDataset(id) {
  const errors = [];
  const warnings = [];

  let meta;
  try {
    meta = JSON.parse(await fetchText(id, 'meta.json'));
  } catch (e) {
    if (e instanceof SyntaxError) return { id, meta: {}, errors: [`meta.json: JSON 형식이 올바르지 않습니다 (${e.message})`], warnings };
    throw e;
  }
  validateMeta(meta, errors);
  const raw = { 'items.csv': await fetchText(id, 'items.csv'), 'placements.csv': await fetchText(id, 'placements.csv') };
  const items = parseCsv(raw['items.csv'], 'items.csv', errors);
  const placementRows = parseCsv(raw['placements.csv'], 'placements.csv', errors);
  const docsText = await fetchText(id, 'docs.csv', true);
  const docs = docsText ? parseCsv(docsText, 'docs.csv', errors) : [];
  if (docsText) raw['docs.csv'] = docsText;
  const recipesText = await fetchText(id, 'recipes.json', true);
  const recipes = recipesText ? JSON.parse(recipesText) : { templates: [], exclude: { categories: [] }, reasons: [] };
  if (errors.length) return { id, meta, errors, warnings };

  const sideIds = new Set((meta.sides || []).map((s) => s.id));

  const itemsByRef = {};
  for (const it of items) {
    if (!it.ref) continue;
    if (itemsByRef[it.ref]) warnings.push(`items.csv: ${it.ref} 가 중복되어 첫 행만 사용합니다`);
    else itemsByRef[it.ref] = { ...it, docIds: (it.doc_id || '').split(';').map((s) => s.trim()).filter(Boolean) };
  }

  const placements = [];
  const placementsByRef = {};
  for (const p of placementRows) {
    const pl = { ...p, x: Number(p.x), y: Number(p.y), w: Number(p.w), h: Number(p.h), rotation: Number(p.rotation || 0) };
    // 1번 패드(방향 확인 위치) — 있으면 숫자로
    pl.pin1 = p.pin1_x !== undefined && p.pin1_x !== '' ? { x: Number(p.pin1_x), y: Number(p.pin1_y), label: p.pin1_label || '' } : null;
    if ([pl.x, pl.y, pl.w, pl.h].some(Number.isNaN)) {
      warnings.push(`placements.csv: ${p.ref} 의 좌표가 숫자가 아닙니다`);
      continue;
    }
    if (!sideIds.has(pl.side)) warnings.push(`placements.csv: ${p.ref} 의 side "${pl.side}" 가 meta.json 에 없습니다`);
    placements.push(pl);
    (placementsByRef[pl.ref] ||= []).push(pl);
  }

  const docsById = Object.fromEntries(docs.map((d) => [d.doc_id, d]));
  for (const it of Object.values(itemsByRef)) {
    for (const d of it.docIds) if (!docsById[d]) warnings.push(`items.csv: ${it.ref} 의 문서 ${d} 가 docs.csv 에 없습니다`);
  }

  // 그룹(BOM 한 줄 = 같은 group 값)
  const groupMap = new Map();
  for (const it of Object.values(itemsByRef)) {
    if (!groupMap.has(it.group)) groupMap.set(it.group, { key: it.group, category: it.category, spec: it.spec, refs: [] });
    groupMap.get(it.group).refs.push(it.ref);
  }
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  const groups = [...groupMap.values()];
  groups.forEach((g) => g.refs.sort(natural));
  groups.sort((a, b) => natural(a.category, b.category) || b.refs.length - a.refs.length || natural(a.key, b.key));

  // 도면에는 있는데 목록에는 없는 항목
  const orphanRefs = Object.keys(placementsByRef).filter((r) => !itemsByRef[r]);

  return { id, meta, items: itemsByRef, groups, placements, placementsByRef, orphanRefs, docs, docsById, recipes, errors, warnings };
}
