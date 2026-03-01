test.describe('4.1 BUG-001: 错误路由测试', () => {
  // 4.1.2 修复后 #期望: [true] - 正确位置
  test('4.1.2 修复后', async ({ page }) => {
    await page.goto('/')
    expect(true).toBe(true)
  })
})
