# x4-map-tooltip 测试任务

## 1 单元测试

- [ ] 1.1 tooltip 定位算法测试
  - [ ] 1.1.1 对 `chooseTooltipPlacement` 函数测试默认下方弹出场景
  - [ ] 1.1.2 测试正交方向优先于斜角方向
  - [ ] 1.1.3 测试边界钳制逻辑 #期望: [tooltip 不超出视口]

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: 地图-sector-hover
  - [ ] 2.1.1 在地图视图 `.map-viewport` 等待 MapSvgCanvas 渲染完成
  - [ ] 2.1.2 对 `.sector-hover-target` 第一个 sector 元素执行 `hover()` 操作
  - [ ] 2.1.3 等待 tooltip 位置计算完成 (`.map-sector-tooltip-layer` 出现)
  - [ ] 2.1.4 断言 `.sector-tooltip-card` 包含标题和所属势力文案 #期望: [标题和势力名称非空]

- [ ] 2.2 切换: 地图-sector-hover -> 地图-sector-leave
  - [ ] 2.2.1 从 状态: 地图-sector-hover 开始
  - [ ] 2.2.2 将鼠标移动到视口空白区域 (0, 0)
  - [ ] 2.2.3 断言 tooltip 关闭 #期望: [不可见]

## 3 E2E 测试场景

- [ ] 3.1 Case: Hover sector 显示 tooltip
  - [ ] 3.1.1 状态: 地图-sector-hover
  - [ ] 3.1.2 断言 `.sector-tooltip-title` 文本内容为 sector 本地化名称
  - [ ] 3.1.3 断言 `.sector-tooltip-owner` 文本内容为势力本地化名称
  - [ ] 3.1.4 断言 `.sector-tooltip-grid` 包含 `.sunlight-swatch` 元素
  - [ ] 3.1.5 断言资源列表按固定顺序显示，每项包含名称、丰度、颜色块 #期望: [ore, silicon, ice, hydrogen, nividium 顺序]

- [ ] 3.2 Case: Tooltip 内容本地化
  - [ ] 3.2.1 状态: 地图-sector-hover
  - [ ] 3.2.2 记录 `.sector-tooltip-title` 和 `.sector-tooltip-owner` 当前文本
  - [ ] 3.2.3 通过语言选择器切换到 `zh-CN`
  - [ ] 3.2.4 重新 hover 同一 sector
  - [ ] 3.2.5 断言 `.sector-tooltip-title` 文本切换为中文 #期望: [非英文]
  - [ ] 3.2.6 断言 `.sector-tooltip-owner` 文本切换为中文势力名称 #期望: [包含特拉迪或Teladi]

- [ ] 3.3 Case: Tooltip 不闪烁消失
  - [ ] 3.3.1 状态: 地图-sector-hover
  - [ ] 3.3.2 获取 tooltip 位置 (`.map-sector-tooltip-layer`)
  - [ ] 3.3.3 将鼠标从 sector 移动到 tooltip 元素上
  - [ ] 3.3.4 断言 `.map-sector-tooltip-layer` 保持可见 #期望: [可见]
  - [ ] 3.3.5 切换: 地图-sector-hover -> 地图-sector-leave
  - [ ] 3.3.6 断言 tooltip 最终关闭 #期望: [不可见]

- [ ] 3.4 Case: 拖拽关闭 tooltip
  - [ ] 3.4.1 状态: 地图-sector-hover
  - [ ] 3.4.2 在 `.map-viewport` 执行鼠标按下并拖动操作
  - [ ] 3.4.3 切换: 地图-sector-hover -> 地图-sector-leave
  - [ ] 3.4.4 断言 `.map-sector-tooltip-layer` 不可见 #期望: [不可见]

- [ ] 3.5 Case: 缩放结束后重新显示 tooltip
  - [ ] 3.5.1 状态: 地图-sector-hover
  - [ ] 3.5.2 在 `.map-viewport` 执行鼠标滚轮缩放操作
  - [ ] 3.5.3 等待缩放防抖结束，tooltip 恢复显示 #期望: [可见]
  - [ ] 3.5.4 切换: 地图-sector-hover -> 地图-sector-leave
  - [ ] 3.5.5 断言 `.map-sector-tooltip-layer` 最终不可见 #期望: [不可见]

## 4 Bug 测试
