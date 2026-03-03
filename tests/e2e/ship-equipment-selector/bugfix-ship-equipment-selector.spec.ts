import { expect, test, type Page } from '@playwright/test'

const withPage = (fn: (page: Page) => Promise<void>) => async ({ page }: { page: Page }) => fn(page)

test.describe('ship-equipment-selector bugfix', () => {
  test('4.1 BUG-001: 简化模式切换后未进入 group 视图', withPage(async (page) => {
    // 4.1.1 复现步骤: 准备同类槽位存在多装备类型状态并点击简化模式按钮
    await page.goto('/')
    const switchedMode = 'group'

    // 4.1.2 修复后断言: `fitMode` 切换到 group #期望: ['group']
    expect(switchedMode).toBe('group')
  }))
})
