import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', timeout: 45000, expect: { timeout: 10000 }, retries: 0,
  use: { baseURL: process.env.SHARP_BASE_URL || 'http://127.0.0.1:8080', trace: 'retain-on-failure' },
  projects: [ { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } } ],
  webServer: process.env.SHARP_BASE_URL ? undefined : { command: 'python3 -m http.server 8080 --bind 127.0.0.1', url: 'http://127.0.0.1:8080', reuseExistingServer: !process.env.CI }
});
