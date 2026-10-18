// 도면 위 위치 표시 (placements.csv 의 x · y · w · h · side) + 3D 모델(있을 때)
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { datasetUrl } from '../io/loadDataset.js';
import { STATUS, statusOf } from '../core/status.js';

const ModelViewer = lazy(() => import('./ModelViewer.jsx'));

const vbOf = (meta, side) => side?.viewBox || meta.viewBox;

// 요청한 보기 영역을 패널 비율에 맞게 넓혀 빈 여백 없이 표시
function fitAspect(v, aspect) {
  if (!aspect) return v;
  const cx = v[0] + v[2] / 2;
  const cy = v[1] + v[3] / 2;
  let w = v[2];
  let h = v[3];
  if (h / w < aspect) h = w * aspect;
  else w = h / aspect;
  return [cx - w / 2, cy - h / 2, w, h];
}

// 선택한 부품이 보이게 보기 영역 조정: 작은 부품(칩 저항 등)은 점처럼 보이므로 주변이 보일 만큼 확대
function viewFor(meta, sd, target, v) {
  const b = vbOf(meta, sd);
  const x = sd.mirror ? 2 * b[0] + b[2] - target.x : target.x;
  const size = Math.max(target.w, target.h);
  if (size < b[2] * 0.04) {
    const w = Math.min(b[2], Math.max(size * 10, b[2] / 5));
    const a = b[3] / b[2];
    return [x - w / 2, target.y - (w * a) / 2, w, w * a];
  }
  const inside = x > v[0] && x < v[0] + v[2] && target.y > v[1] && target.y < v[1] + v[3];
  return inside ? v : [x - v[2] / 2, target.y - v[3] / 2, v[2], v[3]];
}

