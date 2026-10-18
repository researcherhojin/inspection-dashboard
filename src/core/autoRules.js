// 데이터끼리 맞는지 자동으로 비교하는 규칙 (React · DOM 없음)
import { has } from './criteria.js';

// recipes.json 의 auto 목록에서 규칙 이름(rule)으로 사용
// 결과: null(해당 없음) 또는 { ok, text }
const PKG = /\b(0201|0402|0603|0805|1206|1210|2512)\b/;
export const AUTO_RULES = {
  // BOM 설명의 칩 크기(0402 등) = CAD 풋프린트의 칩 크기
  'package-size': (item) => {
    const bom = [item.group, item.name, item.value].join(' ').match(PKG)?.[1];
    const cad = (item.spec || '').replace(/_/g, ' ').match(PKG)?.[1];
    if (!bom || !cad) return null;
    return { ok: bom === cad, text: `BOM ${bom} · CAD ${cad}` };
  },
  // 도면명의 길이("55 INCH …") = 도면 치수(length_in)
  'title-length': (item) => {
    const m = (item.value || '').match(/^(\d+(?:\.\d+)?) INCH \w/);
    if (!m || !has(item.length_in)) return null;
    const a = Number(m[1]);
    const b = Number(item.length_in);
    return { ok: Math.abs(a - b) < 1e-9, text: `도면명 ${a} in · 치수 ${b} in` };
  },
};

export function autoResults(ds, item) {
  return (ds.recipes.auto || [])
    .map((a) => ({ ...a, result: AUTO_RULES[a.rule]?.(item) || null }))
    .filter((a) => a.result);
}
