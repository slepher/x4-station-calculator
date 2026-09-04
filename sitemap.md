# X4 Station Calculator Sitemap

面向开发者的当前仓库导航。功能行为从 [`guide/`](guide/index.md) 开始查，稳定需求从 [`openspec/specs/`](openspec/specs/) 开始查；源码事实优先于可能滞后的说明文档。

## 运行入口

```text
index.html
└── src/main.ts
    └── src/App.vue
        └── src/components/MainWorkbench.vue
            ├── Blueprint Production
            ├── Live Production
            ├── Logic Flow
            ├── Ship Build
            └── Maps
```

- 应用装配：[`src/main.ts`](src/main.ts)、[`src/App.vue`](src/App.vue)
- 主工作区分发：[`src/components/MainWorkbench.vue`](src/components/MainWorkbench.vue)
- 国际化与全局样式：[`src/i18n.ts`](src/i18n.ts)、[`src/style.css`](src/style.css)、[`src/locales/`](src/locales/)
- 构建与测试配置：[`package.json`](package.json)、[`vite.config.ts`](vite.config.ts)、[`vitest.config.ts`](vitest.config.ts)、[`playwright.config.ts`](playwright.config.ts)

## UI 与 Presenter

新代码遵循 `store -> presenter -> vue`：store 持有领域状态与计算，presenter 组装 UI 数据，Vue 只消费 presenter。现存 Vue 直连 store 的代码属于待渐进清理的历史实现。

| 工作区 | Vue 入口 | Presenter | 主要 Store |
| --- | --- | --- | --- |
| 生产蓝图 | [`BlueprintProductionWorkbenchView.vue`](src/components/empire/BlueprintProductionWorkbenchView.vue) | [`empire/presenters/`](src/components/empire/presenters/) | [`useBlueprintProductionStore.ts`](src/store/useBlueprintProductionStore.ts)、[`useEmpireDataStore.ts`](src/store/useEmpireDataStore.ts)、[`useBuildPlanStore.ts`](src/store/useBuildPlanStore.ts) |
| 实时生产 | [`LiveProductionWorkbenchView.vue`](src/components/empire/LiveProductionWorkbenchView.vue) | [`empire/presenters/`](src/components/empire/presenters/) | [`useLiveProductionStore.ts`](src/store/useLiveProductionStore.ts)、[`useSaveBindingStore.ts`](src/store/useSaveBindingStore.ts) |
| 逻辑流 | [`LogicFlowWorkbenchView.vue`](src/components/logic-flow/LogicFlowWorkbenchView.vue) | [`logic-flow/presenters/`](src/components/logic-flow/presenters/) | [`useLogicFlowStore.ts`](src/store/useLogicFlowStore.ts) |
| 飞船建造 | [`ShipBuildView.vue`](src/components/ship-build/ShipBuildView.vue) | [`ship-build/presenters/`](src/components/ship-build/presenters/) | [`useShipBuildStore.ts`](src/store/useShipBuildStore.ts) |
| 地图 | [`MapWorkbenchView.vue`](src/components/map/MapWorkbenchView.vue) | 尚无统一 presenter | [`useMapStore.ts`](src/store/useMapStore.ts)、[`useSaveStore.ts`](src/store/useSaveStore.ts) |

生产蓝图与实时生产的当前导航均为 [`ProductionSidebar.vue`](src/components/empire/ProductionSidebar.vue)，其 UI 数据和事件由 [`useProductionSidebarPresenter.ts`](src/components/empire/presenters/useProductionSidebarPresenter.ts) 组装。blueprint reorder 经 [`useBlueprintProductionStore.ts`](src/store/useBlueprintProductionStore.ts) 写入 [`useEmpireDataStore.reorderStationsInEmpire()`](src/store/useEmpireDataStore.ts)。稳定锚点见 [`guide/empire/tabbar/`](guide/empire/tabbar/)；该目录名是历史路径，不是当前 UI 名称。

