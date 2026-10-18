// 검사 항목 한 줄: 측정 / 육안 / 자동(해당 없음) 표시, 기준, 맞춰 볼 값, 1번 패드, 입력
import { applies, criterionText, evaluateCheck, expectedValue, whenText } from '../../core/criteria.js';
import Gauge from './Gauge.jsx';

export default function CheckRow({ check, item, pin1, value, onChange, onKeyDown }) {
  if (!applies(check, item)) {
    return (
      <div className="check na">
        <div className="c-label">
          <span className="c-name">
            <span className="kind auto">자동</span>
            {check.label}
          </span>
          <span className="c-method">해당 없음 — 이 항목은 {whenText(check)} 만 검사</span>
        </div>
        <span className="na-word">해당 없음</span>
      </div>
    );
  }
  const v = evaluateCheck(check, value, item);
  const cls = v === true ? 'ok' : v === false ? 'bad' : '';
  const expect = expectedValue(check, item);
  const kind = check.type === 'number' ? 'measure' : 'look';
  return (
    <div className={`check ${cls}`}>
      <div className="c-main">
        <div className="c-label">
          <span className="c-name">
            <span className={`kind ${kind}`}>{kind === 'measure' ? '측정' : '육안'}</span>
            {check.label}
          </span>
          <span className="c-crit">{criterionText(check, item)}</span>
          {expect && (
            <span className="c-expect">
              맞춰 볼 값 <b>{expect}</b>
            </span>
          )}
          {check.marker === 'pin1' && pin1 && (
            <span className="c-expect">
              도면의 <b className="pin1-mark">◆</b> = 1번 패드{pin1.label ? ` (${pin1.label})` : ''}
            </span>
          )}
          {check.method && <span className="c-method">{check.method}</span>}
        </div>
        {check.type === 'number' ? (
          <span className="c-num">
            <input type="number" step="any" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} onKeyDown={onKeyDown} aria-label={check.label} />
            {check.unit && <em>{check.unit}</em>}
          </span>
        ) : check.type === 'check' ? (
          <span className="c-tri" role="group" aria-label={check.label}>
            <button className={value === true ? 'on ok' : ''} onClick={() => onChange(value === true ? undefined : true)}>
              이상 없음
            </button>
            <button className={value === false ? 'on bad' : ''} onClick={() => onChange(value === false ? undefined : false)}>
              이상
            </button>
          </span>
        ) : check.type === 'select' ? (
          <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label={check.label}>
            <option value="">선택</option>
            {(check.options || []).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} onKeyDown={onKeyDown} aria-label={check.label} />
        )}
      </div>
      {check.type === 'number' && <Gauge check={check} item={item} value={value} />}
    </div>
  );
}
