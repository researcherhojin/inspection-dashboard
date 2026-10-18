// 검사 대상 목록: 분류별, 검색, 전체 / 남음 / 불합격·보류
import { useEffect, useMemo, useRef, useState } from 'react';
import { statusOf } from '../../core/status.js';
import { StatusMark } from '../../components/Status.jsx';

const FILTERS = [
  { id: 'all', label: '전체', test: () => true },
  { id: 'left', label: '남음', test: (st) => st === 'todo' || st === 'progress' },
  { id: 'problem', label: '불합격·보류', test: (st) => st === 'fail' || st === 'hold' },
];

export default function ItemList({ ds, store, selectedRef, onSelect }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const selRow = useRef(null);

  const rows = useMemo(() => {
    const status = (ref) => statusOf(ds, store.templates, ds.items[ref], store.results[ref]);
    const cats = new Map();
    for (const g of ds.groups) {
      for (const ref of g.refs) {
        const it = ds.items[ref];
        const c = cats.get(it.category) || { category: it.category, refs: [] };
        c.refs.push({ ref, it, st: status(ref) });
        cats.set(it.category, c);
      }
    }
    return [...cats.values()];
  }, [ds, store.templates, store.results]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, rows.reduce((n, c) => n + c.refs.filter((r) => f.test(r.st)).length, 0)])), [rows]);

  const needle = q.trim().toLowerCase();
  const f = FILTERS.find((x) => x.id === filter);
  const visible = rows
    .map((c) => ({
      ...c,
      refs: c.refs.filter(
        (r) => r.ref === selectedRef || (f.test(r.st) && (!needle || [r.ref, r.it.name, r.it.value, r.it.spec].some((v) => v && v.toLowerCase().includes(needle)))),
      ),
    }))
    .filter((c) => c.refs.length);

  // 선택한 항목이 목록 밖에 있으면 보이게 스크롤 (DOM 은 외부 시스템 → Effect)
  useEffect(() => {
    selRow.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedRef]);

  return (
    <section className="list" aria-label="검사 대상">
      <div className="list-tools">
        <input id="item-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="번호 · 이름 검색 ( / )" aria-label="검색" />
        <div className="seg">
          {FILTERS.map((x) => (
            <button key={x.id} className={filter === x.id ? 'on' : ''} onClick={() => setFilter(x.id)}>
              {x.label} <span className="n">{counts[x.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="list-body">
        {visible.length === 0 && <p className="muted small pad">해당하는 항목이 없습니다.</p>}
        {visible.map((c) => (
          <div key={c.category} className="cat">
            <h3>
              {c.category} <span className="muted">{c.refs.length}</span>
            </h3>
            <ul>
              {c.refs.map(({ ref, it, st }) => (
                <li key={ref}>
                  <button ref={ref === selectedRef ? selRow : null} className={`row ${ref === selectedRef ? 'sel' : ''} ${st === 'excluded' ? 'dim' : ''}`} onClick={() => onSelect(ref)} aria-current={ref === selectedRef || undefined}>
                    <StatusMark s={st} />
                    <span className="ref">{ref}</span>
                    <span className="name">{it.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
