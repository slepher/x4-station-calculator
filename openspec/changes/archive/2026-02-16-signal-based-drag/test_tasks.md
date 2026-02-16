## 现有拖拽测试用例

以下测试用例已存在于项目中，可直接运行验证拖拽功能：

### logic-flow-new-feat.spec.ts

| 测试用例 | 描述 | 行号 |
|---------|------|------|
| `dragWareToNewZone` | 拖拽产物到新建区域 | 29 |
| `dragWareToExistingGroup` | 拖拽产物到现有产线组 | 54 |
| 基础拖拽测试 | 拖拽 hullparts 到新建区域 | 81, 96, 157, 175, 198, 218, 235 |
| 跨组拖拽测试 | 拖拽到现有产线组 | 247, 257 |

### logic-flow-bug-regression.spec.ts

| 测试用例 | 描述 | 行号 |
|---------|------|------|
| `dragWareToTarget` | 通用拖拽目标函数 | 26 |
| Bug 1.1 | 隔离节点不应在候选区显示拖拽预览点 | 88 |
| Bug 3.2 | 拖拽不同血统产品应显示 available 状态 | 175 |
| Bug 4.1 | 拖拽到 Auto 节点应转正为 Manual | 188, 196 |
| Bug 5.1 | 拖拽不同血统产品到 Auto 节点应替换血统 | 236, 259 |
| Bug 8.1 | 隔离后拖拽不同血统产品应转化隔离节点 | 362, 374 |
| Bug 10.1 | 空规划组拖拽第一个节点 | 470, 478 |
| Bug 11 | 锁定组拖拽 | 539 |
| Bug 12.1 | 重复拖拽相同产品应显示 duplicated 状态 | 605 |
| Bug 13.1 | 拖拽到新产线区域应创建新组 | 636 |
| Bug 14.1 | 切换血统后拖拽应使用新血统 | 671, 676 |
| Bug 15.1 | 多个组之间拖拽应正确切换 | 693, 694, 695 |
| Bug 30 | 拖拽幽灵元素显示模块名称 | 915 |
| Bug 36 | 拖拽取消后不添加产品 | 1258 |

### logic-flow-interaction.spec.ts

| 测试用例 | 描述 | 行号 |
|---------|------|------|
| `dragWareToNewZone` | 拖拽到新建区域 | 27 |
| `dragWareToExistingGroup` | 拖拽到现有产线组 | 62 |
| 基础交互测试 | 多种拖拽场景 | 99, 113, 134, 185, 210, 211, 219, 248, 275, 276, 283, 284, 298, 331 |
| T0 资源拖拽限制 | T0 资源不可拖拽 | 154, 160, 173, 177, 178, 180, 182 |

### logic-flow-incompatible-drag.spec.ts

| 测试用例 | 描述 | 行号 |
|---------|------|------|
| `dragWareToTarget` | 通用拖拽目标函数 | 22 |
| 不兼容拖拽测试 | 拖拽不兼容产物 | 62, 99 |

---

## 运行测试命令

```bash
# 运行所有拖拽相关测试
npx playwright test tests/e2e/logic-flow-new-feat.spec.ts
npx playwright test tests/e2e/logic-flow-bug-regression.spec.ts
npx playwright test tests/e2e/logic-flow-interaction.spec.ts
npx playwright test tests/e2e/logic-flow-incompatible-drag.spec.ts

# 或运行所有 logic-flow 相关测试
npx playwright test tests/e2e/logic-flow-*.spec.ts
```

---

## 新增测试用例（重构后需要验证）

- [ ] T1: 拖拽后候选区产物不应消失
- [ ] T2: 悬停时显示预览节点
- [ ] T3: 离开目标区域时清除预览节点
- [ ] T4: 取消拖拽时清除所有预览节点
- [ ] T5: 放置后预览节点转为正式节点
