# 데이터 형식

검사 대시보드가 읽는 데이터 폴더의 형식을 정의합니다. 화면 코드는 하나이며, 이 형식을 따르는 폴더를 추가하면 새 데이터를 같은 화면에서 쓸 수 있습니다.

이 문서는 생성형 AI 에 그대로 전달해 데이터 파일 작성을 요청하는 용도로도 쓸 수 있습니다. 절차는 [user-guide.md](user-guide.md#내-데이터-추가하기) 를 참고하십시오.

## 목차

1. [폴더 구성](#1-폴더-구성)
2. [공통 규칙](#2-공통-규칙)
3. [index.json](#3-indexjson)
4. [meta.json](#4-metajson)
5. [items.csv](#5-itemscsv)
6. [placements.csv](#6-placementscsv)
7. [docs.csv](#7-docscsv)
8. [recipes.json](#8-recipesjson)
9. [판정 규칙](#9-판정-규칙)
10. [검증과 오류 표시](#10-검증과-오류-표시)

## 1. 폴더 구성

```
public/datasets/
  index.json               데이터 목록                                     필수
  <id>/
    meta.json              이름, 좌표계, 도면(면) 목록, 3D 모델              필수
    items.csv              검사 대상 목록                                   필수
    placements.csv         도면 위 위치                                     필수
    docs.csv               문서 목록                                        선택
    recipes.json           검사 기준, 검사 제외 분류, 사유 목록, 자동 비교     선택
    도면 파일 (.svg, .png)  meta.json 의 sides[].drawing 이 가리키는 파일      선택
    3D 파일 (.glb)          meta.json 의 model.url 이 가리키는 파일            선택
```

`recipes.json` 이 없으면 모든 항목이 '검사 준비 안 됨'(검사 기준 없음)으로 표시됩니다.

## 2. 공통 규칙

- 문자 인코딩은 UTF-8 입니다. 엑셀에서 저장할 때는 **CSV UTF-8(쉼표로 분리)** 형식을 선택합니다.
- CSV 첫 행은 열 이름입니다. 열 이름과 값의 앞뒤 공백은 무시되며, 빈 행은 건너뜁니다.
- 파일 경로는 데이터 폴더(`public/datasets/<id>/`) 기준 상대 경로입니다.
- 좌표는 `meta.json` 의 `unit` 단위이며, y 축은 아래쪽이 + 방향입니다.
- 모르는 값은 비워 둡니다. 비워 둔 위치 · 기준은 현황 화면의 '확인할 것'에 표시됩니다.

## 3. index.json

화면 왼쪽 위 데이터 선택 목록입니다.

```json
[
  { "id": "lifetrac-iii", "name": "LifeTrac III 트랙터 제작 도면", "domain": "용접·가공" }
]
```

| 키 | 필수 | 설명 |
|---|---|---|
| `id` | ✔ | 데이터 폴더 이름과 같아야 합니다 |
| `name` | ✔ | 선택 목록에 표시할 이름 |
| `domain` |  | 분야 |

## 4. meta.json

| 키 | 필수 | 설명 | 예 |
|---|---|---|---|
| `name` |  | 현황 화면 제목 | `"LifeTrac III 트랙터 제작 도면"` |
| `domain` |  | 분야 | `"PCB"`, `"용접·가공"` |
| `description` |  | 설명 (현황 화면) | |
| `source`, `license` |  | 출처 · 라이선스 (현황 › 데이터 출처 · 구성) | |
| `unit` |  | 좌표 단위 (표시용) | `"mm"`, `"px"` |
| `viewBox` | ✔* | 도면 좌표 범위 `[x, y, 폭, 높이]` | `[0, 0, 1648, 1438]` |
| `sides` | ✔ | 면(도면 한 장) 목록, 1개 이상 | 아래 표 |
| `model` |  | 3D 모델 `{ "url": "model.glb", "note": "…" }`. GLB 의 노드 이름 = 부품 번호 | |

\* 모든 `sides` 항목에 `viewBox` 가 있으면 최상위 `viewBox` 는 생략할 수 있습니다.

`sides` 항목

| 키 | 필수 | 설명 |
|---|---|---|
| `id` | ✔ | 면 id. `placements.csv` 의 `side` 가 참조 |
| `label` |  | 화면에 표시할 이름 |
| `drawing` |  | 배경 도면 파일. 없으면 위치 사각형만 표시 |
| `mirror` |  | `true` 이면 좌우를 뒤집어 표시 (PCB 뒷면을 뒤에서 본 모습) |
| `viewBox` |  | 이 면만의 좌표 범위 |

- 도면 이미지는 `viewBox` 범위 전체에 맞춰 그려집니다. 이미지 픽셀 좌표를 그대로 쓰려면 `viewBox` 를 `[0, 0, 이미지 폭, 이미지 높이]` 로, `unit` 을 `"px"` 로 둡니다.
- PCB 는 `top` / `bottom`, 도면집은 시트마다 하나(`s00`, `s01` …)처럼 **면 = 도면 한 장**으로 구성합니다.

## 5. items.csv

검사 대상 하나가 한 행입니다.

| 열 | 필수 | 설명 | PCB 예 | 용접 · 가공 예 |
|---|---|---|---|---|
| `ref` | ✔ | 고유 번호. 비어 있는 행은 무시하고, 중복이면 첫 행만 사용 | `C12` | `P01` |
| `category` | ✔ | 분류. 검사 기준 연결과 분류별 집계의 기준 | `커패시터` | `프레임 각관` |
| `group` | ✔ | 같은 사양끼리 묶는 이름 (목록 순서에 사용) | `커패시터 · CAP CER 100NF 0603` | `프레임 각관 · □4.000×4.000×.250 R.250` |
| `name` |  | 이름 · 설명 | `100nF 50V X7R` | `전면 수직 각관 55인치` |
| `value` |  | 값 · 도면명 | `CAP-100N-…` | `55 INCH FRONT-VERTICAL TUBE` |
| `spec` |  | 규격 · 패키지 · 재질 | `C_0603_1608Metric` | `□4.000×4.000×.250 R.250` |
| `part_no` |  | 품번 | `CGA0603X7R104K500JT` | `LifeTrac III 시트 #01` |
| `doc_id` |  | 연결 문서 id. 여러 개는 `;` 로 구분 | `DS-03` | `DWG-01` |
| `note` |  | 비고 | `DNP(미실장)` | `구매품` |
| `review` |  | 원본 자료의 문제 메모. 값이 있으면 '도면 확인 필요'로 표시 | | `도면명 미기재 — 표제란에 'TITLE'` |
| (추가 열) |  | 검사 기준의 `nominal`, `when`, `expect` 가 참조하는 값 | | `length_in`=55, `holes`=12 |

## 6. placements.csv

도면 위 검사 영역 하나가 한 행입니다. 한 번호가 여러 면에 나오면 여러 행으로 적습니다.

| 열 | 필수 | 설명 |
|---|---|---|
| `ref` | ✔ | `items.csv` 의 번호. 목록에 없는 번호는 도면에 점선으로 표시 |
| `x`, `y` | ✔ | 검사 영역의 **중심** 좌표 |
| `w`, `h` | ✔ | 검사 영역 폭 · 높이 |
| `side` | ✔ | `meta.json` 의 `sides[].id` |
| `rotation` |  | 회전각(도). 표시용 |
| `area_source` |  | 영역의 근거 (예: `CAD.CrtYd`, `도면 판독`) |
| `machine_x`, `machine_y` |  | (PCB) 실장기 좌표 (`.pos.csv` 값) |
| `pin1_x`, `pin1_y` |  | (PCB) 1번 패드 중심 좌표. 도면에 ◆ 로 표시 |
| `pin1_label` |  | (PCB) 1번 패드의 핀 기능 이름. 원본 CAD 파일에 있는 경우만 (예: `K`) |

PCB 의 검사 영역은 KiCad 풋프린트의 코트야드(`F.CrtYd` / `B.CrtYd`) 외곽을 사용합니다. 코트야드가 없는 풋프린트는 패드 외곽(`CAD.Pad`)으로 대신합니다.
KiCad 라이브러리 규칙 [KLC F5.3](https://klc.kicad.org/footprint/f5/f5.3/) 은 코트야드를 부품 몸체와 랜드 패턴을 합친 경계 둘레에 최소한의 전기적 · 기계적 여유를 둔 가장 작은 영역으로 정의하며, IPC-7351C 를 따릅니다. 여유는 일반 0.25 mm, 어느 한 변이 1.5 mm 보다 작은 부품은 0.15 mm, 커넥터 · 전해 커패시터 · 크리스털은 0.5 mm 입니다.

## 7. docs.csv

| 열 | 필수 | 설명 |
|---|---|---|
| `doc_id` | ✔ | 문서 id. `items.csv` 의 `doc_id` 가 참조 |
| `title` | ✔ | 제목 |
| `type` |  | 종류 (데이터시트, 제작 도면, 검사기준서 등) |
| `url` |  | `https://…` 외부 주소 또는 데이터 폴더 기준 상대 경로 |
| `summary` |  | 요약. 기록 칸의 문서 링크 아래에 그대로 표시 |

문서는 검사 화면 기록 칸의 '문서'에 링크로 표시되며, 새 탭에서 열립니다.

## 8. recipes.json

```json
{
  "templates": [
    {
      "id": "R-TUBE",
      "label": "각관 절단·천공 검사",
      "appliesTo": { "categories": ["프레임 각관", "로더 암 각관"] },
      "checks": [
        { "id": "length", "label": "절단 길이", "type": "number", "unit": "in", "nominal": "length_in", "tol": 0.5, "method": "줄자" },
        { "id": "section", "label": "단면 규격 일치", "type": "check", "expect": "spec", "method": "버니어" }
      ]
    }
  ],
  "exclude": { "categories": ["체결 부품"] },
  "reasons": ["절단 길이 불량", "구멍 누락·위치 불량", "기타"],
  "auto": [{ "id": "title", "label": "도면명 길이 = 도면 치수", "rule": "title-length" }]
}
```

### templates

| 키 | 필수 | 설명 |
|---|---|---|
| `id`, `label` | ✔ | 기준 id 와 이름 |
| `appliesTo` | ✔ | 적용 대상. `refs`(번호 목록)가 먼저 적용되고, 그다음 `category`(분류 하나) 또는 `categories`(분류 목록) |
| `checks` | ✔ | 검사 항목 목록 (아래 표) |

### checks (검사 항목)

| 키 | 필수 | 설명 |
|---|---|---|
| `id`, `label` | ✔ | 항목 id 와 이름 |
| `type` | ✔ | `check`(이상 없음 / 이상), `number`(수치), `select`(선택), `text`(글) |
| `method` |  | 확인 방법 · 도구 |
| `unit` |  | 수치 단위 (`number`) |
| `min`, `max` |  | 고정 허용 범위 (`number`) |
| `nominal` |  | 기준값을 가져올 `items.csv` 열 이름 (`number`). 허용 범위 = 기준값 ± `tol` |
| `tol` |  | `nominal` 의 허용 공차. 없으면 0 (기준값과 같아야 합격) |
| `minFromNominal` |  | `true` 이면 기준값 이상이면 합격 (예: 용접 크기) |
| `options`, `pass` |  | 선택지와 합격 선택지 (`select`). `pass` 가 없으면 무엇을 골라도 합격 |
| `when` |  | 적용 조건 `{ "<items.csv 열>": "<정규식>" }`. 맞지 않는 항목은 '해당 없음'으로 판정에서 제외 |
| `expect` |  | 육안 확인 때 '맞춰 볼 값'으로 표시할 `items.csv` 열 이름. `group` 이면 앞의 '분류 · ' 를 떼고 표시 |
| `marker` |  | `"pin1"` 이면 `placements.csv` 의 1번 패드 위치를 기준 설명에 함께 표시 |

- `nominal` 이 가리키는 열이 비어 있으면 기준 범위 없이 측정값만 기록하며, 값을 입력하면 통과로 처리합니다.
- 화면의 항목 표시는 `number` 가 `측정`, 그 밖의 유형이 `육안`, `when` 에 맞지 않는 항목이 `자동`(해당 없음)입니다.

### exclude, reasons

| 키 | 설명 |
|---|---|
| `exclude.categories` | 검사 제외 분류. 진행률 · 성적서의 대상에서 빠집니다 |
| `reasons` | 불합격 · 보류일 때 고르는 사유 목록 |

### auto (데이터 간 자동 비교)

| 키 | 설명 |
|---|---|
| `id`, `label` | 비교 id 와 이름 |
| `rule` | 규칙 이름. `src/core/autoRules.js` 의 `AUTO_RULES` 에 정의된 것만 사용할 수 있습니다 |

| 규칙 | 비교 내용 | 비교하지 않는 경우 |
|---|---|---|
| `package-size` | `group` · `name` · `value` 의 칩 크기 코드(0201 · 0402 · 0603 · 0805 · 1206 · 1210 · 2512)와 `spec` 의 칩 크기 코드 | 어느 한쪽에 코드가 없을 때 |
| `title-length` | `value` 가 `<숫자> INCH <글자>` 로 시작할 때 그 숫자와 `length_in` | 형식이 다르거나 `length_in` 이 비었을 때 |

어긋난 항목은 현황 화면 '확인할 것 › 자동 확인 불일치'에 표시됩니다. 검사 제외 분류는 이 목록에 넣지 않습니다.

## 9. 판정 규칙

항목 상태는 다음 순서로 정해집니다.

| 순서 | 조건 | 상태 |
|---|---|---|
| 1 | 분류가 `exclude.categories` 에 있음 | 검사 제외 |
| 2 | 보류로 표시함 | 보류 |
| 3 | 검사 기준이 없거나 기록이 없음 | 미검사 |
| 4 | 적용되는 항목 중 하나라도 불통과 | 불합격 |
| 5 | 적용되는 항목이 모두 통과 | 합격 |
| 6 | 일부만 입력함 | 검사 중 |

'해당 없음' 항목(`when`)은 4~6 의 판정에서 제외합니다. 수치 비교에는 1e-9 의 오차를 허용합니다.

## 10. 검증과 오류 표시

데이터를 불러올 때 다음을 검사합니다.

| 구분 | 조건 | 표시 |
|---|---|---|
| 형식 오류 | `meta.json` 을 JSON 으로 읽을 수 없음, `sides` 가 없거나 비었음, `sides[].id` 없음, `viewBox` 없음, CSV 필수 열 없음 | 화면에 오류 상자. 데이터를 표시하지 않음 |
| 파일 없음 | `meta.json`, `items.csv`, `placements.csv` 를 찾을 수 없음 | 화면에 오류 상자 |
| 데이터 확인 필요 | `ref` 중복, 좌표가 숫자가 아님, `side` 가 `meta.json` 에 없음, `doc_id` 가 `docs.csv` 에 없음 | 현황 › 데이터 출처 · 구성 아래 목록 |

CSV 필수 열: `items.csv` — `ref`, `category`, `group` · `placements.csv` — `ref`, `x`, `y`, `w`, `h`, `side` · `docs.csv` — `doc_id`, `title`
