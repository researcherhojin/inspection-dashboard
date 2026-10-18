// 주소 ↔ 화면 상태: #/데이터/화면/번호 — 특정 항목을 바로 여는 링크를 공유할 수 있게
// 주소창은 React 바깥의 시스템이므로 Effect 로 동기화합니다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPref } from '../io/prefs.js';

function parseHash(pageIds) {
  const [, dataset, page, ref] = decodeURIComponent(window.location.hash).split('/');
  return { dataset: dataset || null, page: pageIds.has(page) ? page : null, ref: ref || null };
}

export function useHashRoute(pageIds, defaultPage) {
  const initial = useRef(parseHash(pageIds)).current;
  const [datasetId, setDatasetId] = useState(() => initial.dataset || getPref('dataset', ''));
  const [page, setPage] = useState(() => initial.page || defaultPage);
  const [selectedRef, setSelectedRef] = useState(initial.ref);

  // lastHash: 앱이 마지막으로 쓴(또는 읽은) 주소. 그사이 밖에서 바뀌었으면 덮어쓰지 않고 따라감
  //  — 링크를 붙여 넣는 순간 데이터 목록이 늦게 도착해도 연 화면이 바뀌지 않게
  const lastHash = useRef(window.location.hash);
  const applyHash = useCallback(() => {
    const h = parseHash(pageIds);
    lastHash.current = window.location.hash;
    if (h.dataset) setDatasetId(h.dataset);
    if (h.page) setPage(h.page);
    setSelectedRef(h.ref);
  }, [pageIds]);

  useEffect(() => {
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  useEffect(() => {
    if (!datasetId) return;
    if (window.location.hash !== lastHash.current) return applyHash();
    const hash = `#/${datasetId}/${page}${selectedRef ? `/${selectedRef}` : ''}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    lastHash.current = hash;
  }, [datasetId, page, selectedRef, applyHash]);

  const hashDataset = useCallback(() => parseHash(pageIds).dataset, [pageIds]);
  return { datasetId, setDatasetId, page, setPage, selectedRef, setSelectedRef, hashDataset };
}
