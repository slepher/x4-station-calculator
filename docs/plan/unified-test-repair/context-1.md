# unified-test-repair 上下文（第 1 代）

- Context status: `draft`
- Evidence target: `b62034868643b9d2a9af48ab0f634b067e80880d`
- Repository: `/home/slepher/project/x4-station-calculator`
- Branch: `develop`
- Collected: `2026-09-04T00:26:15+08:00`（Asia/Shanghai）

## 合并后修订

- 当前 `develop` 已合并 `npc-storage`（`b6203486`）；本次合并没有改变本计划的目标、泳道拓扑或任务所有权。
- 合并新增/更新了 NPC Trade 当前行为及其 unit 覆盖；这些测试属于 `task-test-1` 的 legacy 迁移/去重输入，不得继续作为第二套权威测试保留。

## 用户目标与已确认语义

- 基于当前 `sitemap.md` 修复 `tests/unified-unit/` 与 `tests/unified-e2e/`。
- 修复前先区分需求变化、测试缺陷、产品回归与环境阻塞；过期或重复的集成测试允许直接删除。
- `TabBar` 到 `Sidebar` 只是导航表现形式变化，概览、空间站选择、创建、重命名、复制、删除、Transit 与重排行为不能仅因 DOM/布局变化而删除。
- 计划必须包含为行为测试点增加稳定 `data-testid`，测试不再依赖旧 `.station-tab`、`.overview-tab`、布局 class 或可变 i18n 文本。

## 当前测试拓扑

`sitemap.md` 将以下目录定义为当前权威：

- 单元测试：`tests/unified-unit/`
- E2E：`tests/unified-e2e/`
- 旧测试：`tests/unit/`、`tests/e2e/`
- 共用数据：`tests/fixtures/`、`tests/seeds/`
- Live helper：`tests/unified-e2e/live/helpers/loadLiveBindingFixture.ts`

当前数量：`unified-unit` 108 个 spec，`unified-e2e` 60 个 spec，旧 `unit` 85 个 spec，旧 `e2e` 18 个 spec。实施时保持 unified 目录为唯一权威；旧目录只迁移仍有独立行为价值且 unified 缺失的用例，随后删除已迁移、重复或过期文件，禁止继续双写。

## 已执行证据

### Unified unit

命令：`npm run test:unit -- tests/unified-unit`

- 108 个文件：36 pass、71 fail、1 skip。
- 400 个测试：234 pass、163 fail、3 skip；另有 16 个收集/运行错误。
- 34 个失败文件未完成收集；主要是已移动/删除的 import 与 mock：`useEmpireStore` 9 个、`StationStateMap` 2 个、`stationComputeService` 2 个、`MapResourceFilterPanel` 2 个，以及若干旧组件路径。
- 至少 88 个 assertion failure 属于测试装配问题：缺失 `@/i18n` default export 41 个、错误 fixture 路径 13 个、无 active Pinia 12 个、错误 `cluster.sectors` shape 7 个、缺少 `gameData.getStorageKey` mock 7 个及同类 API mock 8 个。
- 4 个 ship storage 用例固定期待 schema v2，而当前 `CURRENT_SHIP_BLUEPRINT_VERSION` 为 5，属于过时预期。

合并前对照命令（旧 evidence target）：`npm run test:unit -- tests/unit`

- 83 个文件：67 pass、16 fail。
- 489 个测试：460 pass、29 fail。
- 旧目录并非全都过时，包含 unified 尚未吸收的较新行为测试；因此不能整目录盲删，须按行为价值迁移和去重。

合并后增量证据：`npm run test:unit -- --run tests/unit/npc-trade-ui`

- 当前旧 unit 为 85 个文件；NPC Trade 目录定向运行 5 个文件、13 个测试全部通过。
- 本次合并实际新增 `npc-trade-presenter.spec.ts`、`npc-trade-store.spec.ts`，并更新 `npc-trade-workbench.spec.ts`；`task-test-1` 必须逐项判断其是否迁移到 `tests/unified-unit/`，随后删除 legacy 源文件或按删除门记录证据。

### Unified E2E

首次命令直接使用已有 `dist`，得到 719 tests：113 pass、548 fail、58 skip；该结果混入陈旧构建，不能作为当前源码的产品判定。

显式 `npm run build` 后重跑，Chromium 在当前容器因 sandbox 启动失败，662 fail、57 skip，0 个业务断言到达。此项是环境不可用证据，不得记为产品失败或通过；执行阶段须在可启动浏览器的环境重跑同一 immutable candidate。

