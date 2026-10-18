// 사용 방법: 처음 쓰는 사람이 "무엇을 어떤 순서로 누르는지" 알 수 있게
import { useEffect, useRef } from 'react';
import { DOMAIN_NOTE, MARK } from './Status.jsx';

export const STEPS = [
  { title: '검사 시작', text: '현황에서 [검사 시작]을 누르면 남은 첫 항목이 열립니다.' },
  { title: '위치 확인', text: '가운데 도면의 파란 칸이 그 항목입니다. 휠로 확대, 끌어서 이동.' },
  { title: '기록', text: '오른쪽 기준을 보고 측정값을 넣거나 [이상 없음]/[이상]을 누르면 자동 판정됩니다.' },
  { title: '다음 · 마무리', text: '[다음 미검사]로 이어 가고, 끝나면 성적서를 인쇄합니다.' },
];

const KEYS = [
  ['N', '다음 미검사 항목'],
  ['A', '‘이상 유무’ 빈 칸을 모두 이상 없음으로'],
  ['Enter', '수치 입력 중 다음 빈 칸으로'],
  ['J / K', '목록에서 다음 / 이전 항목'],
  ['/', '목록 검색'],
  ['Ctrl(⌘) + Z', '방금 기록 되돌리기'],
];

export default function Guide({ onClose, has3d }) {
  const box = useRef(null);
  // 열리면 창에 초점, Esc 로 닫기 (키보드 이벤트는 외부 시스템 → Effect)
  useEffect(() => {
    box.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="guide" role="dialog" aria-modal="true" aria-label="사용 방법" tabIndex={-1} ref={box} onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <h2>사용 방법</h2>
          <button className="btn ghost small" onClick={onClose}>
            닫기 <kbd>Esc</kbd>
          </button>
        </div>

        <h3>화면</h3>
        <dl className="guide-screens">
          <dt>현황</dt>
          <dd>얼마나 했는지, 분류별 진행, 검사 전에 확인할 것. 처음 들어오면 여기서 시작합니다.</dd>
          <dt>검사</dt>
          <dd>왼쪽 목록 · 가운데 도면 · 오른쪽 기록. 실제 검사는 이 화면에서 합니다.</dd>
          <dt>성적서</dt>
          <dd>판정 결과를 한 장으로 정리해 인쇄하거나 PDF 로 저장합니다.</dd>
        </dl>

        <h3>검사 순서</h3>
        <ol className="guide-steps">
          <li>
            오른쪽 위 <b>검사자</b>에 이름을 넣습니다. 기록마다 이름과 시각이 남습니다.
          </li>
          <li>
            <b>현황</b>에서 <b>검사 시작</b>을 누르면 남은 첫 항목이 열립니다. 목록에서 직접 골라도 됩니다.
          </li>
          <li>
            <b>도면</b>의 파란 칸이 그 항목의 위치입니다. 휠로 확대하고 끌어서 옮깁니다. 뒷면·다른 시트에 있으면 도면이 자동으로 바뀝니다.
            {has3d && ' [3D]를 누르면 실물 모양에서 위치를 볼 수 있습니다.'}
          </li>
          <li>
            <b>기록</b>에서 항목마다 기준(예: <code>55 ± 0.5 in</code>)을 보고 측정값을 넣거나 <b>이상 없음 / 이상</b>을 누릅니다. 모두 채우면 자동으로 판정됩니다.
          </li>
          <li>
            불합격이면 <b>사유</b>를 고릅니다. 판단이 어려우면 <b>보류</b>에 체크합니다.
          </li>
          <li>
            <b>다음 미검사</b>로 다음 항목을 엽니다. 다 끝나면 <b>성적서</b>에서 인쇄합니다.
          </li>
        </ol>

        <h3>검사 항목의 종류</h3>
        <dl className="guide-screens kinds-legend">
          <dt>
            <span className="kind measure">측정</span>
          </dt>
          <dd>측정기로 잰 값을 넣습니다. 막대에 허용 범위(초록)와 넣은 값이 표시되고, 기준과의 차이를 바로 보여 줍니다.</dd>
          <dt>
            <span className="kind look">육안</span>
          </dt>
          <dd>
            눈으로 보고 이상 없음 / 이상을 고릅니다. <b>맞춰 볼 값</b>(품번 · 규격)과 도면의 <b className="pin1-mark">◆</b>(1번 패드 · 극성 위치)를 참고합니다.
          </dd>
          <dt>
            <span className="kind auto">자동</span>
          </dt>
          <dd>사람이 할 필요가 없는 것. 해당 없는 항목은 자동으로 빼고, 데이터끼리 맞는지(BOM ↔ CAD, 도면명 ↔ 치수)는 자동으로 비교합니다.</dd>
        </dl>

        <h3>상태 표시</h3>
        <p className="guide-legend">
          <span className="st st-pass">
            <i>{MARK.pass}</i> 합격
          </span>
          <span className="st st-fail">
            <i>{MARK.fail}</i> 불합격
          </span>
          <span className="st st-hold">
            <i>{MARK.hold}</i> 보류
          </span>
          <span className="st st-progress">
            <i>{MARK.progress}</i> 검사 중
          </span>
          <span className="st st-todo">
            <i>{MARK.todo}</i> 미검사
          </span>
          <span className="st st-excluded">
            <i>{MARK.excluded}</i> 검사 제외
          </span>
        </p>

        <h3>단축키 (검사 화면)</h3>
        <table className="table kv">
          <tbody>
            {KEYS.map(([k, d]) => (
              <tr key={k}>
                <th>
                  <kbd>{k}</kbd>
                </th>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted small guide-note">
          {DOMAIN_NOTE}
          <br />
          기록은 이 브라우저에 자동 저장됩니다. 다른 PC 로 옮길 때는 <b>더보기 → 기록 JSON</b>. 판정은 입력값에 대한 규칙 판정이며 AI 판정이 아닙니다.
        </p>
      </div>
    </div>
  );
}
