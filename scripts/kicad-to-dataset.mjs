// KiCad .kicad_pcb (+ 선택: .pos.csv) → 검사 대시보드 데이터셋 변환기
//
// 사용법:
//   node scripts/kicad-to-dataset.mjs <board.kicad_pcb> <출력폴더> [board.pos.csv] [--name "표시 이름"] [--source "출처 URL"]
//
// 생성 파일: meta.json, items.csv, placements.csv, docs.csv, recipes.json,
//            drawing-top.svg, drawing-bottom.svg
// recipes.json 은 이미 있으면 덮어쓰지 않습니다 (손으로 고친 검사 기준 보호).

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const displayName = flag('--name');
const sourceUrl = flag('--source');
const [pcbPath, outDir, posPath] = args;
if (!pcbPath || !outDir) {
  console.error('사용법: node scripts/kicad-to-dataset.mjs <board.kicad_pcb> <출력폴더> [board.pos.csv] [--name 이름] [--source URL]');
  process.exit(1);
}

// ---------- S-expression 파서 ----------
function parseSexpr(text) {
  let i = 0;
  const n = text.length;
  function skipWs() {
    while (i < n && /\s/.test(text[i])) i++;
  }
  function parseNode() {
    skipWs();
    if (text[i] === '(') {
      i++;
      const list = [];
      for (;;) {
        skipWs();
        if (text[i] === ')') {
          i++;
          return list;
        }
        list.push(parseNode());
      }
    }
    if (text[i] === '"') {
      i++;
      let s = '';
      while (text[i] !== '"') {
        if (text[i] === '\\') {
          i++;
          s += text[i] === 'n' ? '\n' : text[i];
        } else s += text[i];
        i++;
      }
      i++;
      return { str: s };
    }
    const start = i;
    while (i < n && !/[\s()]/.test(text[i])) i++;
    return text.slice(start, i);
  }
  return parseNode();
}

const head = (node) => (Array.isArray(node) ? node[0] : null);
const val = (x) => (x && typeof x === 'object' && 'str' in x ? x.str : x);
const children = (node, name) => node.filter((c) => head(c) === name);
const child = (node, name) => node.find((c) => head(c) === name);
const nums = (node) => node.slice(1).map(Number);

// ---------- 기하 유틸 ----------
const rad = (d) => (d * Math.PI) / 180;
// KiCad: Y축 아래 방향, 회전각은 화면 기준 반시계
function toBoard(fx, fy, frot, px, py) {
  const t = rad(frot);
  return [fx + px * Math.cos(t) + py * Math.sin(t), fy - px * Math.sin(t) + py * Math.cos(t)];
}
function arcPoints(s, m, e, steps = 16) {
  const [ax, ay] = s, [bx, by] = m, [cx, cy] = e;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return [s, e];
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  const a0 = Math.atan2(ay - uy, ax - ux);
  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const dm = norm(Math.atan2(by - uy, bx - ux) - a0);
  let de = norm(Math.atan2(cy - uy, cx - ux) - a0);
  if (dm > de) de -= 2 * Math.PI; // 중간점이 반대 방향에 있으면 시계 방향
  const pts = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + (de * k) / steps;
    pts.push([ux + r * Math.cos(a), uy + r * Math.sin(a)]);
  }
  return pts;
}
const f2 = (v) => Math.round(v * 1000) / 1000;

// ---------- PCB 읽기 ----------
const pcb = parseSexpr(fs.readFileSync(pcbPath, 'utf8'));
const titleBlock = child(pcb, 'title_block');
const boardTitle = titleBlock ? val(child(titleBlock, 'title')?.[1]) : path.basename(pcbPath, '.kicad_pcb');

