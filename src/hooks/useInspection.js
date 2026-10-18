// 검사 결과를 데이터셋별로 브라우저(localStorage)에 저장합니다.
// 서버가 없으므로, 공유하려면 JSON 내보내기/가져오기를 사용합니다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { popHistory, pushHistory } from '../core/history.js';
import { applies } from '../core/criteria.js';

const EMPTY = { results: {}, inspector: '' };
const keyOf = (id) => `inspection-workbench:${id}`;

function read(id) {
  try {
    const raw = localStorage.getItem(keyOf(id));
    // 예전 버전이 저장한 templates(화면에서 고친 기준)는 읽지 않음 — 기준은 항상 recipes.json
    const { results = {}, inspector = '' } = raw ? JSON.parse(raw) : {};
    return { results, inspector };
  } catch {
    return EMPTY;
  }
}

export function useInspection(ds) {
  const id = ds?.id;
  // past(되돌리기 기록)는 저장하지 않음 — 새로고침하면 비워짐
  const [state, setState] = useState(() => ({ ...(id ? read(id) : EMPTY), past: [] }));
  const [loadedId, setLoadedId] = useState(id);
  const [save, setSave] = useState({ at: null, error: false });

  // 데이터셋이 바뀌면 그 데이터셋의 저장분을 불러옴
  if (id !== loadedId) {
    setLoadedId(id);
    setState({ ...(id ? read(id) : EMPTY), past: [] });
  }

  useEffect(() => {
    if (!id || id !== loadedId) return;
    const { results, inspector } = state;
    try {
      localStorage.setItem(keyOf(id), JSON.stringify({ results, inspector }));
      setSave({ at: new Date(), error: false });
    } catch {
      // 저장 불가 환경(시크릿 창 등): 화면에 알려 JSON 내보내기를 쓰게 함
      setSave((s) => ({ ...s, error: true }));
    }
  }, [id, loadedId, state.results, state.inspector]); // eslint-disable-line react-hooks/exhaustive-deps

  // 검사 기준은 데이터의 recipes.json 하나만 씀 (기준을 바꾸려면 그 파일을 고침)
  const templates = useMemo(() => ds?.recipes?.templates || [], [ds]);

  // 결과 변경은 모두 여기를 거쳐 되돌리기 기록을 남김
  const commit = useCallback((key, fn) => {
    setState((s) => {
      const results = fn(s.results, s);
      if (results === s.results) return s;
      return { ...s, results, past: pushHistory(s.past, s.results, key, Date.now()) };
    });
  }, []);

  const patchResult = useCallback(
    (ref, field, fn) =>
      commit(`${ref}:${field}`, (results, s) => {
        const prev = results[ref] || { checks: {} };
        return { ...results, [ref]: { ...fn(prev), inspector: s.inspector, updatedAt: new Date().toISOString() } };
      }),
    [commit],
  );

  const api = useMemo(
    () => ({
      setCheck: (ref, checkId, value) => patchResult(ref, `check:${checkId}`, (r) => ({ ...r, checks: { ...r.checks, [checkId]: value } })),
      // 레시피의 '이상 유무' 항목 중 아직 비어 있는 것만 '이상 없음'으로 (이미 '이상'으로 고른 칸은 건드리지 않음)
      setAllChecksOk: (ref, recipe) =>
        commit(null, (results, s) => {
          const prev = results[ref] || { checks: {} };
          const fill = recipe.checks.filter((c) => c.type === 'check' && applies(c, ds.items[ref]) && prev.checks?.[c.id] === undefined);
          if (!fill.length) return results;
          const checks = { ...prev.checks, ...Object.fromEntries(fill.map((c) => [c.id, true])) };
          return { ...results, [ref]: { ...prev, checks, inspector: s.inspector, updatedAt: new Date().toISOString() } };
        }),
      setManual: (ref, manual) => patchResult(ref, 'manual', (r) => ({ ...r, manual })),
      setReason: (ref, reason) => patchResult(ref, 'reason', (r) => ({ ...r, reason })),
      setNote: (ref, note) => patchResult(ref, 'note', (r) => ({ ...r, note })),
      clearResult: (ref) =>
        commit(null, (results) => {
          if (!results[ref]) return results;
          const next = { ...results };
          delete next[ref];
          return next;
        }),
      undo: () =>
        setState((s) => {
          const { past, results } = popHistory(s.past);
          return results ? { ...s, results, past } : s;
        }),
      setInspector: (inspector) => setState((s) => ({ ...s, inspector })),
      resetAll: () => setState({ ...EMPTY, past: [] }),
      importState: (obj) =>
        setState((s) => ({
          ...s,
          results: obj.results || {},
          past: pushHistory(s.past, s.results, null, Date.now()),
        })),
    }),
    [patchResult, commit, ds],
  );

  const { past, ...data } = state;
  return { ...data, templates, canUndo: past.length > 0, savedAt: save.at, saveError: save.error, ...api };
}