共享 UI 位于 [`src/components/common/`](src/components/common/)，其余功能组件按 [`empire/`](src/components/empire/)、[`logic-flow/`](src/components/logic-flow/)、[`ship-build/`](src/components/ship-build/)、[`map/`](src/components/map/) 和 [`save/`](src/components/save/) 分组。

## 状态与领域计算

- Store 入口：[`src/store/`](src/store/)
- 状态变更动作：[`src/store/actions/`](src/store/actions/)
- 领域计算与数据构建：[`src/store/logic/`](src/store/logic/)
- 空间站派生状态：[`src/store/state/StationDerivedMap.ts`](src/store/state/StationDerivedMap.ts)
- 领域类型：[`src/types/`](src/types/)
- 静态领域数据：[`src/domain-data/`](src/domain-data/)
- 可复用组合逻辑与工具：[`src/composables/`](src/composables/)、[`src/utils/`](src/utils/)

## 游戏数据、存档与解析

- 版本化游戏数据：[`8.0-Diplomacy`](src/assets/x4_game_data/8.0-Diplomacy/)、[`9.0-Empire`](src/assets/x4_game_data/9.0-Empire/)
- 游戏数据加载：[`src/store/useGameDataStore.ts`](src/store/useGameDataStore.ts)
- 存档状态与绑定：[`useSaveStore.ts`](src/store/useSaveStore.ts)、[`useSaveBindingStore.ts`](src/store/useSaveBindingStore.ts)、[`useLiveProductionStore.ts`](src/store/useLiveProductionStore.ts)
- IndexedDB 存档：[`src/db/saveArchiveDB.ts`](src/db/saveArchiveDB.ts)
- Web Worker 解析：[`src/workers/`](src/workers/)
- Rust/WASM 解析器源码与产物：[`rust-parser/`](rust-parser/)、[`src/wasm/`](src/wasm/)

仅在修改 `rust-parser/src/*.rs` 后运行 `npm run build-rust`。

## 测试与 Fixture

- 权威单元测试：[`tests/unit/`](tests/unit/)
- 权威 E2E：[`tests/e2e/`](tests/e2e/)
- 待迁移历史集合：[`tests/unified-unit/`](tests/unified-unit/)、[`tests/unified-e2e/`](tests/unified-e2e/)
- 迁移后的只读历史测试：`tests/legacy/`（不进入默认验证）
- 测试数据：[`tests/fixtures/`](tests/fixtures/)、[`tests/seeds/`](tests/seeds/)
- 测试装配：[`tests/test-setup.ts`](tests/test-setup.ts)
- Live Binding fixture helper 当前迁移源：[`loadLiveBindingFixture.ts`](tests/unified-e2e/live/helpers/loadLiveBindingFixture.ts)；目标为 `tests/e2e/live/helpers/`
- 测试技能验证独立于产品 Unit：[`tests/skills/`](tests/skills/)、[`tests/e2e-skills/`](tests/e2e-skills/)

## 文档与变更记录

- 用户行为与 UI 锚点：[`guide/index.md`](guide/index.md)
- 项目上下文：[`openspec/project.md`](openspec/project.md)
- 已落地规范：[`openspec/specs/`](openspec/specs/)
- 活跃与归档变更：[`openspec/changes/`](openspec/changes/)
- 设计和实施计划：[`docs/plans/`](docs/plans/)
- 当前规划草稿：[`planner.md`](planner.md)
- 仓库工作规则：[`AGENTS.md`](AGENTS.md)、[`CLAUDE.md`](CLAUDE.md)

## 工程脚本

- 项目脚本：[`scripts/`](scripts/)
- 正式分析脚本：[`analysis/scripts/`](analysis/scripts/)
- 临时分析脚本：[`analysis/tmp_scripts/`](analysis/tmp_scripts/)
- Skill 辅助脚本：[`skill-scripts/`](skill-scripts/)
