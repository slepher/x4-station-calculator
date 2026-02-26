import { defineConfig, devices } from '@playwright/test';

// 1. 读取终端传进来的 PORT，如果没有传，就默认使用 4173
const port = process.env.PORT || 4173;

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  
  use: {
    baseURL: 'http://127.0.0.1:${port}/x4-station-calculator/',
    headless: true,
    trace: 'on-first-retry',
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 1000,      // 针对 click, fill 等动作的超时 (这才是你要改的)
    navigationTimeout: 2000  // 页面跳转超时
  },
  expect: {
    timeout: 1000,
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
    command: 'pnpm run preview',
    url: 'http://127.0.0.1:${port}/x4-station-calculator/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  }
});
