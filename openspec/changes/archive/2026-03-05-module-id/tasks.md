# Tasks: module-id

## 1. 模块数据模型与索引
- [x] 1.1 更新 `X4Module` 类型：`id` 切换为 `module id`，新增 `macroId` 字段。
- [x] 1.2 调整模块数据生成脚本，输出 `id=moduleId`、`macroId=<macro>`。
- [x] 1.3 调整 `modules.json` 产物与 `useGameData` 构图逻辑，补充 `macroId` 索引映射。

## 2. Empire 存储迁移（最新版本 v3）
- [x] 2.1 引入 `CURRENT_EMPIRE_VERSION = 3` 并替换硬编码版本。
- [x] 2.2 在 Empire 初始化路径补充 `v2 -> v3` 迁移。
- [x] 2.3 实现站点 `modules[].id`（macro/module 混合输入）归一为 `module id`。
- [x] 2.4 为无法映射的模块生成 warning，并保证迁移可继续。

## 3. Logic Flow 存储迁移（最新版本 v2）
- [x] 3.1 引入 `CURRENT_FLOW_VERSION = 2` 并替换硬编码版本。
- [x] 3.2 在 Flow 初始化路径补充 `v1 -> v2` 迁移。
- [x] 3.3 实现 `nodes[].moduleId` 归一为 `module id`。
- [x] 3.4 对无法映射的节点保留 `wareId` 并记录 warning。

## 4. Import/Export 动态迁移管线
- [x] 4.1 调整 `coerceEmpireState/coerceFlowState`：仅做结构容错，不覆盖输入版本。
- [x] 4.2 实现按输入版本逐级迁移到最新版本的 `migrateEmpireState/migrateFlowState`。
- [x] 4.3 覆盖导入与增量导入都统一先迁移再写入。
- [x] 4.4 `merge/remap/export` 全链路输出最新版本（Empire=3、Flow=2）。

## 5. x-game/XML 导入统一解析
- [x] 5.1 扩展 `resolveModuleId` 使其支持 `module id`、`macroId`、别名、`wareId` 兜底。
- [x] 5.2 修正 XML 导入路径，确保 `useStationStore.importPlan` 与 `ImportPlanModal` 一致走解析归一。
- [x] 5.3 对不可解析项输出可追踪 warning，不阻断可解析项导入。

## 6. seed 与 fixture 生成链路
- [x] 6.1 更新 `tests/seeds/empire.yaml`、`tests/seeds/logic-flow.yaml` 为新 `module id` 语义。
- [x] 6.2 更新 `scripts/db_fixture.tsx` 生成版本：Empire=3、Flow=2。
- [x] 6.3 重生成 fixture 并确认新产物字段与版本符合规则。

## 7. 构建验证
- [x] 7.1 执行 `npm run build` 并修复新增编译问题。
