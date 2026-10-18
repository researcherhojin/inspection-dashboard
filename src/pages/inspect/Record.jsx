// 기록 칸: 항목 정보, 검사 기준별 입력, 자동 확인, 보류 · 사유, 문서
import { useRef } from 'react';
import { datasetUrl } from '../../io/loadDataset.js';
import { applies } from '../../core/criteria.js';
import { autoResults } from '../../core/autoRules.js';
import { isExcluded, recipeFor, statusOf } from '../../core/status.js';
import { StatusMark } from '../../components/Status.jsx';
import CheckRow from './CheckRow.jsx';

export default function Record({ ds, store, refId, onNext }) {
  const box = useRef(null);
  if (!refId) {
    return (
      <section className="record" aria-label="기록">
        <div className="record-empty">
          <p>왼쪽 목록이나 도면에서 항목을 고르세요.</p>
          <ol>
            <li>항목을 고르면 도면에 파란 칸으로 위치가 표시됩니다.</li>
            <li>여기에 그 항목의 검사 기준이 나옵니다. 측정값을 넣거나 이상 없음 / 이상을 누릅니다.</li>
            <li>다 채우면 자동으로 판정되고, [다음 미검사]로 이어 갑니다.</li>
          </ol>
          <button className="btn primary" onClick={onNext}>
            남은 첫 항목 열기 <kbd>N</kbd>
          </button>
        </div>
      </section>
    );
  }
  const it = ds.items[refId];
  if (!it) {
    return (
      <section className="record" aria-label="기록">
        <div className="r-head">
          <h2 className="ref">{refId}</h2>
        </div>
        <p className="notice warn">도면에는 있지만 목록(items.csv)에 없는 위치입니다.</p>
      </section>
    );
  }

  const r = store.results[refId] || { checks: {} };
  const st = statusOf(ds, store.templates, it, r);
  const recipe = recipeFor(store.templates, it);
  const excluded = isExcluded(ds, it);
  const docs = it.docIds.map((d) => ds.docsById[d]).filter(Boolean);
  const reasons = ds.recipes.reasons || [];
  const autos = autoResults(ds, it);
  const pin1 = (ds.placementsByRef[refId] || []).find((p) => p.pin1)?.pin1 || null;
  const kinds = { measure: 0, look: 0, na: 0 };
  for (const c of recipe?.checks || []) {
    if (!applies(c, it)) kinds.na++;
    else if (c.type === 'number') kinds.measure++;
    else kinds.look++;
  }

  // Enter: 다음 빈 입력칸으로
  const focusNext = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...box.current.querySelectorAll('.check input')];
    const i = inputs.indexOf(e.target);
    const next = inputs.slice(i + 1).find((x) => x.value === '') || inputs[i + 1];
    if (next) next.focus();
    else e.target.blur();
  };

  return (
    <section className="record" aria-label="기록" ref={box}>
      <div className="r-scroll">
        <div className="r-head">
          <h2 className="ref">{refId}</h2>
          <StatusMark s={st} word />
        </div>
        <p className="r-name">{it.name}</p>
        <p className="muted small">
          {it.category}
          {it.spec ? ` · ${it.spec}` : ''}
          {it.value && it.value !== it.name ? ` · ${it.value}` : ''}
        </p>

        {it.review && <p className="notice warn">도면 확인 필요 · {it.review}</p>}
        {!store.inspector && (
          <p className="hint">
            검사자 이름이 비어 있어 기록에 이름이 남지 않습니다.{' '}
            <button className="link" onClick={() => document.getElementById('inspector-input')?.focus()}>
              입력
            </button>
          </p>
        )}

        {excluded ? (
          <p className="notice">검사 제외 분류입니다 (recipes.json 의 exclude).</p>
        ) : !recipe ? (
          <p className="notice warn">이 분류에는 검사 기준이 없습니다 (recipes.json).</p>
        ) : (
          <div className="checks">
            <div className="checks-head">
              <div>
                <h3>{recipe.label}</h3>
                <p className="kinds">
                  {kinds.measure > 0 && <span className="kind measure">측정 {kinds.measure}</span>}
                  {kinds.look > 0 && <span className="kind look">육안 {kinds.look}</span>}
                  {kinds.na > 0 && <span className="kind auto">해당 없음 {kinds.na}</span>}
                </p>
              </div>
              <button className="btn ghost small" onClick={() => store.setAllChecksOk(refId, recipe)} disabled={!recipe.checks.some((c) => c.type === 'check' && applies(c, it) && r.checks?.[c.id] === undefined)}>
                빈 칸 모두 이상 없음 <kbd>A</kbd>
              </button>
            </div>
            {recipe.checks.map((c) => (
              <CheckRow key={c.id} check={c} item={it} pin1={pin1} value={r.checks?.[c.id]} onChange={(v) => store.setCheck(refId, c.id, v)} onKeyDown={focusNext} />
            ))}
          </div>
        )}

        {autos.length > 0 && (
          <div className="autos">
            <h3>
              자동 확인 <span className="muted small">데이터끼리 비교 · 사람이 볼 필요 없음</span>
            </h3>
            {autos.map((a) => (
              <p key={a.id} className={`auto-row ${a.result.ok ? 'ok' : 'bad'}`}>
                <span className="kind auto">자동</span>
                <span className="a-label">{a.label}</span>
                <span className={`st ${a.result.ok ? 'st-pass' : 'st-fail'}`}>
                  <i aria-hidden="true">{a.result.ok ? '✓' : '✕'}</i>
                  {a.result.ok ? '일치' : '불일치'}
                </span>
                <span className="a-text">{a.result.text}</span>
              </p>
            ))}
          </div>
        )}

        {!excluded && recipe && (
          <div className="judge">
            <label className="toggle">
              <input type="checkbox" checked={r.manual === 'hold'} onChange={(e) => store.setManual(refId, e.target.checked ? 'hold' : null)} /> 보류 (판단 보류 · 재확인 필요)
            </label>
            {(st === 'fail' || st === 'hold') && (
              <div className="reason">
                <select value={r.reason || ''} onChange={(e) => store.setReason(refId, e.target.value || undefined)} aria-label="사유" className={r.reason ? '' : 'need'}>
                  <option value="">사유 선택</option>
                  {reasons.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <input value={r.note || ''} onChange={(e) => store.setNote(refId, e.target.value || undefined)} placeholder="메모" aria-label="메모" />
              </div>
            )}
          </div>
        )}

        {docs.length > 0 && (
          <div className="docs">
            <h3>문서</h3>
            <ul>
              {docs.map((d) => (
                <li key={d.doc_id}>
                  <a href={/^https?:/.test(d.url) ? d.url : datasetUrl(ds.id, d.url)} target="_blank" rel="noreferrer">
                    {d.title}
                  </a>{' '}
                  <span className="muted small">{d.type}</span>
                  {d.summary && <p className="muted small">{d.summary}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.updatedAt && (
          <p className="muted small stamp">
            기록 {new Date(r.updatedAt).toLocaleString('ko-KR')}
            {r.inspector ? ` · ${r.inspector}` : ''}
          </p>
        )}
      </div>

      <p className="r-keys">
        <kbd>A</kbd> 빈 칸 모두 이상 없음 · <kbd>Enter</kbd> 다음 칸 · <kbd>N</kbd> 다음 미검사 · <kbd>Ctrl+Z</kbd> 되돌리기
      </p>
      <div className="r-foot">
        <StatusMark s={st} word />
        <span className="grow" />
        <button className="btn primary" onClick={onNext}>
          다음 미검사 <kbd>N</kbd>
        </button>
      </div>
    </section>
  );
}
