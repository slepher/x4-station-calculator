# Bugs: import-logic-flow

## Bug #1: Store 自动写入 group.name 与设计意图不符

- **状态**: Fixed
- **优先级**: High
- **位置**: `src/store/useLogicFlowStore.ts`（`expandUpstream` -> `updateGroupName` 路径）

### 描述

当前在手动投放后，store 会将“默认显示名”直接写入 `group.name`。
该行为会把“派生显示值”固化为“持久字段”，与设计意图不一致。

### 预期

1. `group.name` 仅在用户显式编辑时更新。
2. 默认组名在展示层按统一算法动态计算，不写回 store。

### 影响

1. 导入映射后组名语义混淆（用户命名与系统派生值无法区分）。
2. 多处 UI 默认名逻辑难以统一。

### 修复方向

1. 抽取默认组名通用函数供 UI 调用。
2. 移除 store 自动写 `group.name` 的路径。

### 实际修复

1. 新增 `src/store/logic/logicFlowGroupName.ts` 统一默认组名算法。
2. 在 `ProductionLineGroup.vue`、`LogicFlowPlanningZone.vue`、`LoadFlowPlanModal.vue`、`LogicFlowCandidateZone.vue` 复用该算法。
3. 移除 `useLogicFlowStore` 中 `expandUpstream/promoteNode/replaceNodeWithLineage` 的 `group.name` 自动写入路径。

## Bug #2: 帝国总览导入入口与空间站导入入口位置/对齐不一致

- **状态**: Verified
- **优先级**: High
- **位置**: `src/components/ContextToolbar.vue`

### 描述

帝国总览状态下的导入按钮虽然位于右侧，但与空间站状态下导入按钮的容器结构和对齐基线不一致，导致视觉位置仍不对应。

### 复现步骤

1. 进入空间站页面，记录右侧导入按钮位置。
2. 切换到帝国总览，观察右侧导入按钮位置。
3. 对比两种状态下导入按钮的水平/垂直对齐。

### 预期

1. 帝国总览导入按钮与空间站导入按钮使用一致的右侧槽位结构。
2. 两种状态的导入按钮在工具栏中保持一致的右对齐与垂直对齐基线。

### 实际

帝国总览导入按钮仍与空间站导入按钮存在视觉偏差（对齐不一致）。

### Related Test

`openspec/changes/import-logic-flow/test_tasks.md` - `2.10 导入入口对齐一致性回归（Bug #2）`

### 实际修复

1. 统一帝国总览与空间站分支的导入按钮右侧槽位结构。
2. 将导入按钮改为条件分支外的共享槽位渲染，确保两种状态使用同一定位容器与对齐基线。
3. 新增 E2E 回归用例 `2.10 导入入口对齐一致性回归（Bug #2）`，并验证通过。

## Bug #3: 无保存确认路径下，New/帝国导入会把空帝国写入已保存列表

- **状态**: Verified
- **优先级**: High
- **位置**: `src/store/useEmpireStore.ts`（`createEmpire`）

### 描述

在未弹出保存确认的路径下：
1. 点击 `New` 会创建空帝国，并被直接写入 `savedEmpires.list`；
2. 帝国导入路径中的重置也会创建空帝国并写入 `savedEmpires.list`。

表现为“载入界面出现空白帝国”，用户体感像是“新建/导入同时自动保存了空帝国”。

### 复现步骤

1. 构造已保存帝国状态并记录 `savedEmpires.list.length`。
2. 在不弹保存确认的路径下点击 `New`。
3. 进入帝国导入并执行卡片内直接导入（不触发保存确认）。
4. 观察 `savedEmpires.list.length` 是否增加，以及载入界面是否出现空白帝国项。

### 预期

1. `New` 与帝国导入在未显式保存时不得把空帝国写入已保存列表。
2. 载入界面不应新增空白帝国项。

### 影响

1. 已保存列表被污染（出现空白帝国项）。
2. 用户误以为系统自动保存了空帝国。

### 实际修复

1. 调整 `createEmpire`：仅创建内存态 `activeEmpire`，不再自动写入 `savedEmpires.list`。
2. 保持显式保存入口唯一性：仅 `saveEmpire()` 才持久化到已保存列表。
3. 同步单元测试口径：初始化新帝国时 `empires.length` 可为 `0`（未保存）。

### 验证结果

1. 复现前（预期失败）：
   - `npx playwright test tests/e2e/import-logic-flow -g "3.19 Bug #3"` → 1 failed（`savedEmpires.list.length` 从 1 变 2）。
2. 修复后（通过）：
   - `npm run build` → passed
   - `npx playwright test tests/e2e/import-logic-flow -g "3.19 Bug #3"` → 1 passed
   - `npx playwright test tests/e2e/import-logic-flow` → 34 passed
   - `npx vitest run tests/unit/multi-station-empire` → 13 passed
