# Live Cargo Volume - Tasks

## Task 1: 解析并透传 player station target 数据

- [x] 文件: `rust-parser/src/model.rs`
- [x] 新增 `StationTradeOverrides`
- [x] 为 `PlayerStationEntry` 新增 `overrides`
- [x] 文件: `rust-parser/src/core.rs`
- [x] 解析 `player station -> overrides -> max/buy/sell`
- [x] 仅采集 `ware/amount`
- [x] 输出排序后的 `WareAmount[]`
- [x] 文件: `src/types/saveArchive.ts`
- [x] 新增 `StationTradeOverrides`
- [x] 为 `PlayerStationEntry` 新增 `overrides`
- [x] 为 `ArchiveStationData` 新增 `overrides`
- [x] 为 `ArchiveStationData` 新增 `targetCounts`
- [x] 文件: `src/store/useLiveProductionStore.ts`
- [x] 在 `archiveStation` 组装结果中透传 `overrides`
- [x] 在 `archiveStation` 组装结果中设置 `targetCounts = overrides.max`

## Task 2: 新增 live volume allocation store 数据

- [x] 文件: `src/store/useLiveProductionStore.ts`
- [x] 基于 `archiveStation.cargo` 构建 `currentCount` map
- [x] 基于 `archiveStation.targetCounts` 构建 `targetCount` map
- [x] 基于 `stationState.derivedProductionFlows` 或等价 live volume 来源提取 `recommendedCount`
- [x] 按现有 volume 规则分组为 `container / solid / liquid`
- [x] 保持当前 volume 视图排序：`orderIndex` → `tier` → `wareId`
- [x] 计算每个 item 的 `scaleMaxCount`
- [x] 识别“不在当前生产和消耗列表中的 ware`
- [x] 为这些 ware 产出 `liveCargoOnlyItems`
- [x] `liveCargoOnlyItems` 使用 `targetMap[wareId] ?? 0`
- [x] `liveCargoOnlyItems` 排序：`tier` 降序 → `ware.name` 升序
- [x] 暴露 `liveVolumeAllocationGroups`
- [x] 暴露 `liveCargoOnlyItems`
- [x] 为每个 allocation item 产出展开时间明细
- [x] 将展开时间明细拆成 `Summary / Boundary / Downstream` sections

## Task 3: 扩展 wareflow presenter

- [x] 文件: `src/components/empire/presenters/useProductionWareflowPresenter.ts`
- [x] `WareflowPresenterProps` 新增 `liveVolumeAllocationGroups`
- [x] `WareflowPresenterProps` 新增 `liveCargoOnlyItems`
- [x] `WareflowPresenterStore` 接口新增 `liveVolumeAllocationGroups`, `liveCargoOnlyItems`
- [x] props computed 填充，默认空数组

## Task 4: StationWareFlowsDashboard 按模式分发 volume 视图

- [x] 文件: `src/components/empire/StationWareFlowsDashboard.vue`
- [x] 引入新组件 `LiveStationAllocationView`
- [x] 在 `viewMode === 'volume'` 分支中增加 `visualMode` 判断
- [x] `live + volume` 渲染新组件
- [x] `planning + volume` 继续渲染现有旧组件
- [x] 保持 header、tab、controls 外壳不变

## Task 5: 新增 live volume 专用组件

- [x] 文件: `src/components/empire/LiveStationAllocationView.vue`
- [x] 支持渲染 `container / solid / liquid` 三组
- [x] 组头显示 `Cur / Tar / Rec` 的 `m3` 汇总
- [x] 每行渲染 ware 名称、同风格壳、库存进度条和推荐值
- [x] 行顺序完全使用 presenter 输入，不做重新排序
- [x] 在最下方渲染 cargo-only 单列
- [x] cargo-only 单列仅显示 ware 名称、当前存量和 target
- [x] 展开区按列显示 `targetCount / recommendedCount` 时间明细
- [x] 展开区分段显示 `Summary / Boundary / Downstream`
- [x] `Downstream` 默认折叠

## Task 6: 新增 allocation progress row / bar 组件

- [x] 文件: `src/components/empire/LiveStationAllocationRow.vue`
- [x] 接收 `currentCount / targetCount / recommendedCount / scaleMaxCount`
- [x] 渲染统一比例尺的 allocation progress bar
- [x] 条上显示 `currentCount / targetCount`
- [x] `recommendedCount` 保持原 volume 行接近的显示风格
- [x] 所有 ware 进度条横向对齐

## Task 7: 新增 cargo-only row 组件

- [x] 文件: `src/components/empire/LiveStationCargoOnlyRow.vue`
- [x] 接收 `name / currentCount / targetCount`
- [x] 仅渲染 current 和 target，不渲染 recommended 或 progress bar

## Task 8: i18n 文案

- [x] 文件: `src/locales/zh-CN.json`, `src/locales/en.json`
- [x] 新增 live allocation 视图相关 key
- [x] 至少包含：`current`, `target`, `recommended`, cargo-only 区标题、组头或空态相关文案

## Task 9: 测试

- [x] 文件: `rust-parser/src/tests.rs`
- [x] 新增 `parses_player_station_trade_overrides`
- [x] 验证 `max / buy / sell` 三组均被解析
- [x] 文件: `tests/unit/save-import/save-parser.spec.ts`
- [x] 新增 `preserves player station overrides after post processing`
- [ ] 新增 `useLiveProductionStore` 的 allocation 数据单测
- [ ] 新增 presenter 层相关单测
- [ ] 新增 `live + volume` 组件渲染测试
- [ ] 如有必要，补 E2E

## Task 10: 文档同步

- [x] 文件: `openspec/changes/live-cargo-volume/request.md`
- [x] 文件: `openspec/changes/live-cargo-volume/design.md`
- [x] 文件: `openspec/changes/live-cargo-volume/specs/live-cargo-volume/spec.md`
- [x] 将 `targetCount` 最终来源改为 `playerStation.overrides.max`
- [x] 移除 `targetCount = recommendedCount` 的过渡口径
- [x] 移除 `targetCount = currentCount` 的过渡口径

## Task 11: 验证

- [x] 执行 `cargo test`
- [x] 执行 `npm run build`
- [ ] 在 UI 接线完成后补跑相关前端测试
