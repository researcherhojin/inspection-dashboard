// 항목 상태 · 준비 상태 · 집계 (규칙 판정, AI 판정 없음 · React · DOM 없음)
import { applies, evaluateCheck } from './criteria.js';
import { autoResults } from './autoRules.js';

export const STATUS = {
  todo: { label: '미검사', tone: 'muted' },
  progress: { label: '검사 중', tone: 'info' },
  pass: { label: '합격', tone: 'ok' },
  fail: { label: '불합격', tone: 'bad' },
  hold: { label: '보류', tone: 'warn' },
  excluded: { label: '검사 제외', tone: 'muted' },
};

export const PREP_ISSUES = {
  no_placement: '도면 위치 없음',
  no_recipe: '검사 레시피 없음',
  no_doc: '연결 문서 없음',
  no_item: '목록(BOM)에 없음',
  review: '도면 검토 필요',
  auto: '자동 확인 불일치',
};

export function isExcluded(ds, item) {
  return (ds.recipes.exclude?.categories || []).includes(item.category);
}

export function recipeFor(templates, item) {
  return (
    templates.find((t) => t.appliesTo?.refs?.includes(item.ref)) ||
    templates.find((t) => t.appliesTo?.category === item.category || t.appliesTo?.categories?.includes(item.category)) ||
    null
  );
}

export function statusOf(ds, templates, item, result) {
  if (isExcluded(ds, item) || result?.manual === 'excluded') return 'excluded';
  if (result?.manual === 'hold') return 'hold';
  const recipe = recipeFor(templates, item);
  if (!recipe || !result?.checks) return 'todo';
  const verdicts = recipe.checks.filter((c) => applies(c, item)).map((c) => evaluateCheck(c, result.checks[c.id], item));
  if (verdicts.includes(false)) return 'fail';
  if (verdicts.every((v) => v === true)) return 'pass';
  if (verdicts.some((v) => v !== null)) return 'progress';
  return 'todo';
}

export function prepIssuesOf(ds, templates, item) {
  if (isExcluded(ds, item)) return [];
  const issues = [];
  if (!ds.placementsByRef[item.ref]) issues.push('no_placement');
  if (!recipeFor(templates, item)) issues.push('no_recipe');
  if (!item.docIds.length) issues.push('no_doc');
  if (item.review) issues.push('review');
  if (autoResults(ds, item).some((a) => !a.result.ok)) issues.push('auto');
  return issues;
}

// 검사 준비 단계: 도면 위치 + 레시피가 있으면 '영역 준비'
function prepStateOf(ds, templates, item) {
  if (isExcluded(ds, item)) return 'excluded';
  const issues = prepIssuesOf(ds, templates, item);
  if (issues.includes('no_placement') || issues.includes('no_recipe')) return 'needs_input';
  return 'ready';
}

export function computeKpis(ds, templates, results) {
  const items = Object.values(ds.items);
  const k = { placed: 0, groups: ds.groups.length, ready: 0, needsInput: 0, excluded: 0, withDoc: 0, withoutDoc: 0 };
  const st = { todo: 0, progress: 0, pass: 0, fail: 0, hold: 0, excluded: 0 };
  k.placed = new Set(ds.placements.map((p) => p.ref)).size;
  for (const it of items) {
    const prep = prepStateOf(ds, templates, it);
    if (prep === 'ready') k.ready++;
    else if (prep === 'needs_input') k.needsInput++;
    else k.excluded++;
    if (prep !== 'excluded') {
      if (it.docIds.length) k.withDoc++;
      else k.withoutDoc++;
    }
    st[statusOf(ds, templates, it, results[it.ref])]++;
  }
  return { ...k, status: st, total: items.length };
}
