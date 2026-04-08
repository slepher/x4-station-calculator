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

## Phase 7: 图标映射与大小调整

### T7.1 factoryGroup 图标映射

- [x] 当 station.tag === 'factory' 时，使用 station.factoryGroup 匹配图标
- [x] factoryGroup 优先顺序：shiptech → hightech → refined → pharmaceutical → food → agricultural → water → energy
- [x] factoryGroup 匹配失败或为 'factory' 时，使用 fallback 图标
- [x] SavePoiOverlayItem 新增 factoryGroup?: string 字段
- [x] useSaveStore.ts 传递 factoryGroup 字段
- [x] MapSvgCanvas.vue 导入 factoryGroup 图标（shiptech/hightech/refined/pharmaceutical/food/agricultural/water/energy.svg）

### T7.2 defencemodule 图标映射

- [x] MapSvgCanvas.vue: 添加 defencemodule → defensestationIconUrl 映射
- [x] 移除旧的 defence/defencestation 映射（统一使用 defencemodule）
- [x] 更新 SAVE_POI_ICON_MAP 和 SAVE_POI_HEADQUARTER_ICON_MAP

### T7.3 图标大小动态调整

- [x] MapSvgCanvas.vue: 新增 SMALL_ICON_SIZE = 9 (原大小的 1/2)
- [x] MapSvgCanvas.vue: 新增 LARGE_ICON_TYPES = ['shipyard', 'wharf', 'tradestation', 'equipmentdock', 'playerhq', 'hive']
- [x] MapSvgCanvas.vue: 新增 getSavePoiIconSize() 函数
- [x] 动态设置图标大小：大图标 (18px) vs 小图标 (9px)
- [x] 大图标类型：shipyard, wharf, tradestation, equipmentdock, playerhq, hive
- [x] 小图标类型：factory, defencemodule, piratestation, weaponplatform 等所有其他类型

### T7.4 NPC 空间站展示调整

- [x] useSaveStore.ts: 移除 tag !== 'factory' 过滤，展示所有 NPC 空间站
- [x] MapSaveCoordList.vue: 使用 position.x, position.z 替代 item.x, item.z
- [x] SaveDetailPanel.vue: 使用 position.x, position.z 替代 item.x, item.z

### T7.5 Save 面板视觉统一

- [x] MapSavePanel.vue: scrollbar 样式与 resource 面板统一
- [x] MapSavePanel.vue: 外层、头部、内容区边距与 resource 面板对齐

### T7.6 移除“小条件站点过滤”用户选项

- [x] 移除 MapSavePanel.vue 中“剔除小条件站点” checkbox
- [x] 移除 SaveArchiveSettings 中 `excludeConditionalSmallStations`
- [x] useSaveStore.ts: 分类统计与坐标列表不再按该选项过滤
- [x] MapWorkbenchView.vue: 移除相关 computed / props / events
- [x] locales / tests: 删除旧文案与旧用例前提

---

## Phase 8: Abandoned Ship Icon & Info Enhancement

### T8.1 Ship Icon File Organization

- [x] 创建 `src/components/icons/ships/` 目录
- [x] 移动 `ship_*` 图标文件到 ships/ 子目录
- [x] 重命名图标文件以匹配 purposePrimary：
  - `ship_l_compactor_01.svg` → `ship_l_dismantling_01.svg`
  - `ship_m_tug_01.svg` → `ship_m_salvage_01.svg`
- [x] 创建 `ship_xl_auxiliary_01.svg` (从 neutral 复制)

### T8.2 Ship Data Macro Field

- [x] x4_data_processor.py: ships.json 添加 `macro` 字段
- [x] types/x4.ts: X4Ship 添加 `macro?: string`
- [x] store/logic/useGameData.ts: ShipBuildDatas 添加 `shipByMacroMap`

### T8.3 Abandoned Ship Purpose Assignment

- [x] saveParser.post.ts: 引入 ships.json
- [x] 构建 SHIP_LOOKUP (macro → { id, purpose })
- [x] 处理 abandonedShips 时添加 shipId 和 purpose 字段
- [x] 过滤无法匹配 ship 数据的弃船
- [x] 升级 post_processor_version 到 v7

