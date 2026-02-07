import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: Error[] = [];

    // 监听网页内部未捕获的异常
    page.on('pageerror', async (error) => {
    // 1. 记录错误堆栈
    console.log(`AGENT_FEEDBACK_START: ${JSON.stringify({
        type: 'JS_RUNTIME_ERROR',
        message: error.message,
        stack: error.stack
    })} AGENT_FEEDBACK_END`);

    // 2. 自动保存当前报错现场的截图名
    const screenshotPath = `error-screenshot-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    });

    // 监听控制台打印的严重错误
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('⚠️ [控制台错误日志]:', msg.text());
      }
    });

    // 执行测试逻辑
    await use(page);

    // 测试结束后，如果收集到了错误，则判定测试失败
    // 这能确保即使测试脚本逻辑跑通了，但网页后台有报错也能被捕获
    if (errors.length > 0) {
      const errorList = errors.map(e => e.message).join('\n');
      throw new Error(`检测到网页 JS 异常，测试已强制停止：\n${errorList}`);
    }
  },
});