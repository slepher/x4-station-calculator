# tasks.md — blueprints-binding

## 实施任务

### 1. 类型定义

- [x] `src/components/empire/presenters/useBlueprintRecipePresenter.ts`
  - 新增 `PlayerBindingData` 接口。
  - 新增 `LicencePurchaseState` 类型：`licensed | eligible | rep_needed | default`。
  - 新增 `BlueprintPurchaseStatus` 类型：`owned | purchasable | licence_needed | rep_needed | locked | no_licence | no_player_data`。
  - 新增 `BlueprintLockedReason` 类型。
  - 扩展 Presenter props/emits，暴露证书状态过滤、蓝图状态过滤、状态计数和状态查询能力。

### 2. Presenter 声望显示

- [x] 实现 faction 当前声望显示格式化。
- [x] 确保 `rawRep = 0` 显示 `0`。
- [x] 将 faction 当前声望挂到 `factionLicenceTree` 的 faction entry。
- [x] 不在 licence entry 中输出进度条字段。

### 3. Presenter 证书状态

- [x] 实现 `hasPlayerLicenceForFaction(playerData, licenceType, factionId)`，使用 `playerLicences[licenceType]` 中的 faction 列表判断已持证。
- [x] 检查并禁止把 `playerLicences[licenceType]` 当作全局 boolean；同一 licence type 下未出现在该列表中的 faction 不得显示为已持证。
- [x] 明确 `faction.licences` 只用于 licence 是否存在、显示名和 `minrelation`，不用于判断玩家是否已持证。
- [x] 实现 `getLicencePurchaseState(factionId, licenceType, playerData)`。
- [x] 将 licence 状态挂到 `factionLicenceTree` 的 licence entry。
- [x] 实现 `getFactionLicenceState(factionId, licenceType)` 供蓝图条目 tag 使用。
- [x] 确保无玩家数据时证书状态为 `default`。

### 4. Presenter 蓝图状态

- [x] 实现 `getBlueprintPurchaseStatus(bp, playerData, factions)`。
- [x] 确保已持证蓝图返回 `purchasable`，不返回"已持证"状态。
- [x] 实现 `blueprintStatusMap`。
- [x] 实现 `blueprintLockedReasonMap`。
- [x] 保持 `noplayerblueprint` 现有默认隐藏逻辑。

### 5. Presenter 过滤逻辑

- [x] 新增 `blueprintStatusFilter`，默认包含 `owned`、`purchasable`、`licence_needed`、`rep_needed`、`locked`、`no_licence`。
- [x] 实现 `toggleBlueprintStatusFilter(status)`。
- [x] 将过滤顺序调整为 class -> search -> faction/licence -> blueprint status。
- [x] 实现 `blueprintStatusCounts`，统计不受 `blueprintStatusFilter` 自身影响。
- [x] 所有蓝图状态均取消时列表为空。

### 6. Vue Filter 面板

- [x] 在 `BlueprintRecipeWorkbench.vue` 的 filter 面板顶部新增「蓝图状态」区域。
- [x] 蓝图模式隐藏该新增过滤区域。
- [x] faction checkbox 前显示当前 faction 声望。
- [x] licence 行保留证书需求声望，并根据状态给证书名称应用绿色/橙色/红色/蓝色样式。
- [x] 不新增旧方案中的 licence 进度条或 `+current/+required` 缺口行。

### 7. Vue 蓝图条目

- [x] 蓝图名称左侧显示 `owned`、`purchasable`、`licence_needed`、`rep_needed`、`locked`、`no_licence` badge。
- [x] 蓝图条目中的 faction+licence tag 按证书状态着色。
- [x] `locked` 蓝图显示 locked reason 文案。
- [x] 蓝图模式不显示状态 badge 和新增颜色语义。

### 8. 视图层集成

- [x] `BlueprintProductionWorkbenchView.vue` 传入蓝图模式的 `playerData = null` 或等价输入。
- [x] `LiveProductionWorkbenchView.vue` 从当前 archive 构造 `PlayerBindingData`。
- [x] 确保 Vue 组件不直接拼装购买状态逻辑。

### 9. 国际化

- [x] `src/locales/zh-CN.json` 新增蓝图状态文案。
- [x] `src/locales/zh-CN.json` 新增 ~~证书状态过滤~~ 文案（已移除，不需要）。
- [x] `src/locales/zh-CN.json` 新增 locked reason 文案。
- [x] `src/locales/en.json` 新增对应英文文案。

### 10. 构建验证

- [x] 执行 `npm run build`。
- [x] ~~如有 TypeScript 编译错误，修复并重复构建直到通过或记录明确 blocker。~~ 构建通过。
