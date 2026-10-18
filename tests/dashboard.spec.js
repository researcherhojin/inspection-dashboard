// 검사 대시보드 — 실제 브라우저에서 현황 · 검사 · 성적서 흐름을 확인
import { test, expect } from '@playwright/test';

const SHOTS = 'tests/screenshots';

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
test.afterEach(async ({ page }) => {
  expect(page.errors, page.errors.join('\n')).toEqual([]);
});

const record = (page) => page.locator('.record');
const check = (page, label) => record(page).locator('.check', { hasText: label });
const status = (page) => record(page).locator('.r-head .st');

test('현황(LifeTrac): 진행 · 분류별 · 확인할 것 → 검사 시작', async ({ page }) => {
  await page.goto('/#/lifetrac-iii/overview');
  await expect(page.getByRole('heading', { name: 'LifeTrac III 트랙터 제작 도면 (Open Source Ecology)' })).toBeVisible();
  await expect(page.locator('.stat.big b')).toHaveText('0%');
  await expect(page.locator('.stat.big')).toContainText('판정 0 / 49');
  // 분류별: 검사 제외 분류는 따로 표시
  await expect(page.locator('.ov-cols tr', { hasText: '프레임 각관' })).toContainText('각관 절단·천공 검사');
  await expect(page.locator('.ov-cols tr', { hasText: '체결 부품' })).toContainText('검사 제외');
  // 확인할 것: 도면 판독 중 의심 항목 4건 (items.csv 의 review 열)
  await expect(page.locator('[data-group=review] h4')).toContainText('4');
  await expect(page.locator('[data-group=review]')).toContainText('VALVE');
  await expect(page.locator('[data-group=problems] h4')).toContainText('0');
  await expect(page.locator('.ov-3d')).toHaveCount(0); // 3D 모델 파일이 없는 데이터는 3D 를 보여 주지 않음
  await expect(page.locator('.domain-note')).toContainText('해당 분야 전문가가 기준을 검토하고 보완해야 합니다'); // 만든 사람의 한계를 밝힘
  await page.screenshot({ path: `${SHOTS}/01-overview-lifetrac.png`, fullPage: true });

  await page.getByRole('button', { name: /검사 시작 · 남은 49건/ }).click();
  await expect(page).toHaveURL(/#\/lifetrac-iii\/inspect\/[PW]\d{2}$/);
  await expect(record(page).locator('h2')).toHaveText(/^[PW]\d{2}$/);
});

test('검사(LifeTrac): 도면 치수 ± 공차로 자동 판정 → 사유 → 현황·성적서에 반영, 새로고침해도 유지', async ({ page }) => {
  await page.goto('/#/lifetrac-iii/inspect/P01');
  await expect(record(page).locator('h2')).toHaveText('P01');
  await expect(check(page, '절단 길이')).toContainText('55 ± 0.5 in');
  await expect(check(page, '구멍 개수')).toContainText('12 개');
  await expect(page.locator('.area.sel')).toHaveCount(1); // 도면에서 위치 강조
  await page.locator('#inspector-input').fill('이호진');

  // A: 이상 유무 칸 모두 이상 없음 → 수치 입력, Enter 로 다음 칸
  await page.locator('.list').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('a');
  await expect(check(page, '단면 규격 일치')).toHaveClass(/ok/);
  await check(page, '절단 길이').locator('input').fill('55.2');
  await page.keyboard.press('Enter');
  await expect(check(page, '구멍 개수').locator('input')).toBeFocused();
  await page.keyboard.type('11');
  await page.keyboard.press('Enter');
  await page.keyboard.type('0.813');
  await expect(check(page, '구멍 개수')).toHaveClass(/bad/);
  await expect(status(page)).toContainText('불합격');

  // 불합격이면 사유 선택 칸이 나타남
  await record(page).getByLabel('사유').selectOption('구멍 누락·위치 불량');
  await expect(page.locator('.area.sel.st-fail, .area.st-fail')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/02-inspect-fail.png` });

  await page.reload();
  await expect(status(page)).toContainText('불합격');
  await expect(check(page, '절단 길이').locator('input')).toHaveValue('55.2');

  await page.getByRole('button', { name: '현황' }).click();
  await expect(page.locator('[data-group=problems]')).toContainText('P01');
  await expect(page.locator('[data-group=problems]')).toContainText('구멍 누락·위치 불량');
  await expect(page.locator('.ov-cols tr', { hasText: '프레임 각관' })).toContainText('불합격 1');

  await page.getByRole('button', { name: '성적서' }).click();
  const prob = page.locator('.sheet table').first();
  await expect(prob).toContainText('P01');
  await expect(prob).toContainText('구멍 개수 11 개');
  await expect(prob).toContainText('(12 개)');
  await expect(page.locator('.sheet-head')).toContainText('이호진');
  await page.screenshot({ path: `${SHOTS}/04-report.png` });

  // 성적서의 번호를 누르면 그 항목 검사 화면으로
  await prob.getByRole('button', { name: 'P01' }).click();
  await expect(page).toHaveURL(/inspect\/P01$/);
});

test('키보드: N 다음 미검사, J/K 이동, / 검색, Ctrl+Z 되돌리기', async ({ page }) => {
  await page.goto('/#/lifetrac-iii/inspect');
  await expect(record(page)).toContainText('왼쪽 목록이나 도면에서 항목을 고르세요');
  await page.keyboard.press('n');
  const first = await record(page).locator('h2').textContent();
  await page.keyboard.press('j');
  await expect(record(page).locator('h2')).not.toHaveText(first);
  await page.keyboard.press('k');
  await expect(record(page).locator('h2')).toHaveText(first);

  await page.keyboard.press('a');
  await expect(record(page).locator('.check.ok').first()).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(record(page).locator('.check.ok')).toHaveCount(0);

  await page.keyboard.press('/');
  await expect(page.locator('#item-search')).toBeFocused();
  await page.keyboard.type('j'); // 입력 중에는 단축키가 동작하지 않음
  await expect(record(page).locator('h2')).toHaveText(first);
});

test('목록: 남음 · 불합격·보류 필터와 검색', async ({ page }) => {
  await page.goto('/#/lifetrac-iii/inspect/W01');
  await record(page).getByRole('button', { name: '이상', exact: true }).first().click();
  await expect(status(page)).toContainText('불합격');
  await page.locator('.list .seg').getByRole('button', { name: /불합격·보류/ }).click();
  await expect(page.locator('.list .row')).toHaveCount(1);
  await page.locator('.list .seg').getByRole('button', { name: /남음/ }).click();
  await expect(page.locator('.list .seg button.on')).toContainText('48');
  await page.locator('.list .seg').getByRole('button', { name: /전체/ }).click();
  await page.locator('#item-search').fill('로더 암');
  await expect(page.locator('.list .row', { hasText: 'P18' })).toBeVisible();
  await expect(page.locator('.list .row', { hasText: 'P02' })).toHaveCount(0);
});

test('PCB: 검색 → 도면 강조, 뒷면 부품은 면 자동 전환, 도면 클릭 선택', async ({ page }) => {
  await page.goto('/#/pcb-lightsabre/inspect');
  await page.locator('#item-search').fill('ES9018');
  await page.locator('.list .row', { hasText: 'U5' }).click();
  await expect(record(page).locator('h2')).toHaveText('U5');
  await expect(check(page, '1번 핀')).toBeVisible();
  await expect(record(page).locator('.docs')).toContainText('ES9018');
  await expect(page.locator('.area.sel')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/03-inspect-pcb.png` });

  await page.locator('#item-search').fill('J6');
  await page.locator('.list .row', { hasText: 'J6' }).click();
  await expect(page.getByLabel('도면 선택')).toHaveValue('bottom');

  // 도면에서 다른 부품을 클릭하면 선택이 바뀜
  await page.locator('#item-search').fill('');
  const box = await page.locator('.area:not(.sel)').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(record(page).locator('h2')).not.toHaveText('J6');
});

