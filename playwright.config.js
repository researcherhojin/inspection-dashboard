import { defineConfig, devices } from '@playwright/test';

// https://playwright.dev/docs/test-webserver
// PREVIEW=1 npm test → 배포용 빌드(dist)로 같은 테스트 실행
const preview = !!process.env.PREVIEW;
const command = preview ? 'npx vite build && npx vite preview --port 5199 --strictPort' : 'npx vite --port 5199 --strictPort';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js', // tests/unit 은 node --test 로 따로 실행
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1600, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } } }],
  webServer: {
    command,
    url: 'http://localhost:5199',
    reuseExistingServer: !preview,
  },
});
