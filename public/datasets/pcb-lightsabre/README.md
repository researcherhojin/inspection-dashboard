# pcb-lightsabre — 출처

- 원본: **LightSABRE DAC** by Dario "Darmur" Murgia — https://github.com/Darmur/lightsabre-dac
- 라이선스: CC0 1.0 Universal (이 폴더의 `LICENSE` = 원본 저장소의 LICENSE)
- 기준 커밋: `506f15e` (2026-09-21)
- 사용한 원본 파일
  - `LightSABRE_DAC.kicad_pcb` → `items.csv`, `placements.csv`(코트야드 영역 · 1번 패드), `docs.csv`(Datasheet 속성), `drawing-top.svg`, `drawing-bottom.svg` — `scripts/kicad-to-dataset.mjs`
  - `LightSABRE_DAC.pos.csv` → `placements.csv` 의 `machine_x`, `machine_y`
  - `LightSABRE_DAC.3D-model.step` → `model.glb`, `model-map.json` — `scripts/step-to-glb.mjs`
- 이 프로젝트에서 작성: `recipes.json`(검사 기준), `meta.json`
- 3D 의 색은 원본에 없어 부품 종류별로 지정했고, 부품 번호는 패키지 이름 + 위치로 맞췄습니다(`model-map.json` 에 결과와 오차).
