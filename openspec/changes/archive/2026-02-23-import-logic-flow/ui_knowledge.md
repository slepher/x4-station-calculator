# UI Knowledge: import-logic-flow

本文档覆盖 `test_tasks.md` 中 Web Integration 所需的可达路径、关键定位器与数据预置口径。

## 1. 关键定位器（基于现有组件）

| 元素 | 定位器 | 来源文件 | 说明 |
|------|--------|----------|------|
| 页面 ready 标记 | `#debug-ready-marker` | `src/components/StationWorkbench.vue` | 等待应用完成初始化 |
| 顶部工具栏 | `.toolbar-panel` | `src/components/StationToolbar.vue` | 顶部主工具栏 |
| 工具栏新建按钮 | `button:has-text("toolbar.new")`* | `src/components/StationToolbar.vue` | 用于触发“新建”路径并对照保存确认弹框 |
| 工具栏保存按钮 | `button:has-text("Save")` / `button:has-text("保存")`* | `src/components/StationToolbar.vue` | 用于进入 S1/S2 状态时的保存与可点击性验证 |
| 空间站导入入口 | `[data-testid="logicflow-import-entry-station"]` | `src/components/ContextToolbar.vue` | 空间站页面右侧导入按钮 |
| 帝国导入入口 | `[data-testid="logicflow-import-entry-empire"]` | `src/components/ContextToolbar.vue` | 帝国总览右侧导入按钮 |
| 导入选择弹窗 | `[data-testid="logicflow-import-modal"]` | `src/components/LogicFlowImportModal.vue` | Station/Empire 共用导入源选择弹窗 |
| 导入方案选择 | `[data-testid="logicflow-import-plan-select"]` | `src/components/LogicFlowImportModal.vue` | 方案下拉 |
| 导入规划区内容区 | `[data-testid="logicflow-import-group-list"]` | `src/components/LogicFlowImportModal.vue` | Station 模式二级内容区（加载界面风格） |
| 导入规划区项 | `[data-testid^="logicflow-import-group-item-"]` | `src/components/LogicFlowImportModal.vue` | Station 模式二级内容区中的可选规划区按钮 |
| 导入规划区直接导入 | `[data-testid^="logicflow-import-group-direct-"]` | `src/components/LogicFlowImportModal.vue` | Station 模式每项直接导入按钮 |
| 导入规划区空态 | `[data-testid="logicflow-import-group-empty"]` | `src/components/LogicFlowImportModal.vue` | 无可导入规划区时空态文案 |
| 导入继续按钮（遗留，改造后应移除） | `[data-testid="logicflow-import-continue"]` | `src/components/LogicFlowImportModal.vue` | 仅用于回归断言“不应出现” |
| 帝国导入保存确认弹窗 | `SmartSaveDialog` 容器 | `src/components/ContextToolbar.vue` | 仅在“需要保存确认”条件下出现 |
| 新建按钮保存确认弹窗 | `SmartSaveDialog` 容器 | `src/components/StationToolbar.vue` | 新建按钮的基准判定路径 |
| 空间站导入确认弹窗 | `[data-testid="station-import-confirm-modal"]` | `src/components/StationImportConfirmDialog.vue` | Station 专用确认 |
| 导入为新站动作 | `[data-testid="station-import-confirm-new"]` | `src/components/StationImportConfirmDialog.vue` | Station 新建导入分支 |
| 覆盖当前站动作 | `[data-testid="station-import-confirm-overwrite"]` | `src/components/StationImportConfirmDialog.vue` | Station 覆盖导入分支 |
| warning 汇总弹窗 | `[data-testid="logicflow-import-warning-modal"]` | `src/components/LogicFlowImportWarningModal.vue` | 导入后 warning 单弹窗汇总 |
| 视图切换-生产 | `button:has-text("view.production")`* | `src/components/StationToolbar.vue` | 切换生产视图 |
| 视图切换-逻辑组网 | `button:has-text("view.logical_flow")`* | `src/components/StationToolbar.vue` | 切换逻辑组网视图 |
| 候选区容器 | `.candidate-zone` | `src/components/LogicFlowCandidateZone.vue` | 逻辑组网候选区 |
| 候选区货物卡 | `.ware-card-wrapper[data-ware-id][data-tier]` | `src/components/LogicFlowCandidateZone.vue` | Tier>0 可用于创建有效规划区 |
| 卡片加号按钮 | `.ware-card-add-btn` | `src/components/LogicFlowCandidateZone.vue` | 打开“Add to...”菜单 |
| 快速新建产线动作 | `.context-menu-new-line` | `src/components/LogicFlowCandidateZone.vue` | 直接创建含 manual 的规划区 |
| 规划区容器 | `.planning-zone` | `src/components/LogicFlowPlanningZone.vue` | 逻辑组网规划区区域 |
| 拖拽紧凑态标记 | `[data-testid="compact-view"]` | `src/components/LogicFlowPlanningZone.vue` | 拖拽状态断言 |
| 流程方案载入弹窗标题 | `text=planning.load_flow_plan`* | `src/components/LoadFlowPlanModal.vue` | 流程方案列表弹窗 |


