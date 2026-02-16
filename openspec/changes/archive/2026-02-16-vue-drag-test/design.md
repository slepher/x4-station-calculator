## Context

当前项目使用 `vuedraggable`（基于 SortableJS）实现拖拽功能。E2E 测试使用 Playwright，但发现以下问题：

1. **事件不兼容**：Playwright 的 `page.mouse.down/move/up` 仅生成鼠标事件，而 SortableJS 需要 HTML5 原生 Drag 事件（`dragstart`、`dragover`、`drop` 等）
2. **DataTransfer 缺失**：原生拖拽需要 `DataTransfer` 对象，鼠标模拟无法自动生成
3. **测试不稳定**：当前测试依赖特定的 `steps` 参数和时序，容易因环境差异而失败

## Goals / Non-Goals

**Goals:**
- 创建独立的测试组件，隔离拖拽逻辑以便测试
- 验证多种拖拽测试方案的可行性
- 找出稳定可靠的拖拽测试最佳实践
- 记录成功的测试方案到 `test_experience.md`

**Non-Goals:**
- 不修改现有业务代码
- 不引入新的生产依赖
- 不替代现有的 `logic-flow-drag-feedback.spec.ts` 测试

## Decisions

### 决策 1：测试组件设计

**选择**：创建独立的 `DragTestPage.vue` 组件，包含两个独立的拖拽区域

**理由**：
- 隔离测试环境，避免业务逻辑干扰
- 简化 Store 状态，便于验证
- 可复用的测试模式

**替代方案**：
- 直接在现有组件上测试 → 拒绝：业务逻辑复杂，难以隔离问题
- 使用 Storybook → 拒绝：项目未引入 Storybook

### 决策 2：测试方案对比

**方案 A：`dispatchEvent` 模拟原生 Drag 事件（推荐）**

```typescript
await page.evaluate((source, target) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.effectAllowed = 'all';
  
  source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
  source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
}, [sourceEl, targetEl]);
```

**优点**：
- 直接触发 SortableJS 监听的事件
- 不依赖物理坐标
- 执行速度快

**缺点**：
- 无法测试视觉反馈（如幽灵元素位置）
- 需要手动构造 `DataTransfer`

**方案 B：Playwright `mouse` API**

```typescript
await source.hover();
await page.mouse.down();
await page.mouse.move(targetX, targetY, { steps: 10 });
await page.mouse.up();
```

**优点**：
- 更接近真实用户操作
- 可以测试视觉反馈

**缺点**：
- 可能无法触发 `vuedraggable` 的 `@add` 事件
- 依赖坐标计算，容易受布局影响

**方案 C：混合方案**

结合鼠标移动和原生事件，先移动到目标位置，再触发 `dragover` 和 `drop`。

**最终选择**：方案 A 作为主要测试方案，方案 B 作为视觉测试的补充

### 决策 3：Store 设计

**选择**：创建简化的 `useDragTestStore.ts`

```typescript
interface DragTestItem {
  id: string;
  name: string;
  zone: 'A' | 'B';
}

// State
items: DragTestItem[]
events: string[] // 记录事件序列

// Actions
moveItem(itemId, targetZone)
recordEvent(eventName)
```

**理由**：
- 简单的状态结构，便于验证
- 事件记录功能，便于验证事件触发顺序

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| `dispatchEvent` 方案可能不适用于所有 SortableJS 配置 | 测试多种配置场景，记录边界条件 |
| 测试结果可能因 Playwright 版本而异 | 锁定 Playwright 版本，记录版本信息 |
| 虚拟列表中的拖拽可能有不同行为 | 在测试组件中模拟虚拟列表场景 |

## Migration Plan

无需迁移，此为新增测试功能。

## Open Questions

1. 是否需要测试跨 iframe 拖拽？（当前项目无此需求）
2. 是否需要测试触摸设备拖拽？（当前项目仅支持桌面端）
