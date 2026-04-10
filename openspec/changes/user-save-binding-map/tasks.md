# user-save-binding-map Tasks

## Documentation

- [x] D1. 创建 `request.md` 并记录 binding UI 工作流：Step 1 入口、Step 2 星区组编辑、Step 3 空间站规划
- [x] D2. 创建 `design.md` 并说明 UI 设计、拖拽交互、binding save status
- [x] D3. 创建 delta specs 覆盖 map-station binding UI

## Implementation: Step 1 Binding Entry

- [x] T1. 改造 `MapSaveArchiveList` 使用独立 save binding store
- [x] T2. 首页 binding 图标入口：guid 级和 time 级点击逻辑
- [x] T3. 进入 binding 前的 dirty empire 确认流程（复用 dirty empire 点击新建同源流程）
- [x] T4. 成功进入 binding 后调用 `useEmpireStore.switchToBinding(gameGuid)`
- [x] T5. binding 图标状态投影：显示当前 binding 状态
- [x] T6. binding 状态与首页 active 状态分离：binding 仅影响图标，不参与容器高亮
- [x] T7. savePanel 独占管理 `activeArchiveId`，地图层不回写

## Implementation: Step 2 Sector Group Editing

- [x] T8. 改造 `MapBindingSectorGroup` 读写 binding groups
- [x] T9. Step 2 显示 binding 星区列表，而不是 empire sectors
- [x] T10. 收缩态标题与正文布局：定位星区药丸 + 按跳数分组结果
- [x] T11. 展开态编辑单个 group：名称、定位星区菜单、跳数控件、覆盖星区、连接星区
- [x] T12. 新建星区复用定位星区选择菜单：点击可用 save sector 后才创建 group
- [x] T13. 连接星区自动计算与双向保存到 `groupBinding`
- [x] T14. 删除 group 清理逻辑
- [x] T15. 候选星区锁定逻辑：被其他 group 占用的星区显示锁定样式，不显示 `+`

## Implementation: Step 3 Station Planning

- [x] T16. 改造 `MapBindingStation` 显示派生 save station views
- [x] T17. Step 3 按 coverage 自动列出 save stations，无需逐个绑定
- [x] T18. 显示已有 `BindingStationPlan` 的规划 modules/settings/name
- [x] T19. 没有 plan 的 save station 显示空规划状态
- [x] T20. 选择 blueprint empire：设置 `blueprintEmpireId`
- [x] T21. 从 blueprint empire station 导入规划模块到 save station plan（单次复制）
- [x] T22. 创建 virtual station 占位
- [x] T23. 创建星区中转站：写入 `BindingSectorGroup.tradeStation`
- [x] T24. 编辑或清空规划 modules：按需创建/更新/删除 plan
- [x] T25. 绑定菜单 UI：仅用背景色和置灰表达状态，不显示备注文字
- [x] T26. 绑定菜单定位：Y 轴对齐 station-item，空间不足时向上弹出
- [x] T27. 绑定菜单滚动条样式与 Step 2 统一
- [x] T28. 模块排序规则共享：抽取 comparator 供搜索面板和 Step 3 导入共用
- [x] T29. i18n 文案：保存绑定、绑定 dirty、binding 星区、source empire 导入、virtual station

## Implementation: Binding POI on Map

- [x] T30. 改造地图 binding POI 投影，从独立 binding store 派生
- [x] T31. binding POI 常驻显示，受 `playerStation` 可见性控制
- [x] T32. binding POI 虚线六边形外框样式
- [x] T33. 拖拽权限：只在对应 `sectorGroup` 的 Step 3 上下文中允许拖拽
- [x] T34. 非 Step 3 context 下只显示并支持 tooltip

## Implementation: Drag Interaction

- [x] T35. 拖拽自由空间站到地图 → 创建 `BindingStationPlan`（无 `saveStationCode`）
- [x] T36. 拖拽星区中转站到地图 → 创建 `TradeStationBinding`（无 `saveStationCode`）
- [x] T37. 拖拽已放置的 binding station → 移动位置（`setStationPlanPosition`）
- [x] T38. 拖拽已放置的 trade station → 移动位置（`setTradeStationPosition`）
- [x] T39. 拖拽预览：正确的图标风格 + 虚线外圈 + `activeBindingDragPreview`

## Implementation: Binding Save Status UI

- [x] T40. save panel binding 分支标题栏右侧：取消/保存/关闭按钮
- [x] T41. 面板底部显示 dirty 状态：`绑定已保存` / `绑定有未保存改动`
- [x] T42. 关闭 dirty binding 面板的保存/放弃/继续编辑选择

## Implementation: Phase 2 UI Updates

- [x] T43. 更新 `MapSavePanel.vue` 使用 `switchToBinding()` 替代直接操作
- [x] T44. 移除 `ProductionWorkbenchView.vue` 中的手动 `productionSource` 管理

## Verification

- [x] V1. 运行 `npm run build`，修复编译错误
- [x] V2. 验证首页 binding 入口正确创建/打开 binding
- [x] V3. 验证 binding 状态与首页 active 分离
- [x] V4. 验证 Step 2 候选星区锁定逻辑
- [x] V5. 验证 Step 2 新建星区菜单逻辑
- [x] V6. 验证 Step 3 coverage 派生 save stations 自动显示
- [x] V7. 验证 Step 3 绑定菜单 UI 细节
- [x] V8. 验证模块排序规则共享
- [x] V9. 验证 binding POI 拖拽权限限制
- [x] V10. 验证 binding save status UI 正确