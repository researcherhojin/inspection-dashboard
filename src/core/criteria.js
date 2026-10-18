// 검사 항목 하나의 기준과 판정 (React · DOM 없음)
//  - applies: 이 부품에 해당하는 항목인가 (check.when)
//  - limitsOf / evaluateCheck / criterionText: 기준 범위, 판정, 화면에 보일 기준 글
//  - expectedValue: 육안 확인 때 맞춰 볼 값 (check.expect)

export const has = (v) => v !== undefined && v !== null && v !== '';
export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// 검사 항목이 이 부품에 해당하는지: check.when = { 열 이름: 정규식 } (예: 극성은 전해 커패시터 CP_* 만)
// 해당하지 않으면 '해당 없음(자동)' — 판정에서 빼고, 화면·성적서·CSV 에 그대로 표시
export function applies(check, item) {
  if (!check.when) return true;
  return Object.entries(check.when).every(([col, re]) => new RegExp(re).test(item?.[col] ?? ''));
}
export const whenText = (check) => Object.entries(check.when || {}).map(([col, re]) => `${col} ${re}`).join(', ');

// 사람이 볼 때 맞춰 볼 값: check.expect = 목록(items.csv)의 열 이름. group 은 '분류 · ' 접두어를 뗌
export function expectedValue(check, item) {
  if (!check.expect || !item) return null;
  const v = item[check.expect];
  if (!has(v)) return null;
  return check.expect === 'group' ? v.replace(/^[^·]*·\s*/, '') : v;
}

// 기준 범위: 고정 min/max, 또는 항목별 도면 치수(nominal 열) ± tol
export function limitsOf(check, item) {
  if (check.nominal) {
    const n = Number(item?.[check.nominal]);
    if (!has(item?.[check.nominal]) || Number.isNaN(n)) return { nominal: null };
    if (check.minFromNominal) return { nominal: n, min: n };
    const tol = Number(check.tol || 0);
    return { nominal: n, min: n - tol, max: n + tol };
  }
  return { min: has(check.min) ? Number(check.min) : undefined, max: has(check.max) ? Number(check.max) : undefined };
}

// 검사 항목 하나의 판정: true(통과) / false(불통과) / null(미입력)
export function evaluateCheck(check, value, item) {
  if (!has(value)) return null;
  switch (check.type) {
    case 'check':
      return value === true ? true : value === false ? false : null;
    case 'number': {
      const n = Number(value);
      if (Number.isNaN(n)) return null;
      const { min, max } = limitsOf(check, item);
      const eps = 1e-9;
      if (min !== undefined && n < min - eps) return false;
      if (max !== undefined && n > max + eps) return false;
      return true;
    }
    case 'select':
      return check.pass?.length ? check.pass.includes(value) : true;
    default:
      return true;
  }
}

const fmt = (v) => String(Math.round(v * 1000) / 1000);

export function criterionText(check, item) {
  if (check.type === 'number') {
    const u = check.unit ? ` ${check.unit}` : '';
    if (check.nominal) {
      if (!item) return check.minFromNominal ? `도면 지시값(${check.nominal}) 이상` : `도면 치수(${check.nominal}) ± ${check.tol ?? 0}${u}`;
      const { nominal, min, max } = limitsOf(check, item);
      if (nominal === null) return '도면 치수 없음 · 측정값 기록';
      if (check.minFromNominal) return `≥ ${fmt(min)}${u} (도면 지시)`;
      return Number(check.tol) ? `${fmt(nominal)} ± ${check.tol}${u}` : `${fmt(nominal)}${u}`;
    }
    const { min, max } = limitsOf(check, item);
    if (min !== undefined && max !== undefined) return `${fmt(min)} ~ ${fmt(max)}${u}`;
    if (max !== undefined) return `≤ ${fmt(max)}${u}`;
    if (min !== undefined) return `≥ ${fmt(min)}${u}`;
    return '측정값 기록';
  }
  if (check.type === 'select') return check.pass?.length ? `합격: ${check.pass.join(', ')}` : '선택';
  if (check.type === 'check') return '이상 없음 확인';
  return '기록';
}
