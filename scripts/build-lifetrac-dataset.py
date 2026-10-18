"""Open Source Ecology LifeTrac III 제작 도면(PDF) → 검사 대시보드 데이터셋

원본: https://commons.wikimedia.org/wiki/File:Open_Source_Ecology_-_LifeTrac_-_Fabrication_Drawings.pdf
라이선스: CC BY-SA 3.0 (Open Source Ecology, 도면 작성 F. Anzaldua 2012)

사용법 (PyMuPDF, Pillow 필요):
  python -m venv .venv && .venv/bin/pip install pymupdf pillow
  .venv/bin/python scripts/build-lifetrac-dataset.py <LifeTrac.pdf> public/datasets/lifetrac-iii

PDF 에는 텍스트 층이 없어(스캔 이미지) 도면명·척도·치수는 도면을 직접 읽어 아래 표에 옮겼습니다.
값이 도면에 없으면 비워 둡니다(수량, 재질 등) — 지어내지 않습니다.
"""

import csv
import json
import shutil
import sys
from pathlib import Path

import pymupdf
from PIL import Image

DPI = 150  # 도면 이미지 해상도 = 좌표계 (1 단위 = 150dpi 픽셀)

# (시트 번호, 도면명(원문), 한글 설명, 분류, 척도, 단면/규격, 길이 in, 구멍 수, 구멍 지름 in, 검토 메모)
SHEETS = [
    (0, "2.5X30X1.25 DA HYD CYL INNER SHAFT", "유압 실린더 내부 로드 (2.5×30)", "유압 부품", "1:8", "", "", "", "", ""),
    (1, "55 INCH FRONT-VERTICAL TUBE", "전면 수직 각관 55인치", "프레임 각관", "1:12", "□4.000×4.000×.250 R.250", 55.0, 12, 0.813, ""),
    (2, "59 INCH REAR-VERTICAL TUBE", "후면 수직 각관 59인치", "프레임 각관", "1:12", "□4.000×4.000×.250 R.250", 59.0, 16, 0.813, ""),
    (3, "60 INCH UNDER BASE TUBE", "하부 베이스 각관 60인치", "프레임 각관", "1:8", "□4.000×4.000×.250 R.250", 60.0, 12, 0.813, ""),
    (4, "68 INCH TOP N-S TUBE", "상부 남북 각관 68인치", "프레임 각관", "1:12", "□4.000×4.000×.250 R.250", 68.0, 12, 0.813, "대구멍 2× Ø2.375 별도"),
    (5, "76 INCH INNER BASE TUBE", "내측 베이스 각관 76인치", "프레임 각관", "1:12", "□4.000×4.000×.250 R.250", 76.0, 26, 0.813, ""),
    (6, "76 INCH OUTER BASE TUBE", "외측 베이스 각관 76인치", "프레임 각관", "1:12", "□4.000×4.000×.250 R.250", 76.0, 18, 0.813, ""),
    (7, "9.5 INCH BOLT", "볼트 9.5인치", "체결 부품", "1:2", "", 9.5, "", "", ""),
    (8, "ADAPTER PLATE", "어댑터 판", "판재·브래킷", "1:2", "판 t.500", "", "", "", ""),
    (9, "HEX BOLT_AI", "육각 볼트", "체결 부품", "1:1", "", "", "", "", ""),
    (10, "HEX NUT_AI", "육각 너트", "체결 부품", "4:1", "", "", "", "", ""),
    (11, "2.5X30X1.25 DA HYD CYL", "복동 유압 실린더 2.5×30", "유압 부품", "1:8", "", "", "", "", ""),
    (12, "HYDRAULIC CYLINDER BASE MOUNT", "유압 실린더 베이스 마운트", "판재·브래킷", "1:4", "", "", "", "", ""),
    (13, "HYDRAULIC VAVLE MOUNT", "유압 밸브 마운트", "판재·브래킷", "1:8", "앵글", 36.0, "", "", "도면명 철자 오기(VAVLE → VALVE)"),
    (14, "LOADER ARM 3.5 INCH SUPPORT ROUND", "로더 암 지지 환관 3.5인치", "축·핀·환봉", "1:2", "Ø2.375 / Ø1.875", 3.5, "", "", ""),
    (15, "LOADER ARM 4.5 INCH SUPPORT ROUND", "로더 암 지지 환관 4.5인치", "축·핀·환봉", "1:2", "Ø2.375 / Ø1.875", 4.5, "", "", ""),
    (16, "LOADER ARM ENDLUMP", "로더 암 끝단 블록", "판재·브래킷", "1:4", "8.000×2.000×4.593", 8.0, "", "", ""),
    (17, "LOADER ARM HYDRAULIC MOUNT PLATE", "로더 암 유압 마운트 판", "판재·브래킷", "1:4", "판 높이 12.500", "", 4, 0.813, ""),
    (18, "LOADER ARM LOWER", "로더 암 하부", "로더 암 각관", "1:12", "□3.000×6.000×.375 R.375", 43.5, 10, 0.813, "끝단 블록(시트 16) 포함 시 +3.625"),
    (19, "LOADER ARM SHAFT", "로더 암 축", "축·핀·환봉", "1:8", "Ø1.875 환봉", 56.0, "", "", ""),
    (20, "LOADER ARM SUPPORT BEAM ANGLE IRON", "로더 암 지지 앵글", "판재·브래킷", "1:4", "앵글", "", "", "", ""),
    (21, "LOADER ARM SUPPORT BEAM", "로더 암 지지 빔", "로더 암 각관", "1:8", "□3.000×6.000×.375 R.375", 45.0, 12, 0.813, ""),
    (22, "2.5X36X1.5 DA HYD CYL inner shaft", "유압 실린더 내부 로드 (2.5×36)", "유압 부품", "1:8", "", "", "", "", ""),
    (23, "TITLE", "표제 미기재 도면 (와셔형 판 Ø4.000/Ø1.875)", "판재·브래킷", "1:2", "Ø4.000 / Ø1.875 t.250", "", "", "", "도면명 미기재 — 표제란에 'TITLE' 그대로 남아 있음"),
    (24, "LOADER ARM UPPER", "로더 암 상부", "로더 암 각관", "1:12", "□3.000×6.000×.375 R.375", 61.104, 8, 0.813, "대구멍 Ø2.375 별도"),
    (25, "LOADER ARM", "로더 암", "로더 암 각관", "1:16", "□3.000×6.000×.375 R.375", 100.0, 16, 0.813, "대구멍 2× Ø2.375 별도"),
    (26, "LOADER QUICK ATTACH PLATE WELDS", "퀵 어태치 플레이트 용접도", "용접 조립품", "1:8", "", "", "", "", "용접 기호 없이 크기(0.13)만 표기 — 이음 형식(필릿) 확인 필요"),
    (27, "LOADER QUICK ATTACH PLATE", "퀵 어태치 플레이트 조립", "용접 조립품", "1:12", "52.000×12.000", 52.0, "", "", ""),
    (28, "NEW PISTON MOUNT", "피스톤 마운트(신규)", "판재·브래킷", "1:4", "", "", "", "", ""),
    (29, "NEW PLATE", "판(신규)", "판재·브래킷", "1:1", "3.000×3.000 t.500", "", "", "", ""),
    (30, "1 INCH NUT DRILLED OUT", "1인치 너트 구멍 가공", "축·핀·환봉", "2:1", "", "", "", "", ""),
    (31, "1 INCH PIN (8IN LONG)", "1인치 핀 (8인치)", "축·핀·환봉", "1:2", "Ø1.000", "", "", "", "도면명(8IN LONG)과 도면 치수(6.700) 불일치 — 확인 필요"),
    (32, "ONE INCH PIN", "1인치 핀", "축·핀·환봉", "1:2", "Ø1.000", "", "", "", ""),
    (33, "2.5X36X1.5 DA HYD CYL", "복동 유압 실린더 2.5×36", "유압 부품", "1:8", "", "", "", "", ""),
    (34, "POWER CUBE BOTTOM MOUNT", "파워 큐브 하부 마운트", "판재·브래킷", "1:8", "", 36.0, "", "", ""),
    (35, "POWER CUBE TOP MOUNT", "파워 큐브 상부 마운트", "판재·브래킷", "1:8", "", 36.0, "", "", ""),
    (36, "RIM", "림", "바퀴", "1:8", "", "", "", "", ""),
    (37, "ROD, 1 INCH", "환봉 1인치", "축·핀·환봉", "1:1", "Ø1.000", 5.5, "", "", ""),
    (38, "TIRE", "타이어", "바퀴", "1:16", "", "", "", "", ""),
    (39, "TOP LOADER PLATE HYDRAULIC", "상부 로더 유압 판", "판재·브래킷", "1:8", "판 t.500", "", "", "", ""),
    (40, "WASHER 0.250-WIDE", "와셔 0.250", "체결 부품", "4:1", "", "", "", "", ""),
    (41, "WHEEL AXLE SHAFT HOLDING PLATE", "휠 액슬 축 고정판", "판재·브래킷", "1:4", "", "", "", "", ""),
    (42, "WHEEL AXLE SHAFT", "휠 액슬 축", "축·핀·환봉", "1:6", "", 26.0, "", "", ""),
    (43, "WHEEL HYDRAULIC MOTOR INTERFACE PLATE", "휠 유압모터 연결판", "판재·브래킷", "1:4", "판 10.000×8.000", "", "", "", ""),
    (44, "3/4 INCH NUT", "3/4인치 너트", "체결 부품", "2:1", "", "", "", "", ""),
    (45, "WHEEL MOTOR QA PLATE", "휠 모터 퀵어태치 판", "판재·브래킷", "1:4", "판 8.000×6.000", "", "", "", ""),
    (46, "WHEEL MOUNT DISC", "휠 마운트 디스크", "판재·브래킷", "1:4", "", "", "", "", ""),
    (47, "WHEEL MOUNT ROUND", "휠 마운트 환관", "축·핀·환봉", "1:2", "Ø2.500 / Ø1.875", 6.0, "", "", ""),
    (48, "3/4 INCH WASHER", "3/4인치 와셔", "체결 부품", "2:1", "", "", "", "", ""),
    (49, "44 INCH TOP E-W TUBE", "상부 동서 각관 44인치", "프레임 각관", "1:8", "□4.000×4.000×.250 R.250", 44.0, 8, 0.813, ""),
    (50, "5.5 INCH BOLT", "볼트 5.5인치", "체결 부품", "1:2", "", 5.5, "", "", ""),
    (51, "52 INCH MIDDLE-VERTICAL TUBE", "중간 수직 각관 52인치", "프레임 각관", "1:8", "□4.000×4.000×.250 R.250", 52.0, 10, 0.813, ""),
]

