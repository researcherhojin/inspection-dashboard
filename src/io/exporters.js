import { applies } from '../core/criteria.js';
import { PREP_ISSUES, STATUS, prepIssuesOf, recipeFor, statusOf } from '../core/status.js';

export function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

// 준비 자료 + 검사 결과를 한 파일로 (다른 PC에서 '가져오기'로 복원 가능)
export function exportJson(ds, store) {
  const items = Object.values(ds.items).map((it) => ({
    ref: it.ref,
    category: it.category,
    group: it.group,
    name: it.name,
    placements: (ds.placementsByRef[it.ref] || []).map(({ x, y, w, h, rotation, side }) => ({ x, y, w, h, rotation, side })),
    docs: it.docIds,
    recipe: recipeFor(store.templates, it)?.id || null,
    prep_issues: prepIssuesOf(ds, store.templates, it),
    status: statusOf(ds, store.templates, it, store.results[it.ref]),
  }));
  const payload = {
    dataset: ds.id,
    name: ds.meta.name,
    exported_at: new Date().toISOString(),
    inspector: store.inspector,
    note: '규칙 기반 판정 · AI 판정 아님',
    recipes: { ...ds.recipes, templates: store.templates },
    results: store.results,
    items,
  };
  download(`${ds.id}-준비자료-${stamp()}.json`, JSON.stringify(payload, null, 2));
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportResultsCsv(ds, store) {
  const cols = ['ref', 'category', 'name', 'status', 'prep_issues', 'checks', 'reason', 'note', 'inspector', 'updated_at'];
  const rows = Object.values(ds.items).map((it) => {
    const r = store.results[it.ref] || {};
    const recipe = recipeFor(store.templates, it);
    const checks = recipe ? recipe.checks.map((c) => `${c.label}=${applies(c, it) ? r.checks?.[c.id] ?? '' : '해당 없음'}`).join(' | ') : '';
    return [
      it.ref,
      it.category,
      it.name,
      STATUS[statusOf(ds, store.templates, it, r)].label,
      prepIssuesOf(ds, store.templates, it).map((k) => PREP_ISSUES[k]).join(' / '),
      checks,
      r.reason || '',
      r.note || '',
      r.inspector || '',
      r.updatedAt || '',
    ];
  });
  // 엑셀에서 한글이 깨지지 않도록 BOM 추가
  const csv = '﻿' + [cols, ...rows].map((row) => row.map(cell).join(',')).join('\n');
  download(`${ds.id}-검사결과-${stamp()}.csv`, csv, 'text/csv');
}