test('PCB 3D: 클릭하면 목록·기록이 따라오고, 불합격은 빨간색', async ({ page }) => {
  await page.goto('/#/pcb-lightsabre/inspect/U5');
  await page.locator('.d-tools').getByRole('button', { name: '3D' }).click();
  const stage = page.locator('.drawing .mv-stage');
  await expect.poll(async () => Number((await stage.getAttribute('data-nodes')) || 0), { timeout: 20000 }).toBeGreaterThanOrEqual(137);
  await expect(stage).toHaveAttribute('data-selected', 'U5');

  // 다른 부품에 가려지지 않은 전해 커패시터 하나를 직접 클릭
  let target = null, pt = null;
  for (const ref of ['C3', 'C6', 'C9', 'C10', 'C15', 'C16', 'C17']) {
    const q = await stage.evaluate((el, r) => el.__project(r), ref);
    if ((await stage.evaluate((el, q) => el.__hitAt(q.x, q.y), q)) === ref) {
      target = ref;
      pt = q;
      break;
    }
  }
  expect(target, '보이는 전해 커패시터').not.toBeNull();
  const before = await stage.evaluate((el, q) => el.__pixel(q.x, q.y), pt);
  await page.mouse.click(pt.x, pt.y);
  await expect(record(page).locator('h2')).toHaveText(target);
  await expect(page.locator('.list .row.sel')).toContainText(target);

  await check(page, '부품 유무').getByRole('button', { name: '이상', exact: true }).click();
  await expect(status(page)).toContainText('불합격');
  await page.mouse.move(5, 5);
  await expect
    .poll(async () => {
      const q = await stage.evaluate((el, r) => el.__project(r), target);
      const [r, g, b] = await stage.evaluate((el, q) => el.__pixel(q.x, q.y), q);
      return r - Math.max(g, b) - (before[0] - Math.max(before[1], before[2]));
    })
    .toBeGreaterThan(40);
  await page.screenshot({ path: `${SHOTS}/05-inspect-3d.png` });
});