a. `*:has-text("i18n-key")` 仅作语义提示。实际 E2E 应优先使用稳定 class/data 属性或项目当前语言的可见文本。

## 1.1 增量需求（界面约束）定位补充

本节对应 `test_tasks.md` 的 2.11~2.19，用于界面改造后的断言稳定性。

| 目标 | 推荐定位器 | 说明 |
|------|------------|------|
| 帝国导入切换为加载帝国形态（改当前模板） | `[data-testid="logicflow-import-modal"]` | 入口后命中当前导入模板容器，但界面形态应对齐“加载帝国” |
| 帝国方案卡片列表 | `[data-testid="logicflow-import-plan-list"]` | 帝国模式使用加载界面风格内容区 |
| 帝国方案卡片项 | `[data-testid^="logicflow-import-plan-item-"]` | 用于按 planId 精确点击 |
| 帝国详情预览块 | `[data-testid^="logicflow-import-plan-preview-"]`（建议新增） | 方案卡片中的预览内容区 |
| 帝国预览扩展提示 | `[data-testid^="logicflow-import-plan-more-"]`（建议新增） | `+N more...` 显示区域 |
| 空间站一级下拉 | `[data-testid="logicflow-import-plan-select"]` | 一级选择控件保持下拉 |
| 空间站二级内容区（目标形态） | `[data-testid="logicflow-import-group-list"]`（建议新增） | 选中方案后展示与帝国同风格的规划区内容区 |
| 空间站二级可选项 | `[data-testid^="logicflow-import-group-item-"]` | 用于按 groupId 精确点击规划区 |
| 空间站规划区直接导入按钮 | `[data-testid^="logicflow-import-group-direct-"]`（建议新增） | 每个规划区项内直接触发导入 |
| 空间站规划区预览块 | `[data-testid^="logicflow-import-group-preview-"]`（建议新增） | 规划区卡片中的预览内容区 |
| 空间站预览扩展提示 | `[data-testid^="logicflow-import-group-more-"]`（建议新增） | `+N more...` 显示区域 |
| 空间站二级空态文案 | `[data-testid="logicflow-import-group-empty"]`（建议新增） | 文案：`该方案下暂无可导入的规划区` |
| 底部继续按钮（应移除） | `[data-testid="logicflow-import-continue"]` | 改造后不应出现在导入弹窗中 |
| 二级下拉（改造后应不存在） | `select[data-testid="logicflow-import-group-select"]` | Station 模式下不应出现该下拉节点 |
| 二级区搜索输入（不应出现） | `[data-testid="logicflow-import-group-search"]`（若存在则视为回归） | 增量需求明确不支持搜索 |
| 二级区分页控件（不应出现） | `[data-testid="logicflow-import-group-pagination"]`（若存在则视为回归） | 增量需求明确不支持分页 |
| 二级区排序控件（不应出现） | `[data-testid="logicflow-import-group-sort"]`（若存在则视为回归） | 增量需求明确不支持排序 |

## 2. 可达路径（Reachable Paths）

### Path A（推荐）：测试前注入本地存储方案数据