`playwright.config.ts` 目前只在 `dist` 不存在时构建，因此会静默复用陈旧产物；这是 harness 缺陷。

## 根因分类

| 分类 | 判定 | 处理原则 |
| --- | --- | --- |
| 测试 import/mock/fixture 漂移 | 测试缺陷 | 对齐当前公开 store/presenter/API；删除仅为已退役私有模块服务的 mock-heavy 用例 |
| 8.0/v2 等固定版本预期 | 测试缺陷 | 从当前版本配置/fixture 断言，不复制产品常量 |
| TabBar class/文本 locator | 表现变化导致的测试缺陷 | 保留行为，迁移到 Sidebar 稳定 test-id |
| Sidebar 缺少规范行为 | 产品回归/实现缺口 | 复用现有领域能力修复，再由独立测试证明 |
| 同一场景的 feature/bug/bugfix 重复 spec | 过期集成测试 | 保留最强的一条黑盒行为链，其余删除 |
| 陈旧 `dist` 与 Chromium sandbox | 测试基础设施/环境 | 强制 fresh build；浏览器不可用时精确记录，不把 404/launch failure 当产品结论 |

## Sidebar 当前事实与稳定锚点契约

- `ProductionSidebar.vue` 已有 `sidebar-overview`、`sidebar-station` + `data-station-id`、`sidebar-add-station` 等部分锚点。
- 星区 header、折叠按钮、上下文菜单动作、删除确认和重排容器缺少稳定锚点。
- `useEmpireDataStore.reorderStationsInEmpire()` 仍是现有领域 owner；新实现不得创建第二份排序状态或绕过 presenter。
- 主规范 `openspec/specs/station-tabs/spec.md` 仍要求拖拽重排并保持 active station；当前 Sidebar 没有 reorder emit/调用链。对 blueprint 导航恢复该链路；live 模式只保持其已有的星区/空间站顺序语义，不臆造跨星区重排。

实施时冻结以下最小 UI 测试契约：

| 行为点 | 锚点 |
| --- | --- |
| Sidebar 根与折叠 | `production-sidebar`、`sidebar-toggle` |
| 固定入口 | 现有 `sidebar-overview`、`sidebar-terraforming`、`sidebar-research` 等 |
| 星区与折叠 | `sidebar-sector` + `data-sector-id`、`sidebar-sector-toggle` + `data-sector-id` |
| 空间站与重排 | `sidebar-station` + `data-station-id`、`sidebar-station-list` |
| 新建 | `sidebar-add-station` |
| 右键菜单 | `sidebar-context-menu`、`sidebar-menu-rename`、`sidebar-menu-duplicate`、`sidebar-menu-delete`、`sidebar-menu-jump-binding` |
| 删除确认 | `sidebar-delete-dialog`、`sidebar-delete-confirm`、`sidebar-delete-cancel` |

ID 表示行为角色，实体身份放入 `data-station-id`/`data-sector-id`；不得把名称、数组序号或翻译文本编码进 test-id。

## 删除与保留门

只有满足至少一项才保留/迁移测试：

1. 覆盖当前 OpenSpec/guide 的用户可观察行为；
2. 覆盖当前公开 store、presenter 或持久化不变量；
3. 能防止已知且仍可能复发的数据损坏、导航错误或版本迁移问题；
4. 提供 unit 无法替代的真实浏览器边界。

满足以下任一项可删除：

1. 唯一目标是已删除组件、私有函数、旧 class/DOM 结构；
2. 与保留用例验证同一行为且断言更弱；
3. 只重放已归档 bug 的实现细节，当前公开行为已有覆盖；
4. 修复需要重建已退役产品层或大规模 mock，且没有独立现行需求。

不得删除仅因当前失败的行为测试；先证明其需求已退役或已有等价覆盖。

## 约束与风险

- 新 UI 变更必须保持 `store -> presenter -> vue`，Vue 不得直接新增 store 调用。
- 不新增测试框架、selector adapter 或兼容 fallback 链；复用 Vitest、Playwright、现有 fixture helper 与 `vuedraggable`。
- 不运行 `npm run build-rust`，本计划不修改 Rust parser。
- 当前浏览器环境不可执行 E2E；这是执行阶段的已知环境风险，不降低验收门。
- 产品代码、测试代码与文档只允许在各自合同 owned paths 内修改；发现跨边界产品缺陷必须走 coding -> target -> integrate -> target。