# 시트 26 용접 지시(0.13) 지시선 끝 위치 (150dpi 픽셀). 도면을 보고 직접 찍음.
WELD_SHEET = 26
WELDS = [
    (410, 288, "좌측 상단 귀(lug) ↔ 수직 부재"),
    (783, 425, "상부 채널 ↔ 상부 수평 부재 (상단 이음)"),
    (410, 500, "좌측 하단 귀(lug) ↔ 수직 부재"),
    (765, 468, "상부 채널 ↔ 상부 수평 부재 (하단 이음)"),
    (487, 470, "좌측 수직 부재 ↔ 상부 수평 부재 안쪽 모서리"),
    (1050, 665, "우측 상단 귀(lug) ↔ 수직 부재"),
    (1118, 652, "우측 상단 모서리 ↔ 채널 끝단"),
    (800, 650, "중앙 보강재 ↔ 상부 수평 부재"),
    (1110, 850, "우측 하단 귀(lug) ↔ 수직 부재 (바깥)"),
    (1035, 895, "우측 하단 귀(lug) ↔ 수직 부재 (안쪽)"),
]
WELD_SIZE_IN = 0.13

# 도면 결함이 아닌 참고 정보 → items.csv note 열 (review 열은 도면 자체의 문제만)
INFO_NOTES = {"대구멍 2× Ø2.375 별도", "대구멍 Ø2.375 별도", "끝단 블록(시트 16) 포함 시 +3.625"}