### T8.4 Abandoned Ship Icon Display

- [x] style.ts: 导入船类图标
- [x] style.ts: 构建 SHIP_CLASS_PURPOSE_ICON_MAP
- [x] style.ts: getSavePoiIconUrl 支持 abandonedShip 类别
- [x] types/saveArchive.ts: AbandonedShipEntry 添加 shipId/purpose
- [x] types/saveArchive.ts: SavePoiOverlayItem 添加 class/purpose/shipId

### T8.5 Abandoned Ship Tooltip i18n

- [x] MapSavePoiTooltip.vue: 添加 shipName computed
- [x] MapSavePoiTooltip.vue: 显示飞船名称行
- [x] locales: 添加 save_poi_tooltip_ship_name 和 save_poi_tooltip_sector

### T8.6 Unified Overlay Item Creation

- [x] useSaveStore.ts: 导出 createOverlayItem 函数
- [x] MapSaveCoordList.vue: 使用 createOverlayItem 替代手动构建
- [x] 确保列表和地图 tooltip 数据一致

### T8.7 Station productionProfile & unified naming

- [x] saveParser.post.ts: 为 `npcStations` 生成 `productionProfile/profileName`
- [x] saveParser.post.ts: 为 `playerStations` 生成 `productionProfile/profileName`
- [x] saveParser.post.ts: `single_cluster` 在处理阶段按优先级落单个 group id，不保留整条链
- [x] saveParser.post.ts: `xenonStations` / `khaakStations` 不走 `productionProfile`
- [x] saveParser.post.ts: 升级 `CURRENT_POST_PROCESSOR_VERSION` 到 `v9`
- [x] types/saveArchive.ts: 为站点与 `SavePoiOverlayItem` 补充 `productionProfile/profileName`
- [x] savePoiLabel.ts: 抽取统一的站点 i18n 命名解析
- [x] factory: module id 使用 module i18n，group id 使用 module_group i18n
- [x] mixed: 使用“综合体”界面文案
- [x] `weaponplatform`: 使用“武器平台”界面文案
- [x] `playerStation && is_headquarter=true`: 主名称直接显示“总部”
- [x] 所有 `is_headquarter=true` 空间站：列表显示绿色“总部”药丸，tooltip 额外显示“总部”行

---

## Phase 9: POI 显示控制转移到右上角

### T9.1 创建 MapSavePoiVisibilityControl.vue

- [x] 创建组件文件
- [x] 实现折叠/展开状态切换
- [x] 显示 7 个分类 checkbox 列表
- [x] 样式与左上角/左下角/右下角控件一致
- [x] Props: visibility, archive
- [x] Emit: visibility-change

### T9.2 修改 MapSaveCategoryMenu.vue

- [x] 移除 checkbox 相关代码
- [x] 移除 onCheckboxChange 函数
- [x] 移除 visibility-change emit
- [x] 移除 checkbox 相关 CSS
- [x] 保留分类列表、数量统计、箭头按钮

### T9.3 修改 MapSavePanel.vue

- [x] 移除 visibility prop 传递给 MapSaveCategoryMenu
- [x] 移除 @visibility-change 监听
- [x] 保留 @select-category 事件

### T9.4 修改 MapWorkbenchView.vue

- [x] 添加 MapSavePoiVisibilityControl 组件到右上角
- [x] 传递 visibility 和 activeMapArchive props
- [x] 监听 visibility-change 事件
- [x] 添加显示条件：activeMapArchive 存在时显示

### T9.5 添加 i18n 文案

- [x] zh-CN.json: 添加 map.poi_visibility_toggle
- [x] en.json: 添加 map.poi_visibility_toggle

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
T9.1 ─> T9.4
T9.2 ─> T9.3 ─> T9.4
T9.5 ─> T9.1
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
| Phase 9 | T9.1 - T9.5 | 1h |
| **Total** | 22 tasks | **~10h** |
