# Inspection Dashboard

[![Demo](https://img.shields.io/badge/demo-live-F38020?logo=cloudflare&logoColor=white)](https://inspection-dashboard.inspection-dashboard.workers.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A520.19-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-0.186-000000?logo=threedotjs&logoColor=white)
![Papa Parse](https://img.shields.io/badge/Papa%20Parse-5.7-555555)
![Playwright](https://img.shields.io/badge/Playwright-1.64-2EAD33?logo=playwright&logoColor=white)

제조 검사의 **대상 · 위치 · 기준**을 한 화면에서 보고 기록하는 웹앱.
데이터 폴더만 바꾸면 PCB 와 용접 · 가공 도면을 같은 화면으로 다룹니다.

> [!IMPORTANT]
> 공개 데이터로 만든 예시입니다. 만든 사람에게 해당 분야 현장 지식이 부족해 검사 기준(공차, 확인 방법)은 엄밀하게 검증되지 않았습니다. 실사용 전 전문가 검토가 필요합니다.

## Features

| 화면 | 내용 |
|---|---|
| 현황 | 진행률 · 분류별 진행 · 확인할 것 · 상태 색 3D |
| 검사 | 목록 \| 도면 · 3D \| 기록 (입력 즉시 판정) |
| 성적서 | 요약 · 불합격 상세 · 전체 판정표 · 인쇄 / PDF |

- 규칙 기반 판정 — `도면 치수 ± 공차`. AI 영상 판정 없음
- 항목 구분 `측정` / `육안` / `자동` — 해당 없는 항목 제외, 데이터 간 일치 비교, CAD 1번 패드 표시
- localStorage 저장 · undo 30단계 · CSV / JSON 입출력 · 딥링크 `#/<data>/<page>/<ref>`

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit + e2e  (최초 1회: npx playwright install chromium)
npm run build        # → dist/
npx wrangler deploy  # Cloudflare Workers static assets
```

## Data

| ID | Source | License |
|---|---|---|
| `pcb-lightsabre` | [Darmur/lightsabre-dac](https://github.com/Darmur/lightsabre-dac) @ `506f15e` | CC0 1.0 |
| `lifetrac-iii` | [OSE LifeTrac III Fabrication Drawings](https://commons.wikimedia.org/wiki/File:Open_Source_Ecology_-_LifeTrac_-_Fabrication_Drawings.pdf) | CC BY-SA 3.0 |

- **PCB** — `.kicad_pcb` · `.pos.csv` · `.3D-model.step` 자동 변환. 156 parts (137 검사 대상), 3D 매칭 137/137 (최대 0.108 mm)
- **LifeTrac** — 스캔 PDF 52장. 치수 · 용접 위치는 수작업 판독, 원본 도면 결함 4건은 `review` 열
- `recipes.json`(검사 기준)은 이 프로젝트에서 작성. 파일별 출처는 `public/datasets/*/README.md`

```bash
node scripts/kicad-to-dataset.mjs <board>.kicad_pcb public/datasets/<id> [<board>.pos.csv]
node scripts/step-to-glb.mjs <board>.3D-model.step public/datasets/<id>
python scripts/build-lifetrac-dataset.py <LifeTrac.pdf> public/datasets/lifetrac-iii   # pymupdf, pillow
```

## Project structure

```
src/
├── core/         판정 · 자동 비교 · 순서 · undo (pure, unit-tested)
├── io/           dataset loader · export · prefs
├── hooks/        route · dataset · inspection store · shortcuts
├── components/   AppBar · Drawing · ModelViewer · Guide · Status
└── pages/        Overview · Report · inspect/
public/datasets/  데이터
scripts/          KiCad · STEP · PDF → dataset
tests/            unit/ · dashboard.spec.js
```

## Docs

- [사용 방법](docs/user-guide.md)
- [데이터 형식](docs/dataset-schema.md)

## License

Code [MIT](LICENSE) · Data는 원본 라이선스(위 표).
`occt-import-js`(LGPL-2.1)는 변환 스크립트 전용 dev 의존성으로 빌드 산출물에 포함되지 않습니다.