EXCLUDED = ["유압 부품", "체결 부품", "바퀴"]  # 구매품: 제작 검사 대상 아님

GENERAL_TOL = 0.5  # 표제란: ANGLES .5 / X .5 / .XX .5 / .XXX .5


def detect_view_bbox(img: Image.Image):
    """표제란·테두리를 뺀 영역에서 선 덩어리(뷰)들을 찾아, 선이 가장 많은 덩어리를 '주 투상도'로 사용."""
    from PIL import ImageFilter

    k = 4  # 1/4 축소 격자에서 계산
    g = img.convert("L")
    w, h = g.size
    x0, y0, x1, y1 = 70, 150, 1570, 1275  # 테두리 안쪽 (150dpi 기준, 여유 포함)
    tb_x, tb_y = 600, 970  # 표제란 왼쪽 위 모서리 (팽창 여유 30px 포함)
    # 정확히 k×k 블록 평균이 되도록 k 의 배수로 잘라서 축소 (브라우저 src/lab/imagePipeline.js 와 같은 계산)
    small = g.crop((0, 0, (w // k) * k, (h // k) * k)).resize((w // k, h // k), Image.Resampling.BOX)
    ink = small.point(lambda v: 255 if v < 200 else 0)
    # 가까운 선끼리 이어지도록 팽창 (치수선·지시선 포함 뷰 단위로 묶음)
    grown = ink.filter(ImageFilter.MaxFilter(9))
    sw, sh = grown.size
    gp, ip = grown.load(), ink.load()

    def inside(x, y):
        X, Y = x * k, y * k
        return x0 <= X < x1 and y0 <= Y < y1 and not (X >= tb_x and Y >= tb_y)

    seen = bytearray(sw * sh)
    best = None
    for sy in range(sh):
        for sx in range(sw):
            if seen[sy * sw + sx] or not gp[sx, sy] or not inside(sx, sy):
                continue
            stack = [(sx, sy)]
            seen[sy * sw + sx] = 1
            n_ink, mnx, mny, mxx, mxy = 0, sx, sy, sx, sy
            while stack:
                cx, cy = stack.pop()
                if ip[cx, cy]:
                    n_ink += 1
                mnx, mny, mxx, mxy = min(mnx, cx), min(mny, cy), max(mxx, cx), max(mxy, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < sw and 0 <= ny < sh and not seen[ny * sw + nx] and gp[nx, ny] and inside(nx, ny):
                        seen[ny * sw + nx] = 1
                        stack.append((nx, ny))
            if best is None or n_ink > best[0]:
                best = (n_ink, mnx, mny, mxx, mxy)
    if not best:
        return None
    _, mnx, mny, mxx, mxy = best
    return (mnx * k, mny * k, (mxx + 1) * k, (mxy + 1) * k)


def main(pdf_path, out_dir):
    out = Path(out_dir)
    (out / "sheets").mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    assert doc.page_count == len(SHEETS), f"시트 수가 다릅니다: {doc.page_count}"

    items, placements, docs, sides = [], [], [], []
    size = None
    for (n, title, ko, cat, scale, spec, length, holes, hole_d, review) in SHEETS:
        sid = f"s{n:02d}"
        ref = f"P{n:02d}"
        pix = doc[n].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
        png = out / "sheets" / f"sheet-{n:02d}.png"
        pix.save(png)
        img = Image.open(png)
        img.quantize(16).save(png, optimize=True)  # 선화라 16색으로 충분
        size = img.size
        sides.append({"id": sid, "label": f"#{n:02d} {title}", "drawing": f"sheets/sheet-{n:02d}.png", "mirror": False})
        docs.append({
            "doc_id": f"DWG-{n:02d}",
            "title": f"#{n:02d} {title}",
            "type": "제작 도면",
            "url": f"sheets/sheet-{n:02d}.png",
            "summary": "; ".join(x for x in [
                f"도면명: {title}",
                f"척도: {scale}",
                spec and f"단면·규격: {spec}",
                length != "" and f"주요 길이: {length} in",
                holes != "" and f"구멍: {holes}× Ø{hole_d} in",
                "단위: inch (표제란)",
                f"일반 공차: ±{GENERAL_TOL} (표제란 ANGLES/X/.XX/.XXX)",
                "투상법: 3각법",
                "작성: F. Anzaldua, 3/28/12",
                "재질: 표제란에 기재 없음",
            ] if x),
        })
        group_spec = spec or "규격 도면 참조"
        items.append({
            "ref": ref,
            "category": cat,
            "group": f"{cat} · {group_spec}",
            "name": ko,
            "value": title,
            "spec": spec,
            "part_no": f"LifeTrac III 시트 #{n:02d}",
            "doc_id": f"DWG-{n:02d}",
            "note": "구매품" if cat in EXCLUDED else (review if review in INFO_NOTES else ""),
            "review": "" if review in INFO_NOTES else review,
            "length_in": length,
            "holes": holes,
            "hole_dia_in": hole_d,
            "weld_size_in": "",
        })
        bb = detect_view_bbox(img.convert("L"))
        if bb:
            x0, y0, x1, y1 = bb
            placements.append({
                "ref": ref, "x": (x0 + x1) / 2, "y": (y0 + y1) / 2, "w": x1 - x0, "h": y1 - y0,
                "rotation": 0, "side": sid, "area_source": "도면 이미지 자동 검출(주 투상도)",
            })

    for i, (x, y, where) in enumerate(WELDS, 1):
        ref = f"W{i:02d}"
        items.append({
            "ref": ref,
            "category": "용접부",
            "group": f"용접부 · 퀵 어태치 플레이트 (지시 {WELD_SIZE_IN} in)",
            "name": where,
            "value": f"용접 크기 {WELD_SIZE_IN} in",
            "spec": "시트 #26 용접 지시",
            "part_no": "LifeTrac III 시트 #26",
            "doc_id": f"DWG-{WELD_SHEET:02d}",
            "note": "",
            "review": "",
            "length_in": "",
            "holes": "",
            "hole_dia_in": "",
            "weld_size_in": WELD_SIZE_IN,
        })
        placements.append({
            "ref": ref, "x": x, "y": y, "w": 40, "h": 40, "rotation": 0,
            "side": f"s{WELD_SHEET:02d}", "area_source": "용접 지시선 끝(도면 판독)",
        })

    docs.append({
        "doc_id": "OSE-PDF",
        "title": "LifeTrac Fabrication Drawings (원본 PDF 52쪽)",
        "type": "원본 도면집",
        "url": "LifeTrac-Fabrication-Drawings.pdf",
        "summary": "출처: Open Source Ecology / Wikimedia Commons; 라이선스: CC BY-SA 3.0; 쪽수: 52; 텍스트 층: 없음(이미지 도면)",
    })
    shutil.copy(pdf_path, out / "LifeTrac-Fabrication-Drawings.pdf")

    def write_csv(name, rows):
        with open(out / name, "w", newline="", encoding="utf-8") as f:
            wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            wr.writeheader()
            wr.writerows(rows)

    write_csv("items.csv", items)
    write_csv("placements.csv", [{k: (round(v, 1) if isinstance(v, float) else v) for k, v in p.items()} for p in placements])
    write_csv("docs.csv", docs)

    meta = {
        "name": "LifeTrac III 트랙터 제작 도면 (Open Source Ecology)",
        "domain": "용접·가공",
        "description": "오픈소스 트랙터 LifeTrac III 의 제작 도면 52장(각관 절단·천공, 판재, 축, 용접 조립). 치수·용접 지시는 원본 도면에서 판독.",
        "source": "https://commons.wikimedia.org/wiki/File:Open_Source_Ecology_-_LifeTrac_-_Fabrication_Drawings.pdf",
        "license": "CC BY-SA 3.0 · Open Source Ecology",
        "unit": "px",
        "viewBox": [0, 0, size[0], size[1]],
        "itemLabel": "부품·용접부",
        "listLabel": "도면 부품 목록",
        "sides": sides,
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    recipes = {
        "templates": [
            {
                "id": "R-TUBE",
                "label": "각관 절단·천공 검사",
                "appliesTo": {"categories": ["프레임 각관", "로더 암 각관"]},
                "checks": [
                    {"id": "length", "label": "절단 길이", "type": "number", "unit": "in", "nominal": "length_in", "tol": GENERAL_TOL, "method": "줄자 · 도면 길이 대비 (표제란 일반공차)"},
                    {"id": "section", "label": "단면 규격 일치", "type": "check", "method": "버니어 · 도면 단면도 대비"},
                    {"id": "holes", "label": "구멍 개수", "type": "number", "unit": "개", "nominal": "holes", "tol": 0, "method": "도면 nX 표기 대비"},
                    {"id": "hole_dia", "label": "구멍 지름", "type": "number", "unit": "in", "nominal": "hole_dia_in", "tol": GENERAL_TOL, "method": "핀 게이지 (표제란 .XXX 공차)"},
                    {"id": "deburr", "label": "절단면·구멍 버 제거", "type": "check", "method": "육안·촉감"},
                ],
            },
            {
                "id": "R-WELD",
                "label": "용접부 외관·크기 검사",
                "appliesTo": {"category": "용접부"},
                "checks": [
                    {"id": "size", "label": "용접 크기(각장)", "type": "number", "unit": "in", "nominal": "weld_size_in", "minFromNominal": True, "method": "필릿 게이지 · 도면 지시 이상"},
                    {"id": "bead", "label": "비드 외관 균일", "type": "check", "method": "육안"},
                    {"id": "crack", "label": "균열·기공·언더컷 없음", "type": "check", "method": "육안 + 확대경"},
                ],
            },
            {
                "id": "R-ASSY",
                "label": "용접 조립품 검사",
                "appliesTo": {"category": "용접 조립품"},
                "checks": [
                    {"id": "overall", "label": "전체 길이", "type": "number", "unit": "in", "nominal": "length_in", "tol": GENERAL_TOL, "method": "줄자"},
                    {"id": "square", "label": "직각도·뒤틀림 없음", "type": "check", "method": "직각자·정반"},
                    {"id": "welds", "label": "용접부(W01~W10) 개별 검사 완료", "type": "check", "method": "용접부 목록 확인"},
                ],
            },
            {
                "id": "R-PLATE",
                "label": "판재·브래킷 가공 검사",
                "appliesTo": {"category": "판재·브래킷"},
                "checks": [
                    {"id": "outline", "label": "외형 치수 도면 일치", "type": "check", "method": "줄자·버니어"},
                    {"id": "holes", "label": "구멍 위치·개수 도면 일치", "type": "check", "method": "도면 대비"},
                    {"id": "deburr", "label": "버 제거", "type": "check", "method": "육안·촉감"},
                ],
            },
            {
                "id": "R-SHAFT",
                "label": "축·핀·환봉 가공 검사",
                "appliesTo": {"category": "축·핀·환봉"},
                "checks": [
                    {"id": "length", "label": "길이", "type": "number", "unit": "in", "nominal": "length_in", "tol": GENERAL_TOL, "method": "버니어"},
                    {"id": "dia", "label": "외경 도면 일치", "type": "check", "method": "마이크로미터"},
                    {"id": "chamfer", "label": "모따기·나사부 상태", "type": "check", "method": "육안"},
                ],
            },
        ],
        "exclude": {"categories": EXCLUDED},
        "reasons": ["절단 길이 불량", "구멍 누락·위치 불량", "용접 누락", "용접 크기 부족", "균열·기공", "도면 정보 누락(표제·재질)", "도면 불일치 확인 필요", "기타"],
    }

    # 검사 기준은 손으로 고친 내용(auto, expect 등)을 보호하기 위해 이미 있으면 덮어쓰지 않음
    if not (out / "recipes.json").exists():
        (out / "recipes.json").write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✔ 시트 {len(SHEETS)}장, 항목 {len(items)}개, 위치 {len(placements)}개 → {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
