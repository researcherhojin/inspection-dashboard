# Dataset schema

`public/datasets/<id>/` 폴더 하나가 데이터 하나입니다. 이 문서를 생성형 AI 에 그대로 전달해 데이터 작성을 요청할 수 있습니다 ([절차](user-guide.md#adding-your-own-data)).

## Layout

```
public/datasets/
├── index.json          데이터 목록                     required
└── <id>/
    ├── meta.json       이름 · 좌표계 · 면 · 3D           required
    ├── items.csv       검사 대상                        required
    ├── placements.csv  도면 위 위치                     required
    ├── docs.csv        문서                             optional
    ├── recipes.json    검사 기준 · 제외 · 사유 · 자동 비교  optional (없으면 전부 '준비 안 됨')
    └── *.svg|png|glb   도면 · 3D                        optional
```

UTF-8 · CSV 첫 행은 헤더 · 앞뒤 공백 무시 · 경로는 데이터 폴더 기준 · y 축 아래가 + · **모르는 값은 비움**

## index.json

```json
[{ "id": "lifetrac-iii", "name": "LifeTrac III 트랙터 제작 도면", "domain": "용접·가공" }]
```
`id` = 폴더 이름.

## meta.json

| Key | Req | Description |
|---|---|---|
| `name`, `domain`, `description` | | 현황 제목 · 분야 · 설명 |
| `source`, `license` | | 출처 · 라이선스 |
| `unit` | | 좌표 단위 (표시용) |
| `viewBox` | ✔* | `[x, y, w, h]` — 모든 `sides` 에 있으면 생략 가능 |
| `sides[]` | ✔ | `{ id, label?, drawing?, mirror?, viewBox? }` — 면 = 도면 한 장. `mirror` 는 좌우 반전(PCB 뒷면) |
| `model` | | `{ url, note }` — GLB, 노드 이름 = `ref` |

도면 이미지는 `viewBox` 전체에 맞춰 그림. 픽셀 좌표를 쓰려면 `[0, 0, 폭, 높이]` + `"unit": "px"`.

## items.csv

| Column | Req | Description | e.g. |
|---|---|---|---|
| `ref` | ✔ | 고유 번호 (빈 행 무시, 중복은 첫 행) | `C12`, `P01` |
| `category` | ✔ | 분류 — 기준 연결 · 집계 단위 | `커패시터` |
| `group` | ✔ | 동일 사양 묶음 — 목록 순서 | `커패시터 · CAP CER 100NF 0603` |
| `name`, `value`, `spec`, `part_no`, `note` | | 이름 · 값 · 규격 · 품번 · 비고 | `C_0603_1608Metric` |
| `doc_id` | | 문서 id, `;` 구분 | `DS-03` |
| `review` | | 원본 자료 문제 → 현황 › 도면 확인 필요 | `도면명 미기재` |
| *extra* | | `nominal` · `when` · `expect` 가 참조 | `length_in=55` |

## placements.csv

| Column | Req | Description |
|---|---|---|
| `ref` | ✔ | `items.csv` 번호 (없는 번호는 도면에 점선). 여러 면이면 여러 행 |
| `x`, `y`, `w`, `h` | ✔ | 영역 **중심** 좌표와 크기 |
| `side` | ✔ | `sides[].id` |
| `rotation`, `area_source` | | 회전각(표시용) · 영역 근거 |
| `machine_x`, `machine_y` | | PCB 실장기 좌표 (`.pos.csv`) |
| `pin1_x`, `pin1_y`, `pin1_label` | | PCB 1번 패드 중심 · 핀 기능 이름(파일에 있을 때만) → 도면 ◆ |

PCB 영역은 풋프린트 코트야드(`*.CrtYd`) 외곽, 없으면 패드 외곽. 코트야드 정의는 [KLC F5.3](https://klc.kicad.org/footprint/f5/f5.3/) (IPC-7351C, 여유 0.25 mm / 1.5 mm 미만 부품 0.15 mm / 커넥터 · 전해 커패시터 · 크리스털 0.5 mm).

## docs.csv

| Column | Req | Description |
|---|---|---|
| `doc_id`, `title` | ✔ | id · 제목 |
| `type`, `url`, `summary` | | 종류 · 외부 URL 또는 상대 경로 · 요약 |

검사 › 기록의 링크로 표시(새 탭).

## recipes.json

```json
{
  "templates": [{
    "id": "R-TUBE", "label": "각관 절단·천공 검사",
    "appliesTo": { "categories": ["프레임 각관"] },
    "checks": [
      { "id": "length",  "label": "절단 길이",   "type": "number", "unit": "in", "nominal": "length_in", "tol": 0.5 },
      { "id": "section", "label": "단면 규격 일치", "type": "check", "expect": "spec" }
    ]
  }],
  "exclude": { "categories": ["체결 부품"] },
  "reasons": ["절단 길이 불량", "기타"],
  "auto": [{ "id": "title", "label": "도면명 길이 = 도면 치수", "rule": "title-length" }]
}
```

**templates** — `appliesTo` 우선순위: `refs` → `category` / `categories`

**checks**

| Key | Description |
|---|---|
| `type` | `check` 이상 유무 · `number` 수치 · `select` 선택 · `text` 글 |
| `min`, `max` | 고정 범위 |
| `nominal`, `tol` | 기준값 열 ± 공차 (`tol` 기본 0). 열이 비면 범위 없이 기록만 |
| `minFromNominal` | `true` → 기준값 이상 합격 |
| `options`, `pass` | `select` 선택지 · 합격값 (`pass` 없으면 모두 합격) |
| `when` | `{ "<column>": "<regex>" }` 불일치 → 해당 없음 (판정 제외) |
| `expect` | 육안 '맞춰 볼 값' 열 (`group` 은 '분류 · ' 접두어 제거) |
| `marker` | `"pin1"` → 1번 패드 위치 안내 |
| `unit`, `method` | 단위 · 확인 방법 |

화면 구분: `number` = 측정, 그 외 = 육안, `when` 불일치 = 자동.

**exclude** — 검사 제외 분류 · **reasons** — 불합격 · 보류 사유

**auto** — 규칙은 [`src/core/autoRules.js`](../src/core/autoRules.js) 에 정의된 것만

| Rule | Compares | Skipped when |
|---|---|---|
| `package-size` | `group`/`name`/`value` 의 칩 코드 vs `spec` 의 칩 코드 (0201–2512) | 한쪽에 코드 없음 |
| `title-length` | `value` 의 `<n> INCH …` vs `length_in` | 형식 불일치 · 값 없음 |

불일치 → 현황 › 자동 확인 불일치 (검사 제외 분류는 제외).

## Status resolution

`검사 제외` → `보류` → (기준 · 기록 없음) `미검사` → 하나라도 불통과 `불합격` → 전부 통과 `합격` → 일부 입력 `검사 중`

`when` 불일치 항목은 판정에서 제외. 수치 비교 허용 오차 1e-9.

## Validation

| Level | Condition | Shown |
|---|---|---|
| Error | `meta.json` 파싱 실패 · `sides` 없음/빈 배열 · `sides[].id` 없음 · `viewBox` 없음 · 필수 열 없음 · 필수 파일 없음 | 오류 상자, 데이터 미표시 |
| Warning | `ref` 중복 · 비숫자 좌표 · 미정의 `side` · 미정의 `doc_id` | 현황 › 데이터 출처 · 구성 |

필수 열 — `items.csv`: `ref` `category` `group` · `placements.csv`: `ref` `x` `y` `w` `h` `side` · `docs.csv`: `doc_id` `title`
