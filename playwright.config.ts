import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  
  use: {
    baseURL: 'http://localhost:4173/x4-station-calculator/',
    trace: 'on-first-retry',
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 },
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    }
  ],

  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/x4-station-calculator/',
    reuseExistingServer: !process.env.CI,
  },
  expect: {
    // 设置全局 expect 断言的默认超时时间为 0.5 秒
    timeout: 500,
  },
});