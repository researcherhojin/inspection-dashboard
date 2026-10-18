# lifetrac-iii — 출처

- 원본: **LifeTrac III Fabrication Drawings**, Open Source Ecology (도면 작성 F. Anzaldua, 2012)
  https://commons.wikimedia.org/wiki/File:Open_Source_Ecology_-_LifeTrac_-_Fabrication_Drawings.pdf
- 라이선스: CC BY-SA 3.0 — https://creativecommons.org/licenses/by-sa/3.0/
- `LifeTrac-Fabrication-Drawings.pdf` 는 원본 그대로입니다.
- 파생 데이터 (`scripts/build-lifetrac-dataset.py`)
  - `sheets/sheet-00.png` … `sheet-51.png`: 원본 52장을 150dpi 이미지로 변환
  - `placements.csv`: 주 투상도 위치는 이미지 처리로 자동 검출, 용접 위치 10곳은 사람이 판독
  - `items.csv`, `docs.csv`: 도면명 · 척도 · 치수 · 용접 지시를 사람이 판독 (도면에 없는 수량 · 재질은 비워 둠, 원본 도면의 문제는 `review` 열)
  - `recipes.json`, `meta.json`: 이 프로젝트에서 작성
- 위 파생 데이터도 원본과 같은 **CC BY-SA 3.0** 으로 배포합니다. 다시 쓸 때는 Open Source Ecology 를 출처로 밝히고 같은 라이선스를 유지해 주세요.
