# 검사 대시보드 (Inspection Dashboard)

제조 검사의 대상(무엇을), 위치(어디서), 기준(어떤 기준으로)을 한 화면에서 확인하고 결과를 기록하는 웹 애플리케이션입니다.
화면 코드는 하나이며, 데이터 폴더를 바꾸면 PCB 와 용접 · 가공 도면을 같은 방식으로 다룹니다.

- 버전: 0.1.0
- 라이선스: 코드 [MIT](LICENSE) · 데이터는 원본 라이선스를 따름 ([라이선스](#라이선스))
- 포함 데이터: 공개 오픈소스 원본 2종 ([포함된 데이터](#포함된-데이터))

> [!IMPORTANT]
> 이 대시보드는 공개된 오픈소스 데이터로 만든 예시입니다. 만든 사람에게 PCB 실장 검사와 용접 · 가공 검사의 현장 지식이 부족해, 검사 항목과 판정 기준(공차, 확인 방법)을 엄밀하게 다듬지는 못했습니다. 실제 검사에 쓰려면 해당 분야 전문가가 기준을 검토하고 보완해야 합니다.
> 같은 내용을 애플리케이션 화면(현황 · 성적서 하단, 사용 방법 창)에도 표시합니다.

## 목차

1. [주요 기능](#주요-기능)
2. [요구 사항](#요구-사항)
3. [설치 및 실행](#설치-및-실행)
4. [포함된 데이터](#포함된-데이터)
5. [데이터 추가 및 재생성](#데이터-추가-및-재생성)
6. [프로젝트 구조](#프로젝트-구조)
7. [테스트](#테스트)
8. [범위와 제한](#범위와-제한)
9. [라이선스](#라이선스)

## 주요 기능

### 화면

| 화면 | 기능 |
|---|---|
| 현황 | 진행률, 상태별 건수(합격 · 불합격 · 보류 · 미검사), 분류별 진행과 검사 기준, 확인할 것(불합격 · 보류와 사유, 도면 확인 필요, 검사 준비 안 됨, 자동 확인 불일치), 상태별 색 3D(3D 모델이 있는 데이터) |
| 검사 | 목록(분류별, 검색, 상태 필터) · 도면(위치 강조, 면 · 시트 자동 전환, 확대 · 이동, 3D) · 기록(검사 기준, 입력값 자동 판정, 보류 · 사유 · 메모, 연결 문서) |
| 성적서 | 요약, 불합격 · 보류 상세(벗어난 값과 기준, 사유), 전체 판정표, 서명란. 브라우저 인쇄로 출력하거나 PDF 로 저장 |

화면 사용법은 [docs/user-guide.md](docs/user-guide.md) 에 있으며, 애플리케이션의 **사용 방법** 창(`?` 키)에도 요약되어 있습니다.

### 검사 항목의 구분

각 검사 항목은 `측정`, `육안`, `자동` 중 하나로 표시됩니다.

| 구분 | 내용 |
|---|---|
| 자동 | 입력값 판정(도면 치수 ± 공차), 해당하지 않는 항목 제외(`recipes.json` 의 `when`), 데이터 간 일치 비교(`auto`), CAD 데이터의 1번 패드 위치 표시 |
| 측정 | 측정값 입력. 허용 범위와 입력값을 막대로 표시하고 기준과의 차이를 수치로 표시 |
| 육안 | 이상 없음 / 이상 선택. 맞춰 볼 값(`expect`)과 도면의 1번 패드 위치(◆)를 함께 표시 |

판정은 입력값에 대한 규칙 판정입니다. 영상 기반 AI 판정은 포함하지 않습니다.

### 기록

- 브라우저 저장소(localStorage)에 데이터별로 자동 저장되며, 기록마다 검사자 이름과 시각이 함께 저장됩니다.
- 최근 30회의 기록 변경을 되돌릴 수 있습니다(`Ctrl`/`⌘` + `Z`).
- 검사 결과를 CSV(UTF-8, BOM 포함)로, 기록을 JSON 으로 내보내고 JSON 을 다시 가져올 수 있습니다.
- 주소 `#/<데이터>/<화면>/<번호>` 로 특정 항목을 바로 열 수 있습니다. 예: `#/lifetrac-iii/inspect/P01`
- 검사 기준은 항상 데이터 폴더의 `recipes.json` 을 사용합니다. 브라우저에 저장되거나 JSON 으로 가져온 기준은 사용하지 않습니다.

## 요구 사항

| 항목 | 버전 · 조건 |
|---|---|
| Node.js | 20.19 이상 또는 22.12 이상 (Vite 8 요구 사항) |
| 브라우저 | 최신 Chromium 계열에서 테스트했습니다. 3D 보기에는 WebGL 이 필요합니다 |
| Python | 3, `pymupdf`, `pillow` — PDF 도면집 변환 스크립트를 실행할 때만 필요합니다 |

## 설치 및 실행

```bash
npm install
npm run dev        # 개발 서버: http://localhost:5173
```

배포용 정적 파일은 다음 명령으로 만듭니다. 결과물(`dist/`)은 정적 웹서버로 제공해야 하며, `index.html` 을 파일로 직접 열면 데이터 파일을 읽을 수 없습니다.

```bash
npm run build      # dist/ 생성
npm run preview    # dist/ 확인용 로컬 서버
```

## 포함된 데이터

| ID | 원본 | 작성자 | 라이선스 |
|---|---|---|---|
| `pcb-lightsabre` | [LightSABRE DAC](https://github.com/Darmur/lightsabre-dac) — Raspberry Pi 용 오디오 DAC 기판 | Dario Murgia | [CC0 1.0](https://github.com/Darmur/lightsabre-dac/blob/main/LICENSE) |
| `lifetrac-iii` | [LifeTrac III Fabrication Drawings](https://commons.wikimedia.org/wiki/File:Open_Source_Ecology_-_LifeTrac_-_Fabrication_Drawings.pdf) — 트랙터 제작 도면 52장 | Open Source Ecology (도면 작성 F. Anzaldua, 2012) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

각 데이터 폴더의 `README.md` 에 파일별 출처를 기록했습니다.

### `pcb-lightsabre`

사용한 원본 파일은 아래 3개이며, 원본 저장소 커밋 [`506f15e`](https://github.com/Darmur/lightsabre-dac/tree/506f15e872af0c76b64efc45a509b61e0380cf5f) 의 파일과 같음을 확인했습니다(git blob 해시 비교).

| 원본 파일 | 생성 파일 | 변환 |
|---|---|---|
| `LightSABRE_DAC.kicad_pcb` | `items.csv`, `placements.csv`, `docs.csv`, `drawing-top.svg`, `drawing-bottom.svg` | `scripts/kicad-to-dataset.mjs` |
| `LightSABRE_DAC.pos.csv` | `placements.csv` 의 `machine_x`, `machine_y` | 같은 스크립트, 부품 번호로 결합 |
| `LightSABRE_DAC.3D-model.step` | `model.glb`, `model-map.json` | `scripts/step-to-glb.mjs` |

| 항목 | 값 |
|---|---|
| 부품 | 156개 (검사 대상 137, 검사 제외 19 — 피듀셜 마크 · 테스트 포인트 · 그래픽 · 기구 홀) |
| 검사 영역 | 풋프린트 코트야드(CrtYd) 외곽 |
| 1번 패드 | 패드 중심 좌표와 핀 기능 이름(파일에 있는 경우만, 예: 다이오드 `K`) |
| 실장기 좌표 결합 | 144개 |
| 데이터시트 링크 | 18종 (부품 속성 `Datasheet`) |
| 3D 부품 번호 매칭 | 검사 대상 137개 전부, 패키지 이름 기준 매칭의 위치 오차 최대 0.108 mm (`model-map.json`) |

- STEP 파일에는 부품 번호와 색 정보가 없습니다. 부품 번호는 패키지 이름과 위치로 매칭했고, 색은 부품 종류별로 지정했습니다.
- `recipes.json`(검사 기준)과 `meta.json` 은 이 프로젝트에서 작성했습니다.

### `lifetrac-iii`

| 항목 | 내용 |
|---|---|
| 원본 | PDF 1개 (`LifeTrac-Fabrication-Drawings.pdf`, 원본 그대로) |
| 도면 이미지 | 52장을 150 dpi 회색조 이미지로 변환 (`sheets/`) |
| 주 투상도 위치 | 이미지 처리로 자동 검출 |
| 도면명 · 척도 · 치수 · 용접 지시 10곳 | 사람이 도면을 판독해 입력 (원본 PDF 에 텍스트 층이 없음) |
| 원본 도면의 문제 4건 | `items.csv` 의 `review` 열에 기록 (도면명 철자 오기, 표제 미기재, 용접 기호 누락, 도면명과 치수 불일치) |
| 비워 둔 값 | 도면에 없는 수량 · 재질 |

이 폴더의 파생 데이터(목록, 좌표, 검사 기준, 이미지)는 원본과 같은 CC BY-SA 3.0 으로 배포합니다.

### 자동 확인 결과 (포함된 데이터 기준)

| 규칙 | 대상 | 결과 |
|---|---|---|
| `package-size` — BOM 설명의 칩 크기와 풋프린트의 칩 크기 비교 | `pcb-lightsabre` 107건 | 모두 일치 |
| `title-length` — 도면명의 길이(`55 INCH …`)와 `length_in` 비교 | `lifetrac-iii` 검사 대상 8건 | 모두 일치 |
| `when` — 극성 검사는 `spec` 이 `CP_` 로 시작하는 부품에만 적용 | `pcb-lightsabre` 커패시터 62개 | 54개 해당 없음 |

## 데이터 추가 및 재생성

### 새 데이터 추가

1. [docs/dataset-schema.md](docs/dataset-schema.md) 의 형식으로 `public/datasets/<id>/` 에 파일을 만듭니다.
2. `public/datasets/index.json` 에 `{ "id": "<id>", "name": "<표시 이름>", "domain": "<분야>" }` 를 추가합니다.
3. 형식 오류가 있으면 화면에 원인이 표시됩니다.

생성형 AI 로 데이터 파일을 만드는 방법은 [docs/user-guide.md](docs/user-guide.md#내-데이터-추가하기) 를 참고하십시오.

### 원본에서 재생성

```bash
# KiCad 기판 → 데이터
node scripts/kicad-to-dataset.mjs <board>.kicad_pcb public/datasets/<id> [<board>.pos.csv] [--name "<이름>"] [--source "<출처 URL>"]

# 기판 3D(STEP) → GLB + 부품 번호 매칭
node scripts/step-to-glb.mjs <board>.3D-model.step public/datasets/<id>

# LifeTrac 도면 PDF → 데이터
python -m venv .venv && .venv/bin/pip install pymupdf pillow
.venv/bin/python scripts/build-lifetrac-dataset.py <LifeTrac.pdf> public/datasets/lifetrac-iii
```

- 원본 파일은 [포함된 데이터](#포함된-데이터) 의 링크에서 받습니다.
- `kicad-to-dataset.mjs` 와 `build-lifetrac-dataset.py` 는 `recipes.json` 이 이미 있으면 덮어쓰지 않습니다.
- `build-lifetrac-dataset.py` 의 판독 값(도면명, 치수, 용접 위치)은 스크립트 안의 표(`SHEETS`, `WELDS`)에 있습니다.

## 프로젝트 구조

```
src/
  App.jsx                화면 조립
  core/                  판정 규칙 (React · 브라우저 API 없음)
    criteria.js            검사 항목: 적용 여부, 기준 범위, 판정, 기준 표기, 맞춰 볼 값
    status.js              항목 상태, 준비 문제, 집계
    autoRules.js           데이터 간 자동 비교 규칙
    navigation.js          목록 순서, 다음 미검사 항목
    history.js             되돌리기 기록
  io/                    외부 입출력
    loadDataset.js         데이터 폴더 읽기 · 형식 검사
    exporters.js           CSV · JSON 내보내기
    prefs.js               화면 설정 저장
  hooks/                 화면 상태
    useHashRoute.js        주소 ↔ 화면 상태
    useDataset.js          데이터 목록 · 데이터 불러오기
    useInspection.js       검사 기록 저장 · 되돌리기 · 가져오기
    useShortcuts.js        단축키
    useToast.js            알림
  components/            AppBar · Drawing · ModelViewer · Guide · Status
  pages/                 Overview(현황) · Report(성적서)
    inspect/               Inspect · ItemList · Record · CheckRow · Gauge (검사)
public/datasets/<id>/    데이터
scripts/                 원본 → 데이터 변환
tests/unit/              core 단위 테스트
tests/dashboard.spec.js  화면 테스트
docs/                    user-guide.md(사용 방법), dataset-schema.md(데이터 형식)
```

## 테스트

```bash
npx playwright install chromium   # 최초 1회
npm test                          # 단위 테스트 + 화면 테스트
npm run test:unit                 # 단위 테스트 (node --test)
npm run test:e2e                  # 화면 테스트 (Playwright, 개발 서버)
PREVIEW=1 npm run test:e2e        # 화면 테스트를 배포용 빌드로 실행
```

| 종류 | 수 | 확인하는 내용 |
|---|---|---|
| 단위 | 14 | 다음 미검사 순서, 되돌리기 묶음, 자동 비교 규칙(실제 데이터와 일부러 틀린 값), 해당 없음 판정, 맞춰 볼 값, 1번 패드 위치, 3D 부품 번호 매칭 |
| 화면 | 15 | 현황 · 검사 · 성적서 흐름, 자동 판정과 저장 유지, 단축키, 목록 필터, 도면 면 전환, 3D 클릭 선택과 상태 색(픽셀 비교), 도면 시트 전환, 내보내기 · 가져오기, 검사 기준 출처, 형식 오류 표시, 좁은 화면 |

## 범위와 제한

- 검사 기준(`recipes.json`)은 현장 전문가의 검토를 거치지 않았습니다(문서 첫머리의 안내 참고).
- 카메라 영상으로 불량을 판정하는 기능은 없습니다. 제품 사진과 합격 · 불합격 정답 데이터가 필요합니다.
- 실물 사진과 CAD 좌표를 정밀하게 겹치는 기능은 없습니다.
- 기록은 브라우저 단위로 저장됩니다. 여러 사용자가 함께 쓰는 서버 · 데이터베이스는 없습니다.
- 1번 패드 표시는 CAD 데이터가 있는 PCB 데이터에만 있습니다.

## 라이선스

| 대상 | 라이선스 |
|---|---|
| 소스 코드 | [MIT](LICENSE) |
| `public/datasets/pcb-lightsabre/` | CC0 1.0 (원본 [LICENSE](public/datasets/pcb-lightsabre/LICENSE)) |
| `public/datasets/lifetrac-iii/` | CC BY-SA 3.0 |

사용한 외부 패키지

| 패키지 | 버전 | 라이선스 | 용도 |
|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | 화면 |
| three | 0.186.1 | MIT | 3D 보기 |
| papaparse | 5.7.0 | MIT | CSV 읽기 |
| vite | 8.3.4 | MIT | 개발 서버 · 빌드 |
| @vitejs/plugin-react | 6.1.2 | MIT | 빌드 (React) |
| @playwright/test | 1.64.1 | Apache-2.0 | 화면 테스트 |
| @gltf-transform/core | 4.5.1 | MIT | GLB 작성 (변환 스크립트) |
| occt-import-js | 0.0.23 | LGPL-2.1 | STEP 읽기 (변환 스크립트) |

`occt-import-js` 와 `@gltf-transform/core` 는 변환 스크립트에서만 쓰는 개발 의존성이며, 배포용 빌드(`dist/`)에는 포함되지 않습니다.
