describe('1.1 测试用例', () => {
  // 1.1.1 测试步骤
  it('1.1.1 测试步骤', () => {
    expect(true).toBe(true)
  })

  // 1.1.2 缺少注释的步骤 - 故意不写注释，让验证脚本检测
  it('无注释的测试', () => {
    expect(true).toBe(true)
  })
})
