# Live Workforce Integration - Tasks

## Implementation

- [x] T1. 修改 ProductionFlowInput interface - `src/store/state/StationProductionFlowMap.ts`
- [x] T2. 实现 workforceOverride 计算分支 - `src/store/logic/calculateProductionFlows.ts`
- [x] T3. Store 层传递 workforce override - `src/store/useLiveProductionStore.ts`
- [x] T4. Presenter 强制 workforceAuto - `src/components/empire/presenters/useProductionDashboardPresenter.ts`
- [x] T5. Dashboard UI 新增 forceWorkforceAuto prop - `src/components/empire/StationDashboard.vue`
- [x] T6. WorkbenchView 传递 forceWorkforceAuto - `src/components/empire/LiveProductionWorkbenchView.vue`
- [x] T7. Build Validation - `npm run build`

## Bug Fixes (during implementation)

- [x] BF1. Dashboard 在 live 模式下应正确显示实际工人数量和效率
  - `displayedEfficiency`: live 模式用 `props.currentEfficiency`
  - `saturationPercent`: live 模式用效率百分比而非模块容量百分比
- [x] BF2. 当 workforces 为空时，`actualWorkforceOverride` 应为 0 而非 undefined
- [x] BF3. Vue 消耗明细 `workforce:argon` 翻译为 "Argon工人"
  - `StationWareFlow.vue` template 中判断 `workforce:` 前缀
  - i18n key: `station.workforce_label` = "Workers" / "工人"
  - 种族名用 `race.${race}` 已有 i18n