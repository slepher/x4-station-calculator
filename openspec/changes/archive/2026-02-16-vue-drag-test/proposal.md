## Why

Playwright 的 `page.mouse.down/move/up` 方法无法可靠触发 `vuedraggable`（基于 SortableJS）的拖拽事件，因为 SortableJS 依赖 HTML5 原生 Drag and Drop API（`dragstart`、`dragover`、`drop` 等）以及 `DataTransfer` 对象。当前项目的 E2E 测试存在以下问题：

1. 拖拽触发不稳定，需要特定的 `steps` 参数才能触发 `start` 事件
2. 无法精确控制拖拽的中间状态（如悬停、拖出）
3. 缺乏独立的测试沙盒来验证各种拖拽方案

我们需要创建一个独立的测试组件和测试套件，找出稳定可靠的 Vue 拖拽测试方案。

## What Changes

- **新增** `components/drag/` 目录下的测试组件：
  - `DragTestPage.vue` - 独立的拖拽测试页面，包含两个可拖拽区域 A 和 B
  - `DragTestStore.ts` - 简化的测试 Store，用于验证拖拽操作对状态的影响

- **新增** E2E 测试套件：
  - 测试方案一：`dispatchEvent` 模拟原生 Drag 事件（推荐方案）
  - 测试方案二：Playwright `mouse` API 模拟物理鼠标
  - 测试方案三：混合方案（鼠标移动 + 原生事件）

- **验证场景**：
  - 基础拖拽：从区域 A 拖拽元素到区域 B
  - 悬停效果：拖拽到区域 B 悬停，触发视觉反馈，然后拖出
  - 状态验证：验证 Store 中的数据变化是否符合预期
  - 事件序列：验证 `@start`、`@add`、`@end`、`@remove` 等事件的触发顺序

## Capabilities

### New Capabilities
- `vue-drag-test`: 独立的 Vue 拖拽测试组件和测试套件，用于验证稳定的拖拽测试方案

### Modified Capabilities
<!-- 无现有 capability 需要修改 -->

## Impact

- **新增文件**：
  - `src/components/drag/DragTestPage.vue`
  - `src/store/useDragTestStore.ts`
  - `tests/e2e/vue-drag-test.spec.ts`
- **更新文档**：
  - `openspec/test_experience.md` - 记录成功的拖拽测试方案
- **不影响现有功能**：此变更为独立的测试沙盒，不修改任何现有业务代码
