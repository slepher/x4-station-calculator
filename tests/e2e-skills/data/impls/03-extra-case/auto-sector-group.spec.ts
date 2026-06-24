import { test } from '@playwright/test'

test('1.1 自动分组入口展示核心状态', async ({ page }) => {
  // 1.1.1 进入地图视图并定位自动分组入口
  await page.goto('/')
})

test('1.2 文档不存在的额外任务', async ({ page }) => {
  await page.goto('/')
})
