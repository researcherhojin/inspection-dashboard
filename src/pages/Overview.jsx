// 현황: 얼마나 했나 · 분류별로 어디까지 · 지금 확인할 것
import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { datasetUrl } from '../io/loadDataset.js';
import { getPref, setPref } from '../io/prefs.js';
import { autoResults } from '../core/autoRules.js';
import { prepIssuesOf, recipeFor, statusOf } from '../core/status.js';
import { ProgressBar, StatusMark } from '../components/Status.jsx';
import { STEPS } from '../components/Guide.jsx';

const ModelViewer = lazy(() => import('../components/ModelViewer.jsx'));

export default function Overview({ ds, store, kpis, onStart, onOpen, onGuide }) {
  const [hideHow, setHideHow] = useState(() => getPref('hide-how', '0') === '1');
  const toggleHow = (v) => {
    setHideHow(v);
    setPref('hide-how', v ? '1' : '0');
  };
  const { meta } = ds;
  const s = kpis.status;
  const inspectable = kpis.total - s.excluded;
  const done = s.pass + s.fail;
  const left = s.todo + s.progress;
  const pct = inspectable ? Math.round((done / inspectable) * 100) : 0;

  const { cats, attention } = useMemo(() => {
    const cats = new Map();
    const problems = [];
    const review = [];
    const notReady = [];
    const auto = [];
    let autoChecked = 0;
    for (const it of Object.values(ds.items)) {
      const r = store.results[it.ref];
      const st = statusOf(ds, store.templates, it, r);
      const recipe = recipeFor(store.templates, it);
      const c = cats.get(it.category) || { n: 0, done: 0, fail: 0, hold: 0, recipe: recipe?.label, excluded: st === 'excluded' };
      c.n++;
      if (st === 'pass' || st === 'fail') c.done++;
      if (st === 'fail') c.fail++;
      if (st === 'hold') c.hold++;
      cats.set(it.category, c);
      if (st === 'fail' || st === 'hold') problems.push({ it, st, text: r?.reason || '사유 없음', warn: !r?.reason });
      for (const a of st === 'excluded' ? [] : autoResults(ds, it)) {
        autoChecked++;
        if (!a.result.ok) auto.push({ it, st, text: `${a.label} · ${a.result.text}`, warn: true });
      }
      const issues = prepIssuesOf(ds, store.templates, it);
      if (issues.includes('review')) review.push({ it, st, text: it.review });
      if (issues.includes('no_placement') || issues.includes('no_recipe'))
        notReady.push({ it, st, text: [issues.includes('no_placement') && '도면 위치 없음', issues.includes('no_recipe') && '검사 기준 없음'].filter(Boolean).join(' · ') });
    }
    return {
      cats: [...cats.entries()].sort((a, b) => a[1].excluded - b[1].excluded || b[1].n - a[1].n),
      attention: [
        { key: 'problems', title: '불합격 · 보류', rows: problems, empty: '없음' },
        { key: 'review', title: '도면 확인 필요', rows: review, empty: '없음' },
        { key: 'notready', title: '검사 준비 안 됨', rows: notReady, empty: '없음' },
        ...(autoChecked ? [{ key: 'auto', title: '자동 확인 불일치', rows: auto, empty: `없음 · 데이터끼리 ${autoChecked}건 자동 비교함` }] : []),
      ],
    };
  }, [ds, store.templates, store.results]);

  const statusFn = useCallback((ref) => (ds.items[ref] ? statusOf(ds, store.templates, ds.items[ref], store.results[ref]) : null), [ds, store.templates, store.results]);
  const withDoc = Object.values(ds.items).filter((it) => it.docIds.length).length;

  return (
    <div className="overview">
      <section className="ov-head">
        <div>
          <p className="muted">{meta.domain}</p>
          <h2>{meta.name}</h2>
          {meta.description && <p className="desc">{meta.description}</p>}
        </div>
        <button className="btn primary" onClick={onStart} disabled={left === 0}>
          {left ? `검사 시작 · 남은 ${left}건` : '모두 판정함'}
        </button>
      </section>

      {hideHow ? (
        <p className="how-min">
          <button className="link" onClick={() => toggleHow(false)}>
            검사하는 방법 보기
          </button>
        </p>
      ) : (
        <section className="how" aria-label="검사하는 방법">
          <div className="how-head">
            <h3>검사하는 방법</h3>
            <span className="grow" />
            <button className="link" onClick={onGuide}>
              자세한 사용 방법
            </button>
            <button className="link muted" onClick={() => toggleHow(true)}>
              숨기기
            </button>
          </div>
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <b>
                  <span className="n">{i + 1}</span>
                  {s.title}
                </b>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="ov-stats" aria-label="진행">
        <div className="stat big">
          <b>{pct}%</b>
          <span>
            판정 {done} / {inspectable}
          </span>
        </div>
        <div className="stat">
          <b>{s.pass}</b>
          <StatusMark s="pass" word />
        </div>
        <div className="stat">
          <b className={s.fail ? 'bad' : ''}>{s.fail}</b>
          <StatusMark s="fail" word />
        </div>
        <div className="stat">
          <b>{s.hold}</b>
          <StatusMark s="hold" word />
        </div>
        <div className="stat">
          <b>{left}</b>
          <StatusMark s="todo" word />
        </div>
        <ProgressBar s={s} />
      </section>

      <div className="ov-cols">
        <section>
          <h3>분류별 진행</h3>
          <table className="table">
            <thead>
              <tr>
                <th>분류</th>
                <th className="num">대상</th>
                <th>검사 기준</th>
                <th>진행</th>
              </tr>
            </thead>
            <tbody>
              {cats.map(([cat, c]) => (
                <tr key={cat} className={c.excluded ? 'dim' : ''}>
                  <td>{cat}</td>
                  <td className="num">{c.n}</td>
                  <td>{c.excluded ? '검사 제외' : c.recipe || <span className="warn">없음</span>}</td>
                  <td>
                    {!c.excluded && (
                      <span className="mini">
                        <span className="track">
                          <i style={{ width: `${(c.done / c.n) * 100}%` }} />
                        </span>
                        {c.done}/{c.n}
                        {c.fail > 0 && <b className="bad"> · 불합격 {c.fail}</b>}
                        {c.hold > 0 && <b className="warn"> · 보류 {c.hold}</b>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="attention">
          <h3>확인할 것</h3>
          {attention.map((g) => (
            <div key={g.key} className="att-group" data-group={g.key}>
              <h4>
                {g.title} <span className="muted">{g.rows.length}</span>
              </h4>
              {g.rows.length === 0 ? (
                <p className="muted small">{g.empty}</p>
              ) : (
                <ul>
                  {g.rows.map(({ it, st, text, warn }) => (
                    <li key={it.ref}>
                      <button onClick={() => onOpen(it.ref)}>
                        <StatusMark s={st} />
                        <span className="ref">{it.ref}</span>
                        <span className="name">{it.name}</span>
                        <span className={`note ${warn ? 'warn' : ''}`}>{text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      </div>

      {meta.model?.url && (
        <section className="ov-3d">
          <h3>
            3D <span className="muted">색은 검사 상태 · 부품을 누르면 검사 화면으로</span>
          </h3>
          <Suspense fallback={<div className="mv-msg">3D 준비 중…</div>}>
            <ModelViewer url={datasetUrl(ds.id, meta.model.url)} statusOf={statusFn} onPick={onOpen} height={420} caption={meta.model.note} />
          </Suspense>
        </section>
      )}

      <details className="ov-source">
        <summary>데이터 출처 · 구성</summary>
        <table className="table kv">
          <tbody>
            <tr>
              <th>출처</th>
              <td>
                {/^https?:/.test(meta.source) ? (
                  <a href={meta.source} target="_blank" rel="noreferrer">
                    {meta.source}
                  </a>
                ) : (
                  meta.source
                )}
                {meta.license && ` · ${meta.license}`}
              </td>
            </tr>
            <tr>
              <th>
                <code>items.csv</code>
              </th>
              <td>검사 대상 {kpis.total}개 · 분류 {cats.length}개</td>
            </tr>
            <tr>
              <th>
                <code>placements.csv</code>
              </th>
              <td>
                도면 위치 {kpis.placed}개 · 도면 {meta.sides.length}장
              </td>
            </tr>
            <tr>
              <th>
                <code>recipes.json</code>
              </th>
              <td>검사 기준 {store.templates.length}종</td>
            </tr>
            <tr>
              <th>
                <code>docs.csv</code>
              </th>
              <td>
                문서 {ds.docs.length}건 · 문서가 연결된 항목 {withDoc}/{kpis.total}
              </td>
            </tr>
            {meta.model?.url && (
              <tr>
                <th>
                  <code>{meta.model.url}</code>
                </th>
                <td>3D 모델</td>
              </tr>
            )}
          </tbody>
        </table>
        {ds.warnings.length > 0 && (
          <ul className="warn small">
            {ds.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
