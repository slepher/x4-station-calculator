# user-save-map Tasks

## Phase 1: 基础框架

### T1.1 创建 MapSavePanel.vue 主组件

- [x] 创建组件文件
- [x] 定义 props: `open`, emit: `close`
- [x] 实现层叠状态管理 (`layer`, `breadcrumb`)
- [x] 实现面包屑区域预留

### T1.2 创建 MapSaveBreadcrumb.vue

- [x] 接收 breadcrumb items 数组
- [x] 点击导航触发 emit
- [x] 样式符合 amber 主题

### T1.3 创建 MapSaveArchiveList.vue

- [x] 复用 SaveUploadPanel 上传功能
- [x] 显示存档分组列表（按玩家名分组）
- [x] 点击存档触发进入 L2层

### T1.4 修改 MapWorkbenchView.vue 添加存档按钮

- [x] 在底部按钮组添加"存档"按钮
- [x] 添加 `isSavePanelOpen` 状态
- [x] 添加互斥逻辑（打开存档时关闭其他侧边栏）
- [x] 引入 MapSavePanel 组件

---

## Phase 2: 分类子菜单层

### T2.1 创建 MapSaveCategoryMenu.vue

- [x] 显示 5 个分类项
- [x] 每个分类显示 checkbox + 数量
- [x] checkbox 勾选触发 visibility 更新
- [x] 只有右侧箭头触发进入 L3层
- [x] 分类整行不再作为进入详情的点击区

### T2.2 实现分类数据计算

- [x] 在组件或 store 中计算分类数据：
  - 用户空间站：`stations.filter(s => s.owner === 'player')`
  - NPC据点：`stations.filter(s => s.owner !== 'player')`
  - 弃船、保险箱、妖王保险箱：直接使用数组
- [x] 统计各类数量

### T2.3 实现 checkbox 状态管理

- [x] 在 MapWorkbenchView 中管理 `savePoiVisibility` 状态
- [x] watch visibility 变化，更新兴趣点叠加层数据
- [x] 进入 L2层时重置为全不选
- [x] 进入 L3 层时，将当前详情类别作为临时可见类别并入地图叠加层计算
- [x] 返回 L2、关闭面板、切换存档时清空临时可见类别
- [x] 临时显示不得自动改写 checkbox 状态

---

## Phase 3: 坐标列表层

### T3.1 创建 MapSaveCoordList.vue

- [x] 接收分类名和对应数据
- [x] 按星区名称分组显示
- [x] 每个坐标项显示 code + 坐标值
- [x] 点击坐标项触发 focus 事件

### T3.2 实现搜索筛选功能

- [x] 添加搜索输入框
- [x] 输入文字筛选星区分组
- [x] 清空恢复全部显示

### T3.3 实现 focus 定位功能

- [x] 点击坐标项调用 `focusSavePoi`
- [x] 地图平移+缩放居中显示兴趣点
- [x] 设置 `focusedSavePoiKey`

---

## Phase 4: 地图兴趣点渲染

### T4.1 扩展 MapSvgCanvas.vue 支持兴趣点叠加层

- [x] 添加 `savePoiOverlays` prop
- [x] 新增 `<g class="save-poi-overlays">` SVG 层
- [x] 实现坐标转换逻辑（复用现有算法）

### T4.2 实现兴趣点标记渲染

- [x] 渲染小圆点（circle）
- [x] 渲染 code 标签（text）
- [x] 应用分类颜色

### T4.3 实现兴趣点点击交互

- [x] 添加 `data-save-poi-key` 属性
- [x] 监听 pointerdown 事件
- [x] emit 给父组件处理 tooltip

---

## Phase 5: Tooltip交互

### T5.1 创建 MapSavePoiTooltip.vue

- [x] 显示分类名、owner、code、坐标
- [x] 样式与 MapSectorTooltip 一致

### T5.2 集成 tooltip 显示逻辑

- [x] 在 MapWorkbenchView 中管理 tooltip 状态
- [x] 点击兴趣点显示 tooltip
- [x] 复用现有 tooltip 定位逻辑

---

## Phase 6: 完善与集成

### T6.1 添加国际化文案

- [x] 在 `zh-CN.json` 和 `en.json` 中添加新文案：
  - 存档按钮 label
  - 分类名称
  - 搜索 placeholder
  - tooltip 内容

### T6.2 样式一致性调整

- [x] 确保所有新组件使用 amber 主题
- [x] 侧边栏宽度与 MapStationPanel 一致（360px）
- [x] checkbox、按钮样式统一

### T6.3 构建验证

- [x] 运行 `npm run build` 确保无编译错误
- [x] 修复 TypeScript 类型错误

---

## Task Dependencies

```
T1.1 ─┬─> T1.2 ─> T1.4
      └─> T1.3 ─> T1.4
T1.4 ─> T2.1 ─> T2.3 ─> T4.1
T2.2 ─> T2.1
T2.1 ─> T3.1 ─> T3.3 ─> T4.3
T3.2 ─> T3.1
T4.1 ─> T4.2 ─> T4.3 ─> T5.2
T5.1 ─> T5.2
T6.1 ─> T6.2 ─> T6.3
```

---

## Estimated Effort

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1 | T1.1 - T1.4 | 2h |
| Phase 2 | T2.1 - T2.3 | 1.5h |
| Phase 3 | T3.1 - T3.3 | 1.5h |
| Phase 4 | T4.1 - T4.3 | 2h |
| Phase 5 | T5.1 - T5.2 | 1h |
| Phase 6 | T6.1 - T6.3 | 1h |
| **Total** | 17 tasks | **~9h** |
