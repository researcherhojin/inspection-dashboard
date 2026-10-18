// 되돌리기 기록. 같은 칸을 연달아 고치면(예: 숫자를 한 글자씩 입력) 한 번으로 묶음.
export const HISTORY_LIMIT = 30;
export const COALESCE_MS = 1500;

// past: [{ results, key, at }] (가장 최근이 끝). prevResults = 바꾸기 직전 결과.
export function pushHistory(past, prevResults, key, now) {
  const top = past[past.length - 1];
  if (top && key && top.key === key && now - top.at < COALESCE_MS) {
    // 묶음: 처음 바꾸기 전 상태는 그대로 두고 시각만 갱신
    return [...past.slice(0, -1), { ...top, at: now }];
  }
  const next = [...past, { results: prevResults, key, at: now }];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

export function popHistory(past) {
  if (!past.length) return { past, results: null };
  return { past: past.slice(0, -1), results: past[past.length - 1].results };
}