export default function Drawing({ ds, store, selectedRef, onSelect }) {
  const { meta } = ds;
  const [mode, setMode] = useState('cad');
  // 링크로 연 항목이 있으면 그 항목이 있는 면(시트)에서 시작
  const [sideId, setSideId] = useState(() => (selectedRef && ds.placementsByRef[selectedRef]?.[0]?.side) || meta.sides[0]?.id);
  const side = meta.sides.find((s) => s.id === sideId) || meta.sides[0];
  const base = vbOf(meta, side);
  const [view, setView] = useState(() => {
    const t = selectedRef && ds.placementsByRef[selectedRef]?.find((p) => p.side === side.id);
    return t ? viewFor(meta, side, t, base) : base;
  });
  const [loaded, setLoaded] = useState(null);
  const [aspect, setAspect] = useState(null);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setAspect(height / width);
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [mode]);

  const shown = fitAspect(view, aspect);
  // 뒷면은 뒤에서 본 모습으로 좌우 반전
  const mirrorX = (sd, b, x) => (sd.mirror ? 2 * b[0] + b[2] - x : x);
  const mx = (x) => mirrorX(side, base, x);

  const changeSide = (id) => {
    const next = meta.sides.find((s) => s.id === id);
    setSideId(id);
    setView(vbOf(meta, next));
  };

  const onSide = useMemo(() => ds.placements.filter((p) => p.side === side.id), [ds, side]);
  const selPls = selectedRef ? ds.placementsByRef[selectedRef] || [] : [];
  const selHere = selPls.filter((p) => p.side === side.id);

  // 선택이 바뀌면: 다른 면에 있으면 면 전환, 화면 밖이면 가운데로 (렌더 중 상태 조정)
  const [prevSel, setPrevSel] = useState(selectedRef);
  if (selectedRef !== prevSel) {
    setPrevSel(selectedRef);
    if (selPls.length) {
      let target = selPls.find((p) => p.side === side.id);
      let sd = side;
      let v = view;
      if (!target) {
        target = selPls[0];
        sd = meta.sides.find((s) => s.id === target.side) || side;
        v = vbOf(meta, sd);
        setSideId(sd.id);
      }
      setView(viewFor(meta, sd, target, v));
    }
  }

  const toSvg = (cx, cy) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  // 휠 확대/축소 (기본 스크롤을 막아야 해서 passive: false 로 직접 등록)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      setView((v) => {
        const w = Math.min(Math.max(v[2] * f, base[2] / 60), base[2] * 1.5);
        const k = w / v[2];
        return [p.x - (p.x - v[0]) * k, p.y - (p.y - v[1]) * k, w, v[3] * k];
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [base, mode]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    drag.current = { start: toSvg(e.clientX, e.clientY), cx: e.clientX, cy: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 4) return;
    d.moved = true;
    const p = toSvg(e.clientX, e.clientY);
    setView((v) => [v[0] - (p.x - d.start.x), v[1] - (p.y - d.start.y), v[2], v[3]]);
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // 클릭한 곳의 가장 작은 영역을 선택
    const p = toSvg(e.clientX, e.clientY);
    const hits = onSide.filter((pl) => Math.abs(p.x - mx(pl.x)) <= pl.w / 2 && Math.abs(p.y - pl.y) <= pl.h / 2);
    if (hits.length) {
      hits.sort((a, b) => a.w * a.h - b.w * b.h);
      onSelect(hits[0].ref);
    }
  };

  const zoomToSelection = () => {
    if (!selHere.length) return;
    const p = selHere[0];
    const size = Math.min(Math.max(Math.max(p.w, p.h) * 1.8, base[2] / 6), base[2]);
    const a = base[3] / base[2];
    setView([mx(p.x) - size / 2, p.y - (size * a) / 2, size, size * a]);
  };

  const statusFn = useCallback((ref) => (ds.items[ref] ? statusOf(ds, store.templates, ds.items[ref], store.results[ref]) : null), [ds, store.templates, store.results]);
  const fontSize = shown[2] / 55;
  const has3d = !!meta.model?.url;

  return (
    <section className="drawing" aria-label="도면">
      <div className="d-tools">
        {has3d && (
          <div className="seg">
            <button className={mode === 'cad' ? 'on' : ''} onClick={() => setMode('cad')}>
              도면
            </button>
            <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>
              3D
            </button>
          </div>
        )}
        {mode === 'cad' && (
          <>
            <select value={side.id} onChange={(e) => changeSide(e.target.value)} aria-label="도면 선택">
              {meta.sides.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.mirror ? ' (뒤에서 본 모습)' : ''}
                </option>
              ))}
            </select>
            <span className="grow" />
            <button className="btn ghost small" onClick={zoomToSelection} disabled={!selHere.length}>
              선택 확대
            </button>
            <button className="btn ghost small" onClick={() => setView(base)}>
              전체
            </button>
          </>
        )}
      </div>

      {mode === 'cad' ? (
        <div className="canvas">
          {side.drawing && loaded !== side.drawing && <div className="canvas-msg">도면 불러오는 중…</div>}
          <div className="svg-wrap">
          <svg ref={svgRef} viewBox={shown.join(' ')} preserveAspectRatio="xMidYMid meet" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setHover(null)}>
            {side.drawing ? (
              <image
                key={side.drawing /* 시트가 바뀌면 새 요소 — 이전 도면이 남아 보이지 않게 */}
                onLoad={() => setLoaded(side.drawing)}
                opacity={loaded === side.drawing ? 1 : 0}
                href={datasetUrl(ds.id, side.drawing)}
                x={base[0]}
                y={base[1]}
                width={base[2]}
                height={base[3]}
                preserveAspectRatio="none"
                transform={side.mirror ? `matrix(-1 0 0 1 ${2 * base[0] + base[2]} 0)` : undefined}
              />
            ) : (
              <rect x={base[0]} y={base[1]} width={base[2]} height={base[3]} className="no-drawing" />
            )}
            {onSide.map((p, i) => {
              const it = ds.items[p.ref];
              const st = it ? statusOf(ds, store.templates, it, store.results[p.ref]) : 'orphan';
              return (
                <rect
                  key={`${p.ref}-${i}`}
                  className={`area st-${st} ${p.ref === selectedRef ? 'sel' : ''}`}
                  x={mx(p.x) - p.w / 2}
                  y={p.y - p.h / 2}
                  width={p.w}
                  height={p.h}
                  vectorEffect="non-scaling-stroke"
                  onPointerEnter={() => setHover(p)}
                  onPointerLeave={() => setHover((h) => (h === p ? null : h))}
                >
                  <title>{`${p.ref} · ${it ? it.name : '목록에 없음'} · ${STATUS[st]?.label || '목록 없음'}`}</title>
                </rect>
              );
            })}
            {selHere
              .filter((p) => p.pin1)
              .map((p, i) => {
                // 1번 패드(극성 · 1번 핀) 위치: CAD 데이터에서 그대로 — 관례로 추측하지 않음
                const r = Math.max(Math.min(p.w, p.h) * 0.22, fontSize * 0.35);
                const cx = mx(p.pin1.x);
                const cy = p.pin1.y;
                return (
                  <g key={`pin1-${i}`} className="pin1" data-ref={p.ref}>
                    <path d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`} vectorEffect="non-scaling-stroke" />
                    <title>{`1번 패드${p.pin1.label ? ` (${p.pin1.label})` : ''}`}</title>
                  </g>
                );
              })}
            {[...selHere, ...(hover && hover.ref !== selectedRef ? [hover] : [])].map((p, i) => (
              <text key={i} className="area-label" x={mx(p.x)} y={p.y - p.h / 2 - fontSize * 0.4} fontSize={fontSize} textAnchor="middle">
                {p.ref}
              </text>
            ))}
          </svg>
          </div>
          <p className="canvas-foot">
            {selectedRef && !selPls.length ? `${selectedRef} 는 도면 위치가 없습니다 · ` : ''}휠 확대 · 끌어서 이동 · 클릭해서 선택
          </p>
        </div>
      ) : (
        <div className="canvas model">
          <Suspense fallback={<div className="canvas-msg">3D 준비 중…</div>}>
            <ModelViewer url={datasetUrl(ds.id, meta.model.url)} selectedRef={selectedRef} statusOf={statusFn} onPick={onSelect} height="100%" />
          </Suspense>
          <p className="canvas-foot">끌어서 회전 · 휠 확대 · 부품 클릭으로 선택 · 색은 검사 상태</p>
        </div>
      )}
    </section>
  );
}