1. 在 `page.goto()` 前执行 `page.addInitScript`。
2. 写入 `localStorage['x4_logic_flow_plans']`，结构满足 `SavedFlowPlansState`。
3. `goto` 后等待 `#debug-ready-marker`。
4. 直接进入导入测试，无需先走逻辑组网手工建数。

适用：导入链路回归、CI 稳定性优先。

### Path B（备选）：纯 UI 生成有效 logic-flow 数据

1. 等待 `#debug-ready-marker`。
2. 点击工具栏“逻辑组网”视图切换按钮。
3. 在 `.candidate-zone` 找到任一 `data-tier>0` 的 `.ware-card-wrapper`。
4. 点击其 `.ware-card-add-btn`，在菜单点击 `.context-menu-new-line`。
5. 在 `.planning-zone` 验证出现非空规划区（至少 1 个 `manual` 节点）。
6. 点击工具栏 `Save` 保存方案，作为后续导入数据来源。

适用：验证“真实用户路径”与建数可用性。

## 3. 本地存储注入口径（Path A 示例）

```ts
await page.addInitScript(() => {
  const now = Date.now();
  const data = {
    version: 1,
    activeId: 'ilf_valid_single_group',
    list: [
      {
        id: 'ilf_valid_single_group',
        name: 'ILF Valid Single Group',
        settings: { isDefaultLocked: true },
        lastUpdated: now,
        groups: [
          {
            id: 'g1',
            name: '',
            category: 'industrial',
            subCategory: 'default',
            isLocked: true,
            lockedLineage: 'default',
            nodes: [
              {
                id: 'n1', wareId: 'microchips', moduleId: 'module_gen_chip_01',
                race: 'default', lineage: 'default', column: 2,
                isIsolated: false, source: 'manual', isRoot: true, order: 0
              }
            ]
          }
        ]
      }
    ]
  };
  localStorage.setItem('x4_logic_flow_plans', JSON.stringify(data));
});
```

说明：`moduleId/wareId` 示例值应以项目当前游戏数据实际可解析值为准，测试中建议通过 fixture/工厂函数统一生成，避免硬编码漂移。

## 4. 导入链路断言建议

1. 入口断言：空间站页与帝国总览页都能进入导入流程。
2. 选择断言：Station 要求“一级方案下拉 + 二级规划区内容区直接导入”；Empire 要求“方案”。
3. 确认断言：
   - Empire 路径按“与新建同源”的条件判定：需要确认时出现 `SmartSaveDialog`，不需要确认时不出现。
   - Station 路径出现独立导入确认弹窗。
4. 结果断言：
   - 覆盖导入：当前站模块重建。
   - 新建导入：新增站并切换。
   - 帝国导入：空规划区被跳过。
5. warning 汇总断言：一次弹窗汇总显示“空规划区跳过”和“非 container 忽略”（按场景）。
6. 增量约束断言：
   - 帝国导入入口后仍落在当前导入弹窗容器，且展示 `logicflow-import-plan-list` 卡片区。
   - 帝国方案卡片展示详情预览与 `+N more...`（当条目超出展示上限）。
   - Station 一级为下拉；选中方案后二级展示 `logicflow-import-group-list` 内容区。
   - Station 二级项提供 `logicflow-import-group-direct-*` 直接导入操作。
   - Station 规划区卡片展示详情预览与 `+N more...`（当条目超出展示上限）。
   - 当无可导入规划区时展示 `logicflow-import-group-empty` 空态文案。
   - 导入弹窗不应出现 `logicflow-import-continue` 底部继续按钮。
   - Station 二级区不出现搜索/分页/排序控件。
   - 导入与新建在同状态下的保存确认弹框结果一致（都弹或都不弹）。

## 5. 与 `test_tasks.md` 的对齐关系

1. `test_tasks.md` 的 2.0 对应 Path A。
2. `test_tasks.md` 的状态/切换执行步骤统一在第 2 章（2.3~2.6），不再在第 0 章重复维护。
3. 状态构建口径以帝国上下文为准：
   - `状态：帝国已保存基线态`：执行 Save 后，“新建/导入”不触发 SmartSaveDialog。
   - `状态：帝国待保存更改态`：帝国数据发生可见改动且未保存时，“新建/导入”触发 SmartSaveDialog。
