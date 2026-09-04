test.describe('2.1 状态: s1', () => {
  // 2.1.1 准备状态
  test('2.1.1 准备状态', async ({ page }) => {
    await page.goto('/')
  })

  // 2.1.2 状态期望 #期望: ['s1']
  test('2.1.2 状态期望', async ({ page }) => {
    expect('s1').toBe('s1')
  })
})

test.describe('3.1 Case: flow', () => {
  // 3.1.1 状态: s1
  test('3.1.1 状态: s1', async ({ page }) => {
    await page.goto('/')
  })

  // 3.1.2 场景期望 #期望: [true]
  test('3.1.2 场景期望', async ({ page }) => {
    expect(true).toBe(true)
  })
})
