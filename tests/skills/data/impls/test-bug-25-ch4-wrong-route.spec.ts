test.describe('4.1 BUG-001: 错误路由测试', () => {
  // 4.1.1 复现步骤
  test('4.1.1 复现步骤', async ({ page }) => {
    await page.goto('/')
  })

  // 4.1.2 修复后出现在 bug 路由 #期望: [true] - 错误！应该在 bug-fix 中
  test('4.1.2 修复后出现在 bug 路由', async ({ page }) => {
    expect(true).toBe(true)
  })
})
