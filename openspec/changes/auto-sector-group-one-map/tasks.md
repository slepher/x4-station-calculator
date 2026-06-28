# auto-sector-group-one-map Tasks

## 1. Map 面板集成

- [ ] Map binding-sector 使用 `AutoSectorGroupPanel layout="tabs"`
- [ ] `MapSavePanel` 的 `binding-sector` 层不再渲染 `MapBindingSectorGroup`
- [ ] Map 面板读取 live store 共享 draft
- [ ] Map 面板挂载和 tab 切换不调用分组算法或 `initAutoGroupDraft()`
- [ ] 实现 Hub / Allocation / Trade Station / Virtual Station 四个 Map tab
- [ ] Virtual Station tab 不受 Hub edit/result 状态限制
- [ ] 确认态隐藏 draft tabs 并显示进入 station binding 的按钮

## 2. Map 事件

- [ ] Coverage/candidate/connected pill 在 map view emit `focus-sector`
- [ ] Anchor/trade station pill 在 map view emit `focus-sector`
- [ ] Assignment sector name 在 map view emit `focus-sector`
- [ ] Live view 点击 pill 不 emit `focus-sector`
- [ ] `MapSavePanel` 转发 `focus-sector` 和 `fit-sectors`
- [ ] `MapWorkbenchView` 根据事件居中地图

## 3. Compact UI 与 drag sort

- [ ] Map view 使用适配侧栏的 compact 样式
- [ ] Pill 在 360px 侧栏内不溢出
- [ ] Map group card 收紧 padding、header、label、pill gap 和 jump row 间距
- [ ] Map 添加枢纽使用 `HubAddMenu` 默认/侧栏入口和定位按钮
- [ ] Live 添加枢纽使用 `HubAddMenu mode="overlay"`
- [ ] Hub list 支持 drag sort
- [ ] Drag sort 使用 drag handle 和虚线 placeholder
- [ ] Drag sort 只更新 groups 数组顺序
- [ ] Drag sort 不触发计算、不改变 coverage/connection/jumpRange

## 4. Hub color 状态与算法

- [ ] `BindingSectorGroup` 和 draft group 保留 `color`
- [ ] 实现 30 色 UI palette 和 27 色 auto palette
- [ ] 保留有效已有颜色
- [ ] 对缺色、新增或冲突 hub 重分配
- [ ] 避开自身 anchor/coverage faction 色
- [ ] 避开 5 跳内 hub color 和 hub faction 色
- [ ] 允许 5 跳外颜色复用
- [ ] 交互后单次只影响当前 hub color

## 5. Color UI 与持久化

- [ ] Group card 标题显示色块
- [ ] 编辑态色块打开颜色选择器
- [ ] 预设色更新 draft 并关闭 popover
- [ ] 透明色清空 `group.color`，不得保存透明色值
- [ ] Confirm 时写入 `BindingSectorGroup.color`
- [ ] `normalizeState()` 保留 group color

## 6. Map overlay

- [x] Binding 模式从 shared draft 构建 `sectorGroupColorMap`
- [x] 普通地图模式不从 persisted active binding 构建 `sectorGroupColorMap`
- [ ] 用单一 Map archive target 表达 `default-map` 或具体 archive，避免用 `selectedArchive=null` 表示默认地图
- [ ] 进入 Map 且未显式选择目标时，优先推导 active binding 对应 archive
- [ ] 玩家存档组标题和组级详情入口解析为最新有效 archive target
- [x] 星区组染色和 hub 连线仅在 binding 界面激活且 archive target guid 等于 active binding guid 时显示
- [x] 普通地图模式隐藏星区组染色和 hub 连线
- [ ] Save panel 关闭再打开恢复关闭前 layer/stage；显式导航入口可覆盖恢复状态
- [ ] faction owner 区域染色和 sector group 区域染色位于底层，不遮蔽高速路、星门、空间站、POI 或路线
- [ ] sector 六边形边框绘制在区域染色上方
- [ ] 单个 sector 背景填充优先级为 sector group color > faction owner fill > 默认地图背景
- [ ] 星区组染色关闭且势力背景色打开时，不因 `sectorGroupColorMap` 存在而隐藏势力背景色
- [ ] 有 color 的 coverage sector 绘制内部六边形
- [ ] 无 color 不绘制内部六边形
- [ ] 保持 faction owner、hub color、resource pie 的渲染层级

## 7. Virtual Station tab

- [ ] Map `AutoSectorGroupPanel layout="tabs"` 增加 Virtual Station tab
- [ ] Live `AutoSectorGroupPanel layout="columns"` 不显示 Virtual Station tab
- [ ] Virtual Station tab 渲染 blueprint empire selector，并复用 binding `blueprintEmpireId`
- [ ] 渲染 blueprint station 来源列表
- [ ] 渲染空白空间站来源项
- [ ] Virtual station 列表按当前 groups 顺序分组
- [ ] Virtual station item 显示 station 名称、sector 名、坐标和删除按钮
- [ ] Virtual station item 不显示 group 名
- [ ] 未分组区域显示提交时移除说明
- [ ] 为 Virtual Station tab 和相关文案补充中英本地化

## 8. Virtual station drag 与 overlay

- [ ] Blueprint station 拖拽创建 virtual station draft
- [ ] 从 blueprint station 复制 `name/type/modules/settings/lockedWares/warePriority`
- [ ] 不复制 source station 的 `id`、`sectorId` 或持续同步引用
- [ ] 空白空间站拖拽创建默认 industrial 空 module draft
- [ ] 已存在 virtual station 拖拽时携带 draft id
- [ ] 已存在 virtual station 拖拽只更新当前 draft，不创建重复 plan
- [ ] drop 到无 group 覆盖 sector 时拒绝并保持原位置
- [ ] 异常多 group 命中时拒绝，不做 fallback 决胜
- [ ] 删除按钮只删除 store draft，不直接写 binding
- [ ] Map binding overlay 从 virtual station draft 渲染
- [ ] Map binding 打开后即可拖动 virtual station overlay，不要求 Virtual Station tab 激活
- [ ] virtual station overlay 视觉沿用现状

## 9. Virtual trade station map drag

- [ ] virtual trade station overlay 从 group trade station draft 渲染
- [ ] Map binding 打开后即可拖动 virtual trade station，不要求 Trade Station tab 激活
- [ ] virtual trade station drop 必须限制在 group hub sector
- [ ] 拖动只更新 group draft trade station position
- [ ] 拖动不得修改 `TradeStationBinding.sectorMacro`
- [ ] 拖动不得修改 group `sectorMacro`、coverage 或 station plan
- [ ] Trade Station tab 中 virtual 选项显示当前坐标
- [ ] virtual trade station overlay 视觉沿用现状

## 10. 构建验证

- [ ] 实现完成后运行 `npm run build`

## 11. Binding player station icon color

- [x] Binding 模式下玩家空间站（含 hub 与非 hub）使用所属星区组色染色
- [x] anchor sector 与 coverage sector 内的玩家站遵循同一染色规则
- [x] hub/trade station 类型标识、形状、边框等重点视觉保留，不被染色弱化
- [x] 非玩家空间站不受该规则影响

## 12. Binding-only map visuals

- [x] 普通地图模式不显示 persisted binding 星区组染色
- [x] 普通地图模式不显示 persisted binding hub route
- [x] 地图图层控制移除星区组染色开关
- [x] 地图图层控制移除星区组连接开关
