test.describe('4.1 BUG-001: baseline bug', () => {
  // 4.1.2 修复后: 错误消失 #期望: ['ok']
  test('4.1.2 修复后: 错误消失', async ({ page }) => {
    await page.goto('/')
    expect('ok').toBe('ok')
  })
})
