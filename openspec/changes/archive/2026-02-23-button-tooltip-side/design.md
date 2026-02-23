## Context

StationWareFlow 页面中收藏与锁定按钮的 tooltip 默认方向可能与周边 UI 元素重叠，影响可读性。本次仅调整两个按钮的 tooltip 弹出方向，不改动按钮交互与样式。

## Goals / Non-Goals

**Goals:**
- 收藏按钮 tooltip 向左弹出。
- 锁定按钮 tooltip 向右弹出。
- tooltip 内容与样式保持不变。
- 按钮点击、切换、禁用行为保持不变。

**Non-Goals:**
- 不修改 tooltip 文案。
- 不调整按钮样式或位置。
- 不影响其他组件的 tooltip。

## Decisions

1. 在对应 `<tippy>` 组件上设置 `placement` 属性以控制弹出方向。
- 选择理由：最小改动、可读性强，与当前组件使用方式一致。

## Risks / Trade-offs

- [Risk] placement 与外层容器布局冲突导致视觉偏移 → Mitigation: 仅限定两个按钮，观察回归。

## Migration Plan

- 无数据迁移。
- 变更可在需要时回退为默认 placement。

## Open Questions

无。
