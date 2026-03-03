// 2.1 没有出现在 test 中 - 错误位置
describe('2.1 状态: test', () => {
  it('测试', async () => {
    expect(true).toBe(true)
  })
})
