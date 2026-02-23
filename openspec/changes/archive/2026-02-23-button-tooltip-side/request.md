# Button Tooltip Side 需求文档

## 目标

修改 StationWareFlow 界面中两个按钮的 tooltip 弹出方向，改善用户体验，避免 tooltip 与其他 UI 元素重叠：
- 收藏按钮 (favbtn): 改为向**左**弹出
- 锁定按钮 (lockbtn): 改为向**右**弹出

## 已确认方案

### 技术实现
- 在 `<tippy>` 组件上添加 `placement` 属性控制弹出方向
- Vue Tippy 支持的方向值: `top`, `bottom`, `left`, `right`, `top-start`, `top-end`, 等

### 文件修改
- `src/components/common/FavoriteButton.vue`: `<tippy>` 添加 `placement="left"`
- `src/components/common/LockButton.vue`: `<tippy>` 添加 `placement="right"`

## 边界

### In Scope
- FavoriteButton.vue tooltip placement 属性添加
- LockButton.vue tooltip placement 属性添加

### Out of Scope
- tooltip 内容修改
- 按钮样式调整
- 按钮交互逻辑变更
- 其他组件的 tooltip 调整

## 验收标准 (DoD)

1. [ ] 鼠标 hover 到收藏按钮时，tooltip 向左侧弹出
2. [ ] 鼠标 hover 到锁定按钮时，tooltip 向右侧弹出
3. [ ] 按钮原有功能（点击切换状态、禁用状态等）正常工作
4. [ ] tooltip 内容和样式保持不变

## 未决项

无
