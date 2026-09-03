# unified-test-repair 实施计划（第 1 代草案）

- Plan status: `draft`
- Context: `context-1.md`
- Evidence target: `b62034868643b9d2a9af48ab0f634b067e80880d`
- Profile: `light`

## 计划修订记录

- `2026-09-04`：以当前 `develop` 的 `npc-storage` 合并提交 `b6203486` 作为新的 immutable evidence target；目标、范围、泳道拓扑和任务所有权不变。
- `task-test-1` 的 legacy unit 输入由 83 个调整为 85 个，新增/更新的 NPC Trade 测试必须纳入迁移、去重或删除证据清单。
- `task-coding-1.2` 补列其已明确要求同步的 `guide/functions.md` owned path；责任人、文档范围与泳道拓扑不变。

## 目标

把 `tests/unified-unit/` 与 `tests/unified-e2e/` 收敛为当前 sitemap 所声明的唯一测试权威：修复仍有效的行为测试，迁移旧目录中独有的现行覆盖，删除过期/重复/只绑定旧实现的用例，并修正 fresh-build、fixture、版本 key 与浏览器装配问题。

TabBar 到 Sidebar 只改变表现形式。导航行为必须保留，测试改用稳定 `data-testid`；当前实现缺失但规范仍要求的 blueprint 空间站重排，通过现有领域 owner 恢复，不新建排序体系。

## 决策

1. `tests/unified-unit/`、`tests/unified-e2e/` 保持 canonical；`tests/unit/`、`tests/e2e/` 是迁移来源，不继续作为第二套套件。
2. 测试按行为价值裁剪，不按“失败/通过”裁剪。旧组件私有结构、重复 bug spec 和高成本低价值 mock 可删。
3. Sidebar 测试锚点使用角色型 `data-testid` 加实体 ID attribute；禁止重建旧 TabBar class 作为兼容层。
4. 排序只复用 `useEmpireDataStore.reorderStationsInEmpire()`；Vue 通过 presenter 触发，保持 `store -> presenter -> vue`。
5. Playwright 每次正式执行必须针对当前源码生成 fresh `dist`；不得因目录存在就跳过构建。
6. 不新增依赖、测试框架、selector facade、版本 fallback 链或测试专用产品状态。

## 范围

包含：

- Sidebar 导航、上下文菜单、折叠、实体定位和 blueprint station reorder 的稳定测试接口与行为修复。
- station-tabs/Sidebar 规范、guide、sitemap 与实际行为同步。
- Vitest/Playwright 入口、当前版本 localStorage key、fixture/helper、语言设置及 fresh-build 规则修复。
- unified unit/E2E 的逐项分类、修复、迁移、去重和删除。
- 以 immutable candidate 运行 unit/build/E2E；浏览器环境不可用须明确记录并在可用环境闭合。

不包含：

- 重写业务 store、建立新导航状态或恢复已删除 TabBar 组件。
- 为了保住旧测试重建 `useEmpireStore`、`StationStateMap`、`stationComputeService` 等已退役接口。
- 新增兼容层、通用 selector DSL、测试框架或依赖。
- 与 unified 失败无关的产品功能修复；发现后作为独立 finding 返回。

## 接受语义

1. Blueprint 与 live 的概览、station、Transit、固定工作区、创建和右键动作在 Sidebar 中保持原用户行为。
2. Blueprint station 拖拽重排更新 `activeEmpire.stations`，当前 active station ID 不变；非法排序仍被领域 owner 拒绝。
3. `context-1.md` 列出的稳定 test-id 可由 Playwright 直接定位，且不依赖名称、序号、翻译或布局 class。
4. 所有保留 unified unit spec 能收集并运行；不存在已删除 import、无 active Pinia、错误 i18n export、过时 fixture shape 或硬编码旧 schema version。
5. 所有保留 unified E2E 通过统一 fixture 装配、reload、UI 切换语言；Live 用例通过唯一 helper 建立 localStorage + IndexedDB 状态。
6. 旧 unit/E2E 中仍有独立价值的覆盖已迁移；其余删除，配置不再默认执行旧目录。
7. E2E 不再使用 `.station-tab`、`.overview-tab` 或其他已退役 TabBar locator。
8. Playwright 不复用与当前源码不一致的 `dist`；404、browser launch failure 与业务断言失败被分别报告。

## task-coding-1

修复 Sidebar 的行为接口与稳定测试锚点，并同步 station-tabs/Sidebar 规范、guide 与 sitemap。该阶段复用现有排序 owner，不实现测试迁移；冻结合同见 `task-coding-1.md`。

## task-coding-2

修复统一测试装配：Vitest 只以 canonical 目录为默认入口，Playwright 强制 fresh build，fixture/helper 使用当前版本存储键、IndexedDB 和 UI 语言流程。该阶段不改测试场景；冻结合同见 `task-coding-2.md`。

## task-test-1

独立整理 unit：从旧目录迁移独有现行覆盖，修复 unified import/mock/fixture/assertion，删除重复或退役实现测试，并运行完整 canonical unit suite；冻结合同见 `task-test-1.md`。

## task-test-2

独立整理 E2E：保留 TabBar 对应的 Sidebar 行为测试，全部切换到稳定 test-id；迁移旧目录的独有浏览器覆盖，删除重复/低价值集成测试，并在 fresh build 上运行 canonical E2E；冻结合同见 `task-test-2.md`。

## 总体验收门

- `npm run build`、`npm run test:unit -- tests/unified-unit`、`npm exec playwright test -- tests/unified-e2e`、`git diff --check` 在同一最终 candidate 上通过。
- `vitest.config.ts` 默认不再包含 `tests/unit/**`，Playwright 默认不再采集 `tests/e2e/**`；旧目录无剩余 spec。
- Sidebar 稳定锚点、blueprint reorder、概览/station/Transit/上下文菜单行为均有对应 unit 或 E2E 断言。
- 无旧 TabBar locator、已退役 source import、手写 Live archive 注入或固定旧 storage/schema version。
- 如当前执行环境仍无法启动 Chromium，计划不能宣称 E2E 通过；必须把 exact launch evidence 交给可用环境的后续验证 owner。

## 停止与升级条件

遇到新产品语义、需要改变持久化 schema、必须恢复已退役模块、需要新增依赖/测试框架、无法保持 store-presenter-vue、或删除测试缺乏现行需求/等价覆盖证据时停止并返回 planner/user。测试 worker 发现产品缺陷时不得在 integrate lane 修产品。
