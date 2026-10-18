import { evaluateCheck, limitsOf, round } from '../../core/criteria.js';

const fmt = (v) => String(round(v, 3));

// 측정 항목: 허용 범위와 입력값을 막대 위에 표시 (값이 범위 안인지 한눈에)
export default function Gauge({ check, item, value }) {
  const { nominal, min, max } = limitsOf(check, item);
  if (nominal === null || (min === undefined && max === undefined)) return null;
  const u = check.unit ? ` ${check.unit}` : '';
  const n = value === undefined || value === '' ? null : Number(value);
  const ok = n === null ? null : evaluateCheck(check, value, item);
  if (min !== undefined && max !== undefined && max > min) {
    const pad = (max - min) * 0.6;
    const lo = min - pad;
    const hi = max + pad;
    const pos = (x) => `${Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))}%`;
    const d = n === null ? null : n - (nominal ?? (min + max) / 2);
    return (
      <div className="gauge" aria-hidden="true">
        <div className="g-track">
          <span className="g-ok" style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }} />
          {nominal !== undefined && <span className="g-nom" style={{ left: pos(nominal) }} />}
          {n !== null && <span className={`g-val ${ok ? 'ok' : 'bad'}`} style={{ left: pos(n) }} />}
        </div>
        <div className="g-scale">
          <span style={{ left: pos(min) }}>{fmt(min)}</span>
          <span style={{ left: pos(max) }}>{fmt(max)}</span>
        </div>
        {d !== null && (
          <p className={`g-dev ${ok ? 'ok' : 'bad'}`}>
            {d >= 0 ? '+' : '−'}
            {fmt(Math.abs(d))}
            {u} · 허용 ±{fmt((max - min) / 2)}
            {u}
          </p>
        )}
      </div>
    );
  }
  // 한쪽 기준(이상) 또는 정확히 맞아야 하는 값
  if (n === null) return null;
  if (max === undefined) {
    const d = n - min;
    return <p className={`g-dev ${ok ? 'ok' : 'bad'}`}>{d >= 0 ? `기준보다 +${fmt(d)}${u} 여유` : `기준보다 ${fmt(-d)}${u} 부족`}</p>;
  }
  const d = n - nominal;
  return <p className={`g-dev ${ok ? 'ok' : 'bad'}`}>{d === 0 ? '기준과 같음' : `기준보다 ${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${u} (정확히 ${fmt(nominal)}${u} 이어야 함)`}</p>;
}