// 기판 외곽 (Edge.Cuts)
const edgeSegs = [];
for (const g of pcb) {
  const h = head(g);
  if (!h || !h.startsWith('gr_')) continue;
  const layer = val(child(g, 'layer')?.[1]);
  if (layer !== 'Edge.Cuts') continue;
  if (h === 'gr_line') edgeSegs.push([nums(child(g, 'start')), nums(child(g, 'end'))]);
  else if (h === 'gr_arc') edgeSegs.push(arcPoints(nums(child(g, 'start')), nums(child(g, 'mid')), nums(child(g, 'end'))));
  else if (h === 'gr_rect') {
    const [x1, y1] = nums(child(g, 'start'));
    const [x2, y2] = nums(child(g, 'end'));
    edgeSegs.push([[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]);
  } else if (h === 'gr_circle') {
    const [cx, cy] = nums(child(g, 'center'));
    const [ex, ey] = nums(child(g, 'end'));
    const r = Math.hypot(ex - cx, ey - cy);
    const pts = [];
    for (let k = 0; k <= 32; k++) pts.push([cx + r * Math.cos((k / 32) * 2 * Math.PI), cy + r * Math.sin((k / 32) * 2 * Math.PI)]);
    edgeSegs.push(pts);
  }
}
// 선분을 끝점 기준으로 이어 닫힌 외곽선 만들기
function chain(segs) {
  const rest = segs.map((s) => s.slice());
  const loops = [];
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
  while (rest.length) {
    let loop = rest.shift();
    let grew = true;
    while (grew) {
      grew = false;
      for (let k = 0; k < rest.length; k++) {
        const s = rest[k];
        const end = loop[loop.length - 1];
        if (near(end, s[0])) loop = loop.concat(s.slice(1));
        else if (near(end, s[s.length - 1])) loop = loop.concat(s.slice(0, -1).reverse());
        else continue;
        rest.splice(k, 1);
        grew = true;
        break;
      }
    }
    loops.push(loop);
  }
  return loops;
}
const outlines = chain(edgeSegs);
const allEdge = outlines.flat();
const bx0 = Math.min(...allEdge.map((p) => p[0]));
const by0 = Math.min(...allEdge.map((p) => p[1]));
const bx1 = Math.max(...allEdge.map((p) => p[0]));
const by1 = Math.max(...allEdge.map((p) => p[1]));
const margin = 3;
const viewBox = [f2(bx0 - margin), f2(by0 - margin), f2(bx1 - bx0 + 2 * margin), f2(by1 - by0 + 2 * margin)];

// 부품(footprint)
const footprints = [];
for (const fp of children(pcb, 'footprint')) {
  const lib = val(fp[1]);
  const layer = val(child(fp, 'layer')[1]);
  const [fx, fy, frot = 0] = nums(child(fp, 'at'));
  const props = {};
  for (const p of children(fp, 'property')) props[val(p[1])] = val(p[2]);
  const attr = child(fp, 'attr');
  const attrs = attr ? attr.slice(1).map(val) : [];
  const ref = props.Reference;
  if (!ref || ref.startsWith('#')) continue;

  const pads = [];
  for (const pd of children(fp, 'pad')) {
    const shape = val(pd[3]);
    const at = nums(child(pd, 'at'));
    const size = nums(child(pd, 'size') || ['size', 0, 0]);
    const padLayers = (child(pd, 'layers') || []).slice(1).map(val);
    const [px, py] = toBoard(fx, fy, frot, at[0], at[1]);
    const fn = child(pd, 'pinfunction');
    pads.push({ num: val(pd[1]), fn: fn ? val(fn[1]) : '', x: px, y: py, w: size[0], h: size[1], rot: at[2] ?? frot, shape, type: val(pd[2]), layers: padLayers });
  }

  // 코트야드(CrtYd) 외곽 → 검사 영역
  const crt = [];
  for (const g of fp) {
    const h = head(g);
    if (!h || !h.startsWith('fp_')) continue;
    const gl = val(child(g, 'layer')?.[1]);
    if (!gl || !gl.endsWith('CrtYd')) continue;
    const local = [];
    if (h === 'fp_line' || h === 'fp_rect') {
      const [x1, y1] = nums(child(g, 'start'));
      const [x2, y2] = nums(child(g, 'end'));
      local.push([x1, y1], [x2, y2]);
      if (h === 'fp_rect') local.push([x1, y2], [x2, y1]);
    } else if (h === 'fp_circle') {
      const [cx, cy] = nums(child(g, 'center'));
      const [ex, ey] = nums(child(g, 'end'));
      const r = Math.hypot(ex - cx, ey - cy);
      local.push([cx - r, cy - r], [cx + r, cy + r], [cx - r, cy + r], [cx + r, cy - r]);
    } else if (h === 'fp_poly') {
      for (const xy of children(child(g, 'pts'), 'xy')) local.push(nums(xy));
    } else if (h === 'fp_arc') {
      local.push(...arcPoints(nums(child(g, 'start')), nums(child(g, 'mid')), nums(child(g, 'end')), 8));
    }
    for (const [lx, ly] of local) crt.push(toBoard(fx, fy, frot, lx, ly));
  }
  let areaSource = 'CAD.CrtYd';
  let pts = crt;
  if (!pts.length) {
    areaSource = 'CAD.Pad';
    pts = pads.flatMap((p) => [[p.x - p.w / 2, p.y - p.h / 2], [p.x + p.w / 2, p.y + p.h / 2]]);
  }
  if (!pts.length) {
    areaSource = 'CAD.Origin';
    pts = [[fx - 0.5, fy - 0.5], [fx + 0.5, fy + 0.5]];
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  footprints.push({
    ref,
    lib,
    pkg: lib.split(':').pop(),
    side: layer === 'B.Cu' ? 'bottom' : 'top',
    x: fx,
    y: fy,
    rot: frot,
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    areaSource,
    props,
    attrs,
    pads,
  });
}

// pos.csv (실장기 좌표) — 있으면 Ref 로 매칭하여 함께 보관
const posMap = {};
if (posPath && fs.existsSync(posPath)) {
  const lines = fs.readFileSync(posPath, 'utf8').trim().split(/\r?\n/);
  const hdr = lines.shift().split(',').map((s) => s.replace(/"/g, ''));
  for (const line of lines) {
    const cols = line.split(',').map((s) => s.replace(/"/g, ''));
    const row = Object.fromEntries(hdr.map((h, k) => [h, cols[k]]));
    posMap[row.Ref] = row;
  }
}

// ---------- 분류 ----------
const CATEGORY_BY_PREFIX = [
  ['FID', '피듀셜 마크'],
  ['GFX', '그래픽·로고'],
  ['FB', '페라이트 비드'],
  ['TP', '테스트 포인트'],
  ['SW', '스위치'],
  ['C', '커패시터'],
  ['R', '저항'],
  ['L', '인덕터'],
  ['D', '다이오드'],
  ['Q', '트랜지스터'],
  ['U', 'IC'],
  ['IC', 'IC'],
  ['J', '커넥터'],
  ['P', '커넥터'],
  ['Y', '발진기·크리스탈'],
  ['X', '발진기·크리스탈'],
  ['H', '기구 홀'],
  ['MH', '기구 홀'],
];
function categoryOf(ref) {
  const prefix = ref.replace(/[0-9].*$/, '');
  for (const [p, c] of CATEGORY_BY_PREFIX) if (prefix === p) return c;
  for (const [p, c] of CATEGORY_BY_PREFIX) if (prefix.startsWith(p)) return c;
  return '기타';
}
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

// ---------- 문서 (Datasheet 속성) ----------
const docs = new Map();
for (const fp of footprints) {
  const url = fp.props.Datasheet;
  if (!url || url === '~' || !/^https?:/.test(url)) continue;
  if (!docs.has(url)) {
    const file = decodeURIComponent(url.split('/').pop());
    docs.set(url, {
      doc_id: `DS-${String(docs.size + 1).padStart(2, '0')}`,
      title: fp.props.MPN || file,
      type: '데이터시트',
      url,
      summary: [fp.props.Description && `설명: ${fp.props.Description}`, fp.props.MPN && `MPN: ${fp.props.MPN}`, fp.props.LCSC && `LCSC: ${fp.props.LCSC}`]
        .filter(Boolean)
        .join('; '),
    });
  }
  fp.docId = docs.get(url).doc_id;
}

// ---------- CSV 출력 ----------
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

footprints.sort((a, b) => natural(a.ref, b.ref));

const items = footprints.map((fp) => {
  const category = categoryOf(fp.ref);
  const value = fp.props.Value || '';
  return {
    ref: fp.ref,
    category,
    group: `${category} · ${fp.props.Descr || value}`,
    name: fp.props.Description || fp.props.Descr || value,
    value,
    spec: fp.pkg,
    part_no: fp.props.MPN || '',
    doc_id: fp.docId || '',
    note: fp.attrs.includes('dnp') ? 'DNP(미실장)' : '',
  };
});

// 1번 패드: 방향(극성·1번 핀) 확인 위치. 라벨은 파일에 있는 핀 기능 이름만 씀 (관례로 추측하지 않음)
const pin1Of = (fp) => {
  if (fp.pads.length < 2) return null;
  const p = fp.pads.find((q) => q.num === '1');
  return p ? { x: f2(p.x), y: f2(p.y), label: p.fn || '' } : null;
};

const placements = footprints.map((fp) => {
  const pos = posMap[fp.ref];
  const pin1 = pin1Of(fp);
  return {
    ref: fp.ref,
    x: f2((fp.bbox[0] + fp.bbox[2]) / 2),
    y: f2((fp.bbox[1] + fp.bbox[3]) / 2),
    w: f2(fp.bbox[2] - fp.bbox[0]),
    h: f2(fp.bbox[3] - fp.bbox[1]),
    rotation: fp.rot,
    side: fp.side,
    area_source: fp.areaSource,
    machine_x: pos ? f2(Number(pos.PosX)) : '',
    machine_y: pos ? f2(Number(pos.PosY)) : '',
    pin1_x: pin1 ? pin1.x : '',
    pin1_y: pin1 ? pin1.y : '',
    pin1_label: pin1 ? pin1.label : '',
  };
});

// ---------- 도면 SVG ----------
const COLORS = {
  top: { board: '#1f5f4a', copper: '#c8a24a', track: '#3f8f6c', pad: '#d8b45c', courtyard: '#9fd3bf' },
  bottom: { board: '#1d4d63', copper: '#9fb4c8', track: '#3d7896', pad: '#b9c9d8', courtyard: '#a7cbe0' },
};
function boardSvg(side) {
  const c = COLORS[side];
  const cuLayer = side === 'top' ? 'F.Cu' : 'B.Cu';
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}">`);
  out.push(`<rect x="${viewBox[0]}" y="${viewBox[1]}" width="${viewBox[2]}" height="${viewBox[3]}" fill="#0f2a2a"/>`);
  const d = outlines.map((loop) => 'M' + loop.map((p) => `${f2(p[0])},${f2(p[1])}`).join('L') + 'Z').join('');
  out.push(`<path d="${d}" fill="${c.board}" fill-rule="evenodd" stroke="#e8e2c8" stroke-width="0.2"/>`);
  // 트랙
  out.push(`<g stroke="${c.track}" stroke-linecap="round" fill="none">`);
  for (const s of children(pcb, 'segment')) {
    if (val(child(s, 'layer')[1]) !== cuLayer) continue;
    const [x1, y1] = nums(child(s, 'start'));
    const [x2, y2] = nums(child(s, 'end'));
    const w = nums(child(s, 'width'))[0];
    out.push(`<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke-width="${w}"/>`);
  }
  for (const a of children(pcb, 'arc')) {
    if (val(child(a, 'layer')[1]) !== cuLayer) continue;
    const pts = arcPoints(nums(child(a, 'start')), nums(child(a, 'mid')), nums(child(a, 'end')), 8);
    const w = nums(child(a, 'width'))[0];
    out.push(`<polyline points="${pts.map((p) => `${f2(p[0])},${f2(p[1])}`).join(' ')}" stroke-width="${w}"/>`);
  }
  out.push('</g>');
  // 비아
  out.push(`<g fill="${c.copper}">`);
  for (const v of children(pcb, 'via')) {
    const [x, y] = nums(child(v, 'at'));
    const size = nums(child(v, 'size'))[0];
    out.push(`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(size / 2)}"/>`);
  }
  out.push('</g>');
  // 패드
  out.push(`<g fill="${c.pad}">`);
  for (const fp of footprints) {
    for (const p of fp.pads) {
      const onSide = p.layers.some((l) => l === cuLayer || l === '*.Cu');
      if (!onSide) continue;
      const tr = `transform="rotate(${f2(-p.rot)} ${f2(p.x)} ${f2(p.y)})"`;
      if (p.shape === 'circle') out.push(`<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(p.w / 2)}"/>`);
      else {
        const rx = p.shape === 'oval' ? Math.min(p.w, p.h) / 2 : p.shape === 'roundrect' ? Math.min(p.w, p.h) * 0.25 : 0;
        out.push(`<rect x="${f2(p.x - p.w / 2)}" y="${f2(p.y - p.h / 2)}" width="${f2(p.w)}" height="${f2(p.h)}" rx="${f2(rx)}" ${tr}/>`);
      }
      if (p.type === 'thru_hole' || p.type === 'np_thru_hole') out.push(`<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(Math.min(p.w, p.h) / 4)}" fill="#0f2a2a"/>`);
    }
  }
  out.push('</g>');
  // 해당 면 부품의 코트야드 외곽
  out.push(`<g fill="none" stroke="${c.courtyard}" stroke-width="0.08" stroke-dasharray="0.4 0.3" opacity="0.7">`);
  for (const fp of footprints) {
    if (fp.side !== side) continue;
    const [x0, y0, x1, y1] = fp.bbox;
    out.push(`<rect x="${f2(x0)}" y="${f2(y0)}" width="${f2(x1 - x0)}" height="${f2(y1 - y0)}"/>`);
  }
  out.push('</g></svg>');
  return out.join('\n');
}

// ---------- 레시피 템플릿 (기본값) ----------
const usedCategories = [...new Set(items.map((i) => i.category))];
const RECIPE_LIBRARY = {
  커패시터: [
    ['present', '부품 유무', 'check', '육안'],
    ['polarity', '극성 방향 (전해·탄탈만)', 'check', '실크 + 마킹 대조'],
    ['solder', '납땜 상태 (브리지·냉땜)', 'check', '확대경'],
  ],
  저항: [
    ['present', '부품 유무', 'check', '육안'],
    ['marking', '값 마킹 일치', 'check', 'BOM 대조'],
    ['solder', '납땜 상태', 'check', '확대경'],
  ],
  IC: [
    ['pin1', '1번 핀 방향', 'check', '실크 마커 대조'],
    ['bridge', '리드 브리지 없음', 'check', '확대경'],
    ['marking', '품번 마킹 일치', 'check', 'BOM 대조'],
  ],
  커넥터: [
    ['seat', '들뜸 없음', 'check', '측면 육안'],
    ['solder', '스루홀 납 채움', 'check', '뒷면 확인'],
  ],
  다이오드: [
    ['polarity', '캐소드 방향', 'check', '실크 대조'],
    ['solder', '납땜 상태', 'check', '확대경'],
  ],
  인덕터: [
    ['present', '부품 유무', 'check', '육안'],
    ['solder', '납땜 상태', 'check', '확대경'],
  ],
};
const recipes = {
  templates: usedCategories
    .filter((c) => RECIPE_LIBRARY[c])
    .map((c) => ({
      id: `R-${c}`,
      label: `${c} 기본 검사`,
      appliesTo: { category: c },
      checks: RECIPE_LIBRARY[c].map(([id, label, type, method]) => ({ id, label, type, method })),
    })),
  exclude: { categories: usedCategories.filter((c) => ['기구 홀', '테스트 포인트', '피듀셜 마크', '그래픽·로고'].includes(c)) },
  reasons: ['부품 누락', '역삽·방향 오류', '납땜 불량', '값·품번 불일치', '도면 좌표 불일치', '문서 확인 필요', '기타'],
};

// ---------- 저장 ----------
fs.mkdirSync(outDir, { recursive: true });
const sides = ['top', 'bottom'].filter((s) => footprints.some((f) => f.side === s));
const meta = {
  name: displayName || boardTitle,
  domain: 'PCB',
  description: `KiCad 원본(${path.basename(pcbPath)})에서 자동 변환`,
  source: sourceUrl || '',
  unit: 'mm',
  viewBox,
  itemLabel: '부품',
  listLabel: 'BOM 계층',
  sides: sides.map((s) => ({
    id: s,
    label: s === 'top' ? '앞면' : '뒷면',
    drawing: `drawing-${s}.svg`,
    mirror: s === 'bottom',
  })),
};
// 기존 meta.json 의 수기 항목(reference, license 등)은 유지
const metaPath = path.join(outDir, 'meta.json');
const prevMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
fs.writeFileSync(metaPath, JSON.stringify({ ...prevMeta, ...meta }, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'items.csv'), toCsv(['ref', 'category', 'group', 'name', 'value', 'spec', 'part_no', 'doc_id', 'note'], items));
fs.writeFileSync(
  path.join(outDir, 'placements.csv'),
  toCsv(['ref', 'x', 'y', 'w', 'h', 'rotation', 'side', 'area_source', 'machine_x', 'machine_y', 'pin1_x', 'pin1_y', 'pin1_label'], placements),
);
fs.writeFileSync(path.join(outDir, 'docs.csv'), toCsv(['doc_id', 'title', 'type', 'url', 'summary'], [...docs.values()]));
for (const s of sides) fs.writeFileSync(path.join(outDir, `drawing-${s}.svg`), boardSvg(s));
const recipePath = path.join(outDir, 'recipes.json');
if (!fs.existsSync(recipePath)) fs.writeFileSync(recipePath, JSON.stringify(recipes, null, 2) + '\n');

console.log(`✔ ${meta.name}: 부품 ${items.length}개, 문서 ${docs.size}개, 면 ${sides.join('/')}, pos.csv 매칭 ${Object.keys(posMap).length ? placements.filter((p) => p.machine_x !== '').length : 0}개 → ${outDir}`);
