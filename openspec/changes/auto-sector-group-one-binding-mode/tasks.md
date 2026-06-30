# auto-sector-group-one-binding-mode Tasks

## 1. 模式状态

- [x] 将 auto-sector-group 面板外显模式调整为 `[预览 | 编辑 | 生成]`
- [x] 建立 `preview/edit/generate` 与现有 result/edit/计算行为的映射
- [x] 切出 `generate` 模式时清除“忽略当前节点”overlay
- [x] 生成成功后自动切回 `preview`

## 2. 生成设置 card

- [x] 在 `generate` 模式渲染生成设置 card
- [x] 将连接跳数、节点、覆盖跳数、交易站阈值控件移动到生成设置 card 第一行
- [x] 将原外显 `[计算]` / `[快速计算]` 入口替换为生成设置 card 中的 `[生成方案]`
- [x] 确保 `[生成方案]` 只在 `generate` 模式显示
- [x] 生成失败或被 gate 阻止时保持 `generate` 模式

## 3. Retain 生成模式

- [x] 将三个 retain 聚合 checkbox 整合进生成设置 card 第二行左侧
- [x] retain checkbox 只在 `generate` 模式存在
- [x] 实现 retain 聚合 checked / unchecked / mixed 显示
- [x] 聚合 retain 操作批量同步 hub card retain 状态
- [x] hub card retain checkbox 只在 `generate` 模式显示
- [x] unpin 状态下禁用 hub card retain checkbox
- [x] retain unchecked 时半透明显示对应 coverage / connection / trade station 数据
- [x] connection 半透明与提交判断同时考虑双方 hub 状态

## 4. 忽略当前节点

- [x] 在生成设置 card 第二行右侧添加“忽略当前节点”图标按钮
- [x] 为图标按钮添加 tooltip：`忽略当前节点：本次生成不使用当前 Hub 作为基础。`
- [x] 实现 `ignoreCurrentNodes` transient overlay
- [x] overlay 激活时 `generate` 模式下所有 hub 显示为 unpin
- [x] overlay 激活时禁用单卡 pin/unpin 控件
- [x] overlay 激活时 `[生成方案]` 提交空 base input
- [x] overlay 不写入 shared draft，不持久化
- [x] 切出 `generate` 或生成成功后清除 overlay

## 5. Pin / Unpin 与 Bridge 默认

- [x] 保留非生成模式下 card pin/unpin 展示
- [x] `generate` 模式下 card pin/unpin 直接写当前 draft hub `isPinned`
- [x] bridge 产生的新 hub 默认 `isPinned=false`
- [x] 确保 bridge hub 默认 unpin 不是 reset 专属逻辑

## 6. JumpRange 与实时刷新

- [x] `generate` 模式下允许编辑 hub jumpRange
- [x] jumpRange 修改实时更新该 hub 范围星区
- [x] jumpRange 修改不默认吸收 assignment
- [x] jumpRange 修改不自动改变 assignment 选择
- [x] pin/unpin、retain、jumpRange 修改后 Assignment / Trade Station 列实时刷新

## 7. 重置与保存

- [x] 保留 `[重置]` 页面操作入口
- [x] `[重置]` 恢复已保存 binding 初始数据口径
- [x] `[重置]` 不放入生成设置 card
- [x] `[确定]` 只保存当前 draft，不运行生成
- [x] `[生成方案]` 成功后不自动保存，仍需用户点击 `[确定]`

## 8. 构建验证

- [x] 实现完成后运行 `npm run build`
