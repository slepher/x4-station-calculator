import { defineConfig, devices } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// 1. 防呆：Agent 忘了 build 时自动补救
if (!fs.existsSync('./dist')) {
  console.log('🚧 未检测到 dist 目录，正在自动构建...');
  execSync('pnpm build', { stdio: 'inherit' });
}

// 2. 核心魔法：根据当前工作区绝对路径，生成专属固定端口 (10000 ~ 50000 之间)
function getDirectoryPort(): number {
  const dir = process.cwd();
  // 对路径进行 MD5 哈希，取前 4 位十六进制转化为数字
  const hash = createHash('md5').update(dir).digest('hex');
  const portOffset = parseInt(hash.substring(0, 4), 16) % 40000;
  return 10000 + portOffset;
}

// 3. 计算端口：支持外部传入，默认使用路径专属端口
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : getDirectoryPort();

// 4. Playwright 最终配置
export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  
  use: {
    baseURL: `http://127.0.0.1:${port}/x4-station-calculator/`,
    headless: true,
    trace: 'on-first-retry',
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15000,      
    navigationTimeout: 30000  
  },
  
  expect: { timeout: 5000 },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],

  webServer: {
    // 💡 修复点 1：放弃 pnpm run，直接使用 pnpm exec 唤起底层 vite，确保参数 100% 传达！
    command: `vite preview --port ${port} --host 127.0.0.1 --strictPort`,
    reuseExistingServer: false,
    timeout: 30000,
    
    // 💡 修复点 2：火力全开，把 Vite 的所有日志直接打印到你的终端里
    stdout: 'pipe',
    stderr: 'pipe',
  }
});