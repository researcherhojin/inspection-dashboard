// 검사 작업 순서: 목록 화면과 같은 순서(그룹 순 → 그룹 안 번호 순)로 이동
import { statusOf } from './status.js';

export function orderedRefs(ds) {
  return ds.groups.flatMap((g) => g.refs);
}

// dir = +1(다음) / -1(이전). 끝에서는 멈춤(순환하지 않음 — 마지막 항목을 지나쳤는지 알 수 있게).
export function stepRef(order, cur, dir) {
  if (!order.length) return null;
  const i = order.indexOf(cur);
  if (i < 0) return order[dir > 0 ? 0 : order.length - 1];
  const j = i + dir;
  return j >= 0 && j < order.length ? order[j] : cur;
}

export const PENDING = new Set(['todo', 'progress']);

// 현재 위치 다음부터 끝까지, 이어서 처음부터 현재 앞까지 '현재 항목이 아닌' 미검사(검사 중 포함) 항목을 찾음.
// 다른 미검사 항목이 없으면 null (현재 항목이 유일한 미검사여도 null).
export function nextPending(ds, templates, results, order, cur) {
  const start = order.indexOf(cur);
  for (let k = 1; k <= order.length; k++) {
    const ref = order[(start + k + order.length) % order.length];
    if (ref === cur && start >= 0) break;
    if (PENDING.has(statusOf(ds, templates, ds.items[ref], results[ref]))) return ref;
  }
  return null;
}

export function pendingCount(ds, templates, results) {
  return Object.values(ds.items).filter((it) => PENDING.has(statusOf(ds, templates, it, results[it.ref]))).length;
}
