test.describe('4.1 BUG-001: baseline bug', () => {
  // 4.1.1 复现步骤
  test('4.1.1 复现步骤', async ({ page }) => {
    await page.goto('/')
  })

  // 4.1.2 修复前: 出现错误 #期望: ['error']
  test('4.1.2 修复前: 出现错误', async ({ page }) => {
    expect('error').toBe('error')
  })
})