test('현황(PCB): 3D 에서 부품을 누르면 그 부품 검사 화면으로', async ({ page }) => {
  await page.goto('/#/pcb-lightsabre/overview');
  const stage = page.locator('.ov-3d .mv-stage');
  await expect.poll(async () => Number((await stage.getAttribute('data-nodes')) || 0), { timeout: 20000 }).toBeGreaterThanOrEqual(137);
  await page.screenshot({ path: `${SHOTS}/06-overview-pcb.png`, fullPage: true });
  await stage.scrollIntoViewIfNeeded();
  const q = await stage.evaluate((el) => el.__project('U5'));
  const hit = await stage.evaluate((el, q) => el.__hitAt(q.x, q.y), q);
  await page.mouse.click(q.x, q.y);
  await expect(page).toHaveURL(new RegExp(`inspect/${hit}$`));
});

test('도면 시트를 바꾸는 동안 이전 시트가 보이지 않음', async ({ page }) => {
  await page.route('**/sheets/sheet-02.png', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto('/#/lifetrac-iii/inspect/P01');
  const img = page.locator('.canvas svg image');
  await expect(img).toHaveAttribute('opacity', '1');
  await page.locator('.list .row', { hasText: 'P02' }).click();
  await expect(page.locator('.canvas-msg')).toHaveText('도면 불러오는 중…');
  await expect(img).toHaveAttribute('opacity', '0');
  await expect(img).toHaveAttribute('opacity', '1', { timeout: 5000 });
  await expect(page.locator('.canvas-msg')).toHaveCount(0);
});

test('기록 내보내기 · 가져오기 · 결과 CSV', async ({ page }) => {
  await page.goto('/#/lifetrac-iii/inspect/W01');
  await record(page).getByRole('button', { name: '이상', exact: true }).first().click();
  const menu = () => page.getByText('더보기', { exact: true }).click();

  await menu();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '기록 JSON ↓' }).click();
  const file = await (await dl).path();
  expect((await dl).suggestedFilename()).toMatch(/lifetrac-iii-준비자료/);

  await menu();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: '검사 결과 CSV ↓' }).click();
  expect((await csv).suggestedFilename()).toMatch(/검사결과.*\.csv$/);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(status(page)).toContainText('미검사');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(status(page)).toContainText('불합격');
});

