// 성적서: 인쇄용 한 장 — 요약 · 불합격/보류 · 전체 판정표
import { applies, criterionText, evaluateCheck } from '../core/criteria.js';
import { STATUS, recipeFor, statusOf } from '../core/status.js';
import { exportResultsCsv } from '../io/exporters.js';
import { StatusMark } from '../components/Status.jsx';

const ORDER = { fail: 0, hold: 1, progress: 2, todo: 3, pass: 4 };

export default function Report({ ds, store, kpis, onOpen }) {
  const s = kpis.status;
  const rows = Object.values(ds.items)
    .map((it) => {
      const r = store.results[it.ref] || {};
      const st = statusOf(ds, store.templates, it, r);
      const recipe = recipeFor(store.templates, it);
      const values = recipe
        ? recipe.checks
            .filter((c) => r.checks?.[c.id] !== undefined || (!applies(c, it) && r.checks))
            .map((c) => {
              if (!applies(c, it)) return `${c.label} 해당 없음`;
              const v = r.checks[c.id];
              return `${c.label} ${v === true ? '이상 없음' : v === false ? '이상' : `${v}${c.unit ? ` ${c.unit}` : ''}`}`;
            })
        : [];
      return { it, r, st, values };
    })
    .filter((x) => x.st !== 'excluded')
    .sort((a, b) => ORDER[a.st] - ORDER[b.st] || a.it.ref.localeCompare(b.it.ref, undefined, { numeric: true }));
  const problems = rows.filter((x) => x.st === 'fail' || x.st === 'hold');
  const today = new Date().toLocaleDateString('ko-KR');

  return (
    <div className="report">
      <div className="report-actions no-print">
        <button className="btn primary" onClick={() => window.print()}>
          인쇄 · PDF
        </button>
        <button className="btn ghost" onClick={() => exportResultsCsv(ds, store)}>
          CSV ↓
        </button>
      </div>

      <article className="sheet">
        <header className="sheet-head">
          <div>
            <h2>검사 성적서</h2>
            <p>{ds.meta.name}</p>
          </div>
          <dl>
            <dt>작성일</dt>
            <dd>{today}</dd>
            <dt>검사자</dt>
            <dd>{store.inspector || '—'}</dd>
          </dl>
        </header>

        <dl className="sheet-sum">
          {[
            ['대상', kpis.total - s.excluded],
            [STATUS.pass.label, s.pass],
            [STATUS.fail.label, s.fail],
            [STATUS.hold.label, s.hold],
            ['미검사', s.todo + s.progress],
            ['검사 제외', s.excluded],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <h3>불합격 · 보류 {problems.length}건</h3>
        {problems.length === 0 ? (
          <p className="muted">없음</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>번호</th>
                <th>이름</th>
                <th>판정</th>
                <th>벗어난 항목 (기준)</th>
                <th>사유 · 메모</th>
              </tr>
            </thead>
            <tbody>
              {problems.map(({ it, r, st }) => {
                const recipe = recipeFor(store.templates, it);
                const out = recipe ? recipe.checks.filter((c) => evaluateCheck(c, r.checks?.[c.id], it) === false) : [];
                return (
                  <tr key={it.ref}>
                    <td>
                      <button className="link ref" onClick={() => onOpen(it.ref)}>
                        {it.ref}
                      </button>
                    </td>
                    <td>{it.name}</td>
                    <td>
                      <StatusMark s={st} word />
                    </td>
                    <td>
                      {out.map((c) => (
                        <div key={c.id}>
                          {c.label} {r.checks[c.id] === false ? '이상' : `${r.checks[c.id]}${c.unit ? ` ${c.unit}` : ''}`} <span className="muted">({criterionText(c, it)})</span>
                        </div>
                      ))}
                    </td>
                    <td>
                      {r.reason || <span className="warn">사유 없음</span>}
                      {r.note ? ` · ${r.note}` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <h3>전체 판정</h3>
        <table className="table compact">
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
              <th>분류</th>
              <th>판정</th>
              <th>기록값</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ it, st, values }) => (
              <tr key={it.ref}>
                <td className="ref">{it.ref}</td>
                <td>{it.name}</td>
                <td>{it.category}</td>
                <td>
                  <StatusMark s={st} word />
                </td>
                <td className="small">{values.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="sheet-foot">
          <p className="muted small">판정은 recipes.json 의 기준(도면 치수 ± 공차)에 따른 규칙 판정입니다.</p>
          <div className="sign">
            <span>검사</span>
            <i />
            <span>확인</span>
            <i />
          </div>
        </footer>
      </article>
    </div>
  );
}
