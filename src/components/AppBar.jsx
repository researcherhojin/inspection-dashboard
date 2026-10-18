// 상단 줄: 홈 · 데이터 선택 · 화면 탭 · 검사자 · 저장 상태 · 되돌리기 · 사용 방법 · 더보기(내보내기/가져오기)
import { useEffect, useRef } from 'react';
import { exportJson, exportResultsCsv } from '../io/exporters.js';

export default function AppBar({ pages, page, onPage, index, datasetId, onDataset, ds, store, ready, onUndo, onGuide, onImport }) {
  const fileInput = useRef(null);

  // 더보기 메뉴: 바깥을 누르거나 항목을 고르면 닫힘 (document 이벤트 → Effect)
  useEffect(() => {
    const close = (e) => document.querySelectorAll('details.menu[open]').forEach((d) => (!d.contains(e.target) || e.target.closest('.menu-item')) && d.removeAttribute('open'));
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onImport(file);
  };

  return (
    <header className="bar">
      <button className="home" onClick={() => onPage('overview')} title="현황으로">
        검사 대시보드
      </button>
      <select className="ds-select" value={datasetId} onChange={(e) => onDataset(e.target.value)} aria-label="데이터">
        {index.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <nav className="tabs" aria-label="화면">
        {pages.map((p) => (
          <button key={p.id} className={page === p.id ? 'on' : ''} aria-current={page === p.id ? 'page' : undefined} onClick={() => onPage(p.id)}>
            {p.label}
          </button>
        ))}
      </nav>
      <span className="grow" />
      {ready && (
        <>
          <label className={`inspector ${store.inspector ? '' : 'empty'}`}>
            <span>검사자</span>
            <input id="inspector-input" value={store.inspector} placeholder="이름" onChange={(e) => store.setInspector(e.target.value)} aria-label="검사자" />
          </label>
          <span className={`saved ${store.saveError ? 'bad' : ''}`} title="기록은 이 브라우저에 자동 저장됩니다">
            {store.saveError ? '저장 안 됨 · JSON 으로 내보내세요' : store.savedAt ? `저장 ${store.savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          <button className="btn ghost" disabled={!store.canUndo} onClick={onUndo} title="Ctrl(⌘)+Z">
            되돌리기
          </button>
          <button className="btn ghost" onClick={onGuide} title="?">
            사용 방법
          </button>
          <details className="menu">
            <summary className="btn ghost">더보기</summary>
            <div className="menu-body">
              <button className="menu-item" onClick={() => exportResultsCsv(ds, store)}>
                검사 결과 CSV ↓
              </button>
              <button className="menu-item" onClick={() => exportJson(ds, store)}>
                기록 JSON ↓
              </button>
              <button className="menu-item" onClick={() => fileInput.current?.click()}>
                기록 JSON 가져오기
              </button>
            </div>
          </details>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={pickFile} />
        </>
      )}
    </header>
  );
}