test('검사 기준은 항상 recipes.json: 예전 버전이 저장한 기준이나 가져온 JSON 의 기준은 쓰지 않음', async ({ page }) => {
  // 예전 버전(기준 편집 화면이 있던 때)이 남긴 저장분: 절단 길이 공차 0.125
  await page.evaluate(async () => {
    const r = await (await fetch('datasets/lifetrac-iii/recipes.json')).json();
    const edited = r.templates.map((t) => ({ ...t, checks: t.checks.map((c) => (c.id === 'length' ? { ...c, tol: 0.125 } : c)) }));
    localStorage.setItem('inspection-workbench:lifetrac-iii', JSON.stringify({ results: {}, templates: edited, inspector: '' }));
  });
  await page.goto('/#/lifetrac-iii/inspect/P01');
  await expect(check(page, '절단 길이')).toContainText('55 ± 0.5 in');
  await check(page, '절단 길이').locator('input').fill('55.2');
  await expect(check(page, '절단 길이')).toHaveClass(/ok/);

  // recipes.json 을 고치면 그대로 반영
  await page.route('**/datasets/lifetrac-iii/recipes.json', async (route) => {
    const r = await (await route.fetch()).json();
    r.templates = r.templates.map((t) => ({ ...t, checks: t.checks.map((c) => (c.id === 'length' ? { ...c, tol: 0.125 } : c)) }));
    await route.fulfill({ json: r });
  });
  await page.reload();
  await expect(check(page, '절단 길이')).toContainText('55 ± 0.125 in');
  await expect(check(page, '절단 길이')).toHaveClass(/bad/); // 같은 55.2 가 불합격
});

