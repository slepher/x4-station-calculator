import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors: Error[] = [];

    // 监听网页内部未捕获的异常
    page.on('pageerror', (error) => {
      errors.push(error);
      // 记录详细日志以便调试
      console.log(`AGENT_FEEDBACK_START: ${JSON.stringify({
          type: 'JS_RUNTIME_ERROR',
          message: error.message,
          stack: error.stack,
          testFile: testInfo.file
      })} AGENT_FEEDBACK_END`);
    });

    // 监听控制台打印的严重错误
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const error = new Error(msg.text());
        errors.push(error);
        console.error(`⚠️ [控制台错误日志][${testInfo.title}]:`, msg.text());
      }
    });

    // 执行测试逻辑
    await use(page);

    // 测试结束后，如果收集到了错误，将错误导出到临时文件并抛出异常
    if (errors.length > 0) {
      const errorLog = {
        testTitle: testInfo.title,
        testFile: testInfo.file,
        errors: errors.map(e => ({
          message: e.message,
          stack: e.stack
        }))
      };

      // 确保输出目录存在
      const logDir = path.join(process.cwd(), 'test-results', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // 写入 JSON 日志
      const logPath = path.join(logDir, `error-${testInfo.testId}.json`);
      fs.writeFileSync(logPath, JSON.stringify(errorLog, null, 2));

      const errorList = errors.map(e => e.message).join('\n');
      throw new Error(`检测到网页 JS 异常，测试已强制停止。日志已导出至: ${logPath}\n${errorList}`);
    }
  },
});