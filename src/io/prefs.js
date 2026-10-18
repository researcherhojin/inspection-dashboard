// 화면 설정(마지막 데이터, 안내 숨김 등)을 브라우저에 저장. 저장이 안 되는 환경에서도 화면은 그대로 동작
const key = (k) => `iw-pref:${k}`;

export function getPref(k, fallback) {
  try {
    return localStorage.getItem(key(k)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setPref(k, v) {
  try {
    localStorage.setItem(key(k), v);
  } catch {
    /* 시크릿 창 등 — 이번 화면에서만 적용 */
  }
}
