// 검사 대시보드 — 화면 3개: 현황 · 검사 · 성적서
// 데이터(items · placements · recipes · docs)가 답할 수 있는 것만 보여 줍니다.
// 이 파일은 조립만 합니다: 상태는 hooks/, 판정 규칙은 core/, 파일 읽기·내보내기는 io/
import { useCallback, useMemo, useState } from 'react';
import { computeKpis, recipeFor } from './core/status.js';
import { nextPending, orderedRefs, stepRef } from './core/navigation.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useDataset } from './hooks/useDataset.js';
import { useInspection } from './hooks/useInspection.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import { useToast } from './hooks/useToast.js';
import AppBar from './components/AppBar.jsx';
import Guide from './components/Guide.jsx';
import { DOMAIN_NOTE } from './components/Status.jsx';
import Overview from './pages/Overview.jsx';
import Inspect from './pages/inspect/Inspect.jsx';
import Report from './pages/Report.jsx';

const PAGES = [
  { id: 'overview', label: '현황' },
  { id: 'inspect', label: '검사' },
  { id: 'report', label: '성적서' },
];
const PAGE_IDS = new Set(PAGES.map((p) => p.id));

export default function App() {
  const route = useHashRoute(PAGE_IDS, 'overview');
  const { datasetId, setDatasetId, page, setPage, selectedRef, setSelectedRef } = route;
  const { index, ds, error, ready } = useDataset(datasetId, setDatasetId, route.hashDataset);
  const store = useInspection(ready ? ds : null);
  const { toast, notify } = useToast();
  const [guide, setGuide] = useState(false);
  const closeGuide = useCallback(() => setGuide(false), []);

  const kpis = useMemo(() => (ready ? computeKpis(ds, store.templates, store.results) : null), [ready, ds, store.templates, store.results]);
  const order = useMemo(() => (ready ? orderedRefs(ds) : []), [ready, ds]);
  // 링크로 연 번호가 이 데이터에 없으면 선택 없음
  const sel = ready && selectedRef && (ds.items[selectedRef] || ds.placementsByRef[selectedRef]) ? selectedRef : null;

  const goNextPending = useCallback(() => {
    const r = ready ? nextPending(ds, store.templates, store.results, order, sel) : null;
    if (r) setSelectedRef(r);
    else notify('남은 검사 항목이 없습니다.');
  }, [ready, ds, store.templates, store.results, order, sel, notify, setSelectedRef]);

  const openItem = useCallback(
    (ref) => {
      setSelectedRef(ref);
      setPage('inspect');
    },
    [setSelectedRef, setPage],
  );

  const startInspection = () => {
    const r = nextPending(ds, store.templates, store.results, order, null);
    if (r) setSelectedRef(r);
    setPage('inspect');
  };

  const undo = useCallback(() => {
    if (!store.canUndo) return notify('되돌릴 기록이 없습니다.');
    store.undo();
    notify('방금 기록을 되돌렸습니다.');
  }, [store, notify]);

  const importFile = async (file) => {
    try {
      const obj = JSON.parse(await file.text());
      if (obj.dataset && obj.dataset !== ds.id) return notify(`이 파일은 "${obj.dataset}" 데이터용입니다. 지금 데이터: "${ds.id}"`);
      store.importState(obj);
      notify('기록을 가져왔습니다. 잘못 가져왔다면 Ctrl(⌘)+Z 로 되돌릴 수 있습니다.');
    } catch {
      notify('JSON 파일을 읽을 수 없습니다.');
    }
  };

  const actions = useMemo(
    () => ({
      undo,
      help: () => setGuide(true),
      next: () => setSelectedRef((cur) => stepRef(order, cur, 1)),
      prev: () => setSelectedRef((cur) => stepRef(order, cur, -1)),
      nextPending: goNextPending,
      search: () => document.getElementById('item-search')?.focus(),
      allOk: () => {
        const recipe = sel && ds.items[sel] && recipeFor(store.templates, ds.items[sel]);
        if (recipe) store.setAllChecksOk(sel, recipe);
      },
    }),
    [undo, order, goNextPending, sel, ds, store, setSelectedRef],
  );
  useShortcuts({ enabled: ready, paused: guide, inspect: page === 'inspect', actions });

  return (
    <div className={`app page-${page}`}>
      <AppBar
        pages={PAGES}
        page={page}
        onPage={setPage}
        index={index}
        datasetId={datasetId}
        onDataset={(id) => {
          setSelectedRef(null);
          setDatasetId(id);
        }}
        ds={ds}
        store={store}
        ready={ready}
        onUndo={undo}
        onGuide={() => setGuide(true)}
        onImport={importFile}
      />

      <main className="main">
        <h1 className="sr-only">{PAGES.find((p) => p.id === page)?.label}</h1>
        {error && <div className="notice bad">데이터를 불러오지 못했습니다: {error}</div>}
        {ds && ds.errors.length > 0 && (
          <div className="notice bad">
            <strong>데이터 형식 오류</strong> — docs/dataset-schema.md 를 확인하세요.
            <ul>
              {ds.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {!ds && !error && <p className="muted">불러오는 중…</p>}

        {ready && page === 'overview' && <Overview ds={ds} store={store} kpis={kpis} onStart={startInspection} onOpen={openItem} onGuide={() => setGuide(true)} />}
        {ready && page === 'inspect' && <Inspect ds={ds} store={store} selectedRef={sel} onSelect={setSelectedRef} onNext={goNextPending} />}
        {ready && page === 'report' && <Report ds={ds} store={store} kpis={kpis} onOpen={openItem} />}
        {ready && page !== 'inspect' && (
          <footer className="domain-note">
            <b>알려 둘 점</b> {DOMAIN_NOTE}
          </footer>
        )}
      </main>

      {guide && <Guide onClose={closeGuide} has3d={!!ds?.meta?.model?.url} />}
      {toast && (
        <div className="toast" role="status" key={toast.at}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
