# module-id 设计说明

## Context
当前代码中模块主键、存储版本与导入迁移存在三类不一致：
1. 模块主键仍以 macro id 为核心。
2. Empire/Flow 的版本处理在多个位置被硬编码为旧版本。
3. x-game/XML/JSON 三类导入链路没有统一的“先归一 ID、再按版本迁移”的执行顺序。

本次设计目标是建立统一迁移管线：
- 先做输入归一（ID 与结构）
- 再做版本迁移（按导入版本动态升级）
- 最后按覆盖/增量策略落库与刷新

## Decisions

### 1. 统一模块身份模型
- `X4Module.id` 改为 `module id`。
- 新增 `X4Module.macroId` 用于兼容解析。
- `modulesMap` 主键切换到 `module id`。
- 增加辅助索引：
  - `modulesByMacroId: Record<string, X4Module>`
  - 可选 `modulesByWareAlias`（用于 `module_xxx` 等别名兼容）

### 2. 存储最新版本常量化
- 定义并集中使用：
  - `CURRENT_EMPIRE_VERSION = 3`
  - `CURRENT_FLOW_VERSION = 2`
- 禁止在 `coerce/remap/merge/export` 内写死旧版本字面量。

### 3. 导入迁移分层
- `coerce*`：仅负责结构容错与默认字段填充，保留原始 `version`。
- `migrate*`：根据 `input.version` 逐级迁移到最新版本。
- `apply*`：按覆盖/增量写入并执行 active 处理。

### 4. 逐级迁移策略
- Empire:
  - `v1 -> v2` 复用既有语义。
  - `v2 -> v3` 执行 `modules[].id: macro -> module` 归一。
- Flow:
  - `v1 -> v2` 执行 `nodes[].moduleId: macro -> module` 归一。
- 每一级迁移函数保持纯函数，便于单测与回归定位。

### 5. 导入解析统一器
- 对 XML/x4-game 输入统一走 `resolveModuleId`。
- 解析优先顺序：
  1) 命中 `module id`
  2) 命中 `macroId`
  3) 命中可识别别名（如 `module_xxx`）
  4) `wareId` 兜底
- 解析失败项仅告警并跳过，不阻断可解析项。

### 6. Export 版本策略
- 导出前先确保内存态已是最新版本结构。
- 导出 payload 直接携带最新版本（Empire=3、Flow=2）。

## Data Migration Details

### Empire v2 -> v3
- 输入：站点 `modules: [{ id: <macro-or-module>, count }]`
- 输出：站点 `modules: [{ id: <moduleId>, count }]`
- 对未命中映射的模块：
  - 丢弃该模块条目
  - 记录 warning（包含原始 id 与 station 上下文）

### Flow v1 -> v2
- 输入：节点 `moduleId?: <macro-or-module>`
- 输出：若存在 `moduleId`，则归一到 `<moduleId>`
- 未命中映射：
  - 清空该节点 `moduleId`
  - 保留 `wareId` 与节点结构
  - 记录 warning

## Error Handling
1. 结构非法：模块级导入失败并返回错误，不污染其他模块。
2. 版本未知：进入 fallback 迁移器，尽最大努力归一并返回 warning。
3. ID 解析失败：按条目跳过并汇总 warning。

## Impacted Areas
- 类型与游戏数据：`src/types/x4.ts`、`scripts/x4_data_processor.py`、`src/store/logic/useGameData.ts`
- 存储与迁移：`src/store/useEmpireStore.ts`、`src/store/useLogicFlowStore.ts`、`src/store/logic/importExport.ts`
- 导入解析：`src/store/logic/blueprintParser.ts`、`src/components/ImportPlanModal.vue`、`src/store/useStationStore.ts`
- seed 生成：`scripts/db_fixture.tsx`、`tests/seeds/*.yaml`

## Non-Goals
1. 不重构 Ship Build 版本体系。
2. 不改动与模块 ID 无关的业务算法。
3. 不在本次引入远程迁移服务或在线 schema registry。
