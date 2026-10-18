// 데이터 목록(index.json)과 고른 데이터 폴더를 불러옴
import { useEffect, useState } from 'react';
import { loadDataset, loadDatasetIndex } from '../io/loadDataset.js';
import { setPref } from '../io/prefs.js';

// preferId(): 목록이 도착한 순간 우선할 데이터 (주소에 적힌 것) — 링크로 연 화면이 바뀌지 않게
export function useDataset(datasetId, setDatasetId, preferId) {
  const [index, setIndex] = useState([]);
  const [ds, setDs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDatasetIndex()
      .then((list) => {
        setIndex(list);
        const want = preferId();
        setDatasetId((cur) => [want, cur].find((id) => id && list.some((d) => d.id === id)) || list[0]?.id || '');
      })
      .catch((e) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!datasetId) return;
    setPref('dataset', datasetId);
    let alive = true;
    setDs(null);
    setError(null);
    loadDataset(datasetId)
      .then((d) => alive && setDs(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [datasetId]);

  return { index, ds, error, ready: !!ds && !ds.errors.length };
}