4. `activeStationId-only` 变化规则：
   - 仅执行空间站与帝国总览切换时，应保持 `状态：帝国已保存基线态`。
   - 若切换后触发 SmartSaveDialog，视为 dirty 判定回归。
   - 复现建议：在 E2E 中可直接调用 `empireStore.selectStation(null)` 构造 `activeStationId-only` 变化。
5. Web Integration 各项默认基于 Path A 执行；若需补充状态构建，可复用“帝国数据改动 + Save/不保存”分支，不依赖逻辑组网视图构造脏状态。

## 6. 执行期补充（/x4:test）

### 6.1 方案名称定位冲突规避（重要）

在导入相关 E2E 中，计划名（如 `ILF Valid Single Group`）可能同时出现在：
1. 页面标题/工具栏；
2. 弹窗列表项。

若直接使用全局 `getByText(planName)`，Playwright strict mode 可能报多命中。

建议：
1. 先定位弹窗容器（`[data-testid="logicflow-import-modal"]` 或加载方案弹窗容器）。
2. 在容器作用域内定位计划名称与按钮，避免全局文本定位。
3. 优先 `data-testid` + scoped locator，不依赖全局文本唯一性。

### 6.2 本变更链路稳定定位器（已验证）

1. 入口按钮：
   - `[data-testid="logicflow-import-entry-station"]`
   - `[data-testid="logicflow-import-entry-empire"]`
2. 导入选择弹窗：
   - `[data-testid="logicflow-import-modal"]`
   - `[data-testid="logicflow-import-plan-select"]`
   - `[data-testid="logicflow-import-group-list"]`
   - `[data-testid="logicflow-import-group-empty"]`
   - `[data-testid^="logicflow-import-group-item-"]`
   - `[data-testid^="logicflow-import-group-direct-"]`
   - `[data-testid="logicflow-import-continue"]`（遗留，仅用于断言改造后不存在）
3. 站点确认弹窗：
   - `[data-testid="station-import-confirm-modal"]`
   - `[data-testid="station-import-confirm-new"]`
   - `[data-testid="station-import-confirm-overwrite"]`
4. warning 汇总：
   - `[data-testid="logicflow-import-warning-modal"]`
5. 保存确认弹框对照：
   - 导入路径：`ContextToolbar.vue` 的 `SmartSaveDialog`（仅条件命中时出现）
   - 新建路径：`StationToolbar.vue` 的 `SmartSaveDialog`（基准判定）
   - 关闭策略：优先点击弹框头部右上角关闭按钮；避免用 `Discard` 关闭（会触发新建并重置上下文）
   - 状态判定注意：`activeStationId` 变化不应触发 dirty；仅站点/总览切换不得单独进入“待保存”判定

## 7. 2.1 场景稳定定位建议（已回归通过）

在“载入流程方案”弹窗（`LoadFlowPlanModal`）中，推荐采用以下顺序：

1. 先作用域到弹窗容器：
   - `.fixed.inset-0` + 标题关键字（`Load Flow Plan` / `planning.load_flow_plan`）
2. 在该容器内断言方案可见，不使用全局 `getByText`。
3. 在该容器内定位 `Load Plan` 按钮并按索引点击：
   - 方案 A 使用 `first()`
   - 方案 B 使用 `nth(1)`

这样可避免：
1. 方案名与工具栏标题同名导致 strict mode 多命中；
2. 非弹窗卡片类名干扰导致按钮定位超时。

## 8. Bug #2 对齐回归（入口一致性）

### 8.1 关键定位器

1. 空间站入口：`[data-testid="logicflow-import-entry-station"]`
2. 帝国入口：`[data-testid="logicflow-import-entry-empire"]`
3. 工具栏容器：`.context-toolbar`

### 8.2 回归流程

1. 在空间站模式获取 `logicflow-import-entry-station` 的 `boundingBox()`。
2. 切到帝国总览获取 `logicflow-import-entry-empire` 的 `boundingBox()`。
3. 断言：
   - 右对齐位置一致（x + width 接近）。
   - 垂直基线一致（y 与 height 组合接近）。
   - 状态切换后无明显跳位。
