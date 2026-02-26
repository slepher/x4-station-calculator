import { defineConfig, devices } from '@playwright/test';
import net from 'node:net';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// =====================================================================
// 1. 自动化环境准备：检查 dist 目录，如果没有则自动触发构建
// =====================================================================
if (!fs.existsSync('./dist')) {
  console.log('🚧 检测到全新 worktree 环境，未找到 dist 目录。正在自动执行构建...');
  execSync('pnpm build', { stdio: 'inherit' });
  console.log('✅ 自动构建完成，准备启动测试！\n');
}

// =====================================================================
// 2. 核心逻辑：利用 Node.js 原生 net 模块探测真实的空闲端口
// =====================================================================
async function getFreePort(startPort = 4173): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    // 尝试监听指定的端口
    server.listen(startPort, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port)); // 监听成功说明空闲，关闭并返回该端口
    });
    // 如果抛出错误（通常是 EADDRINUSE 被占用），则递归顺延检查下一个
    server.on('error', () => {
      resolve(getFreePort(startPort + 1));
    });
  });
}

// 3. 优先使用终端传入的 PORT，如果没有，则动态寻找空闲端口 (利用 ESM 的顶层 await)
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : await getFreePort(4173);

// =====================================================================
// 4. Playwright 配置导出
// =====================================================================
export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  
  use: {
    // 💡 动态注入计算好的端口
    baseURL: `http://127.0.0.1:${port}/x4-station-calculator/`,
    headless: true,
    trace: 'on-first-retry',
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15000,      
    navigationTimeout: 30000  
  },
  
  expect: {
    timeout: 5000,
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
    // 💡 将计算好的端口强制传给 Vite，并用 --strictPort 禁止它自己乱跑
    command: `pnpm run preview -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/x4-station-calculator/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    // stdout: 'pipe', // 如果你需要看 vite 的启动日志，可以取消注释这一行
  }
});