test('처음 쓰는 사람: 검사하는 방법 · 사용 방법 창 · 홈 버튼', async ({ page }) => {
  await page.goto('/#/lifetrac-iii/inspect');
  // 항목을 고르기 전에는 기록 칸에 할 일을 안내
  await expect(record(page)).toContainText('다 채우면 자동으로 판정');

  // 왼쪽 위 이름을 누르면 현황(홈)으로
  await page.getByRole('button', { name: '검사 대시보드' }).click();
  await expect(page).toHaveURL(/#\/lifetrac-iii\/overview$/);

  // 현황 맨 위에 4단계 안내, 숨기면 새로고침해도 숨김 유지
  const how = page.getByRole('region', { name: '검사하는 방법' });
  await expect(how.locator('li')).toHaveCount(4);
  await how.getByRole('button', { name: '숨기기' }).click();
  await page.reload();
  await expect(how).toHaveCount(0);
  await page.getByRole('button', { name: '검사하는 방법 보기' }).click();
  await expect(how).toBeVisible();

  // 사용 방법 창: 버튼 · ? 키로 열고 Esc 로 닫음, 열려 있는 동안 뒤 화면 단축키는 쉼
  await page.getByRole('button', { name: '사용 방법', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: '사용 방법' });
  await expect(dlg).toContainText('검사 순서');
  await expect(dlg).toContainText('불합격이면 사유');
  await page.screenshot({ path: `${SHOTS}/08-guide.png` });
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await page.getByRole('button', { name: '검사', exact: true }).click();
  await page.keyboard.press('?');
  await expect(dlg).toBeVisible();
  await page.keyboard.press('n');
  await expect(record(page)).toContainText('왼쪽 목록이나 도면에서 항목을 고르세요');
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  await expect(record(page).locator('h2')).toHaveText(/^[PW]\d{2}$/);
  await expect(record(page)).toContainText('빈 칸 모두 이상 없음'); // 기록 칸 아래 단축키 안내
});

test('자동 · 측정 · 육안: 해당 없음 자동 처리, 허용 범위 막대, 맞춰 볼 값, 도면 1번 패드 표시', async ({ page }) => {
  // PCB 세라믹 커패시터: 극성은 해당 없음(자동) → A 한 번이면 합격
  await page.goto('/#/pcb-lightsabre/inspect/C1');
  await expect(check(page, '극성 방향')).toHaveClass(/na/);
  await expect(check(page, '극성 방향')).toContainText('해당 없음');
  await expect(record(page).locator('.kinds')).toContainText('육안 2');
  await expect(record(page).locator('.auto-row')).toContainText('칩 크기 일치');
  await expect(record(page).locator('.auto-row')).toContainText('BOM 0603 · CAD 0603');
  await page.keyboard.press('a');
  await expect(status(page)).toContainText('합격');

  // IC: 맞춰 볼 품번 + 도면에 1번 패드 ◆
  await page.locator('#item-search').fill('U5');
  await page.locator('.list .row', { hasText: 'U5' }).click();
  await expect(check(page, '품번 마킹')).toContainText('맞춰 볼 값 ES9018K2M');
  await expect(check(page, '1번 핀 방향')).toContainText('1번 패드 (DGND)');
  await expect(page.locator('.pin1[data-ref=U5]')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/09-inspect-pin1.png` });

  // 다이오드: 파일에 적힌 K
  await page.locator('#item-search').fill('D1');
  await page.locator('.list .row', { hasText: 'D1' }).first().click();
  await expect(check(page, '캐소드 방향')).toContainText('1번 패드 (K)');

  // LifeTrac 측정: 허용 범위 막대와 편차, 한쪽 기준, 정확히 맞아야 하는 값
  await page.goto('/#/lifetrac-iii/inspect/P01');
  await expect(record(page).locator('.auto-row')).toContainText('도면명 55 in · 치수 55 in');
  await expect(check(page, '단면 규격')).toContainText('맞춰 볼 값 □4.000×4.000×.250 R.250');
  await check(page, '절단 길이').locator('input').fill('55.2');
  await expect(check(page, '절단 길이').locator('.g-dev')).toHaveText('+0.2 in · 허용 ±0.5 in');
  await expect(check(page, '절단 길이').locator('.g-val.ok')).toHaveCount(1);
  await check(page, '절단 길이').locator('input').fill('54.3');
  await expect(check(page, '절단 길이').locator('.g-val.bad')).toHaveCount(1);
  await check(page, '구멍 개수').locator('input').fill('11');
  await expect(check(page, '구멍 개수').locator('.g-dev')).toContainText('기준보다 −1 개');
  await page.screenshot({ path: `${SHOTS}/10-inspect-gauge.png` });
  await page.locator('.list .row', { hasText: 'W01' }).click();
  await check(page, '용접 크기').locator('input').fill('0.1');
  await expect(check(page, '용접 크기').locator('.g-dev')).toHaveText('기준보다 0.03 in 부족');
});

test('현황: 자동 비교 결과를 확인할 것에 표시 (PCB 107건 일치)', async ({ page }) => {
  await page.goto('/#/pcb-lightsabre/overview');
  await expect(page.locator('[data-group=auto]')).toContainText('데이터끼리 107건 자동 비교함');
});

test('형식 오류: 필수 열이 없으면 이해할 수 있는 오류', async ({ page }) => {
  await page.route('**/datasets/lifetrac-iii/items.csv', (route) => route.fulfill({ contentType: 'text/csv', body: 'ref,name\nW01,테스트\n' }));
  page.errors = [];
  await page.goto('/#/lifetrac-iii/overview');
  await expect(page.locator('.notice.bad')).toContainText('items.csv: 필수 열이 없습니다 → category, group');
});

test('좁은 화면(390px)에서도 가로 스크롤 없음', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [p, sel] of [['overview', '.overview'], ['inspect/P01', '.record h2'], ['report', '.sheet']]) {
    await page.goto(`/#/lifetrac-iii/${p}`);
    await page.reload(); // 해시만 바뀌면 같은 문서 — 새로 그려진 화면 기준으로 확인
    await expect(page.locator(sel)).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, p).toBeLessThanOrEqual(0);
  }
  await page.goto('/#/lifetrac-iii/inspect/P01');
  await page.reload();
  await expect(page.locator('.record h2')).toHaveText('P01');
  await page.screenshot({ path: `${SHOTS}/07-mobile.png`, fullPage: true });
});
