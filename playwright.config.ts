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
    actionTimeout: 500,      // 针对 click, fill 等动作的超时 (这才是你要改的)
    navigationTimeout: 2000  // 页面跳转超时
  },
  expect: {
    timeout: 500,
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
  }
});