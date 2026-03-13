# Test Tasks: simplify-flow

## 1 单元测试

- [✓] 1.1 Flow migration：V2 节点结构迁移为 V3 极简节点结构
  - [✓] 1.1.1 在 `migrateFlowStateToCurrent` 注入 `version=2` 的 flow 数据，节点同时覆盖 `isIsolated=true+wareId` 与 `moduleId` 两类输入
  - [✓] 1.1.2 执行迁移后读取 `state.version` 与 `state.list[0].groups[0].nodes` 输出节点对象键集合
  - [✓] 1.1.3 断言版本升为 `3`，且节点仅包含 `isolated` 或 `module` 二选一键 #期望: [3, 'isolated-or-module-only']

- [✓] 1.2 Empire 导入 flow：最小节点结构映射保持模块统计与锁定货物统计
  - [✓] 1.2.1 构造 `SavedFlowGroup`，包含 `{module:'module_gen_prod_hullparts_01'}` 与 `{isolated:'quantumtubes'}` 两类节点后调用 `buildStationImportPayload`
  - [✓] 1.2.2 读取 `plannedModules`、`lockedWares`、`manualModuleCount` 三个输出字段
  - [✓] 1.2.3 断言模块计数为 1、锁定货物包含 `quantumtubes`、manualModuleCount 为 1 #期望: [[{'id':'module_gen_prod_hullparts_01','count':1}], ['quantumtubes'], 1]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: flow-v2-storage-loaded
  - [✓] 2.1.1 在 `/` 页面执行前置：将 `tests/fixtures/db.json`（去除 `vsn`）写入 `localStorage`，并设置 `isTestEnv=true`
  - [✓] 2.1.2 执行 `page.reload()` 后通过语言选择器切换 `zh-CN`
  - [✓] 2.1.3 在页面初始化完成后读取 `localStorage['x4_logic_flow_plans']` 的 `version` 与 `activeId`
  - [✓] 2.1.4 断言 flow 存储版本已归一为 `3` 且 activeId 保持 `logic-flow-1` #期望: [3, 'logic-flow-1']

- [✓] 2.2 状态: flow-import-empire-modal-ready
  - [✓] 2.2.1 在 overview 视图点击 `.overview-tab`，进入帝国视角
  - [✓] 2.2.2 点击 `data-testid="logicflow-import-entry-empire"` 打开导入弹窗
  - [✓] 2.2.3 在 `data-testid="logicflow-import-plan-list"` 读取计划卡片与直接导入按钮集合
  - [✓] 2.2.4 断言弹窗可见且存在 `logic-flow-1` 对应的直接导入按钮 #期望: [true, 'logicflow-import-plan-direct-logic-flow-1']

- [✓] 2.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
  - [✓] 2.3.1 在 `flow-v2-storage-loaded` 状态下点击 `.overview-tab`
  - [✓] 2.3.2 点击 `data-testid="logicflow-import-entry-empire"`，等待导入弹窗渲染完成
  - [✓] 2.3.3 断言切换后 `data-testid="import-view-modal"` 可见 #期望: [true]

## 3 E2E 测试场景

- [✓] 3.1 Case: V2 flow 数据加载后自动迁移为 V3 极简节点结构
  - [✓] 3.1.1 状态: flow-v2-storage-loaded
  - [✓] 3.1.2 在浏览器上下文读取 `x4_logic_flow_plans.list[0].groups[0].nodes[0]` 的对象键集合并排序 #期望: [['module']]
  - [✓] 3.1.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
  - [✓] 3.1.4 在导入弹窗读取 `data-testid="logicflow-import-plan-item-logic-flow-1"` 文本，断言包含 `3` 个 group 与可导入组计数文本 #期望: ['groups', '组']

- [✓] 3.2 Case: Empire 导入 flow 时最小节点结构仍可直接导入
  - [✓] 3.2.1 状态: flow-import-empire-modal-ready
  - [✓] 3.2.2 在导入弹窗点击 `data-testid="logicflow-import-plan-direct-logic-flow-1"` 后，断言 `data-testid="logicflow-import-warning-modal"` 数量为 `0`
  - [✓] 3.2.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
  - [✓] 3.2.4 在导入后断言 `data-testid="import-view-modal"` 保持可见，且页面 `.station-tab` 数量为 `3` #期望: [1, 3]

## 4 Bug 测试

- [✓] 4.1 BUG-001: V2 节点加载后仍保留旧字段导致 V3 迁移不完整
  - [✓] 4.1.1 在 `tests/fixtures/db.json` 基线下将 `x4_logic_flow_plans.version` 强制写为 `2` 并执行页面重载，复现历史节点格式加载路径
  - [✓] 4.1.2 状态: flow-v2-storage-loaded
  - [✓] 4.1.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
  - [✓] 4.1.4 修复前复现断言（旧行为）当前结果为 `False`，说明 `moduleId` 残留问题不可复现
  - [✓] 4.1.4 修复后断言 `x4_logic_flow_plans.list[0].groups[0].nodes[0]` 不包含 `moduleId` 且仅包含 `module` 字段 #期望: [False, 'module-only']
  - [✓] 4.1.5 在导入弹窗读取 `data-testid="logicflow-import-plan-direct-logic-flow-1"`，断言按钮可见 #期望: [true]

- [✓] 4.2 BUG-002: Empire 导入 flow 时忽略 isolated 节点的锁定货物映射
  - [✓] 4.2.1 在导入前将 `logic-flow-1` 的首个分组补充 `{isolated:'quantumtubes'}` 节点后，按顺序执行 `.overview-tab` 与 `data-testid="logicflow-import-entry-empire"` 打开 empire 导入弹窗
  - [✓] 4.2.2 状态: flow-import-empire-modal-ready
  - [✓] 4.2.3 在弹窗中执行 `logic-flow-1` 直接导入后，使用 `data-testid="import-view-modal"` 可见态与 `data-testid="logicflow-import-warning-modal"` 关闭态作为完成锚点
  - [✓] 4.2.4 修复前复现断言（旧行为）当前结果为 `True`，说明 `lockedWares` 已包含 `quantumtubes`
  - [✓] 4.2.4 修复后断言导入目标站点 `lockedWares` 包含 `quantumtubes` #期望: [True]
  - [✓] 4.2.5 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready
  - [✓] 4.2.6 在导入完成后读取 `localStorage['x4_empire_data']` 的首个站点 `lockedWares`，断言数组包含 `quantumtubes` #期望: [['quantumtubes']]
