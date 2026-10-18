import { STATUS } from '../core/status.js';

// 만든 사람의 한계를 화면에 밝혀 둠 (현황 · 성적서 하단, 사용 방법 창)
export const DOMAIN_NOTE = '이 대시보드는 공개된 오픈소스 데이터로 만든 예시입니다. 만든 사람에게 PCB 실장 검사와 용접 · 가공 검사의 현장 지식이 부족해, 검사 항목과 판정 기준(공차, 확인 방법)을 엄밀하게 다듬지는 못했습니다. 실제 검사에 쓰려면 해당 분야 전문가가 기준을 검토하고 보완해야 합니다.';

// 상태는 색 + 기호 + 글자로 (색만으로 구분하지 않음)
export const MARK = { todo: '○', progress: '◐', pass: '✓', fail: '✕', hold: '∥', excluded: '–' };

export function StatusMark({ s, word = false }) {
  return (
    <span className={`st st-${s}`} title={STATUS[s]?.label}>
      <i aria-hidden="true">{MARK[s]}</i>
      {word ? <span>{STATUS[s]?.label}</span> : <span className="sr-only">{STATUS[s]?.label}</span>}
    </span>
  );
}

// 합격 · 불합격 · 보류 · 남음 을 한 줄 막대로
export function ProgressBar({ s }) {
  const left = s.todo + s.progress;
  return (
    <div className="pbar" role="img" aria-label={`합격 ${s.pass}, 불합격 ${s.fail}, 보류 ${s.hold}, 남음 ${left}`}>
      {[
        ['pass', s.pass],
        ['fail', s.fail],
        ['hold', s.hold],
      ].map(([k, n]) => n > 0 && <span key={k} className={`st-${k}`} style={{ flexGrow: n }} />)}
      {left > 0 && <span className="rest" style={{ flexGrow: left }} />}
    </div>
  );
}
