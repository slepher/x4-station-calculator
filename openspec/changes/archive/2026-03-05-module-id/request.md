# module-id 需求说明

## 目标
将模块主键从宏标识（macro id）切换为 wares.xml 的模块商品 ID（module id），并在模块数据中保留 `macroId` 作为兼容映射字段。
同时保证 Empire、Logic Flow、Import/Export、x-game/XML 导入链路都能按导入数据版本动态迁移到当前最新版本。

## 已确认方案（审核重点）
1. 模块数据模型
- `X4Module.id` 改为 wares.xml 的模块商品 ID（module id）。
- `X4Module` 新增 `macroId` 字段保存原宏 ID。
- 业务存储（Empire/Logic Flow）仅保存 `moduleId`，不再持久化旧宏 ID。

2. 版本基线与迁移目标
- Empire 当前最新版本定义为 `v3`。
- Logic Flow 当前最新版本定义为 `v2`。
- 导入时不得写死版本，不得假设导入包已是最新版本。
- 必须依据导入 JSON 的 `version` 动态迁移到当前最新版本后再落库。

3. Empire 迁移规则（v2 -> v3）
- 将站点 `modules[].id` 从旧宏 ID 映射为新 module id。
- 迁移过程中若出现无法映射项，按约定策略处理（跳过并告警，不中断其他可迁移数据）。
- 覆盖导入与增量导入都必须先执行迁移再执行后续策略。

4. Logic Flow 迁移规则（v1 -> v2）
- 将节点 `moduleId` 从旧宏 ID 映射为新 module id。
- `wareId`、分组结构、activeId 语义保持不变。
- 迁移失败的孤立节点按约定策略处理并产生 warning。

5. Import/Export 规则
- Import：按模块版本动态迁移到最新版本。
- Export：导出当前最新版本（Empire=3、Flow=2），不导出旧版本。
- `coerce` 只做结构兜底，不做版本回退或硬编码覆盖。

6. x-game/XML 导入规则
- 导入解析阶段需要同时支持：
  - 旧宏 ID 输入
  - 新 module id 输入
  - 可识别的中间别名（如 `module_xxx`）
- 统一解析为当前 `moduleId` 入库。
- 解析映射优先级与 warning 规则需要稳定且可测试。

7. seed/fixture 策略
- `tests/fixtures/db.json` 作为旧版本留存样本可继续保留。
- 需修改 seed 生成脚本，使新生成 seed/fixture 产物符合最新版本与新 `moduleId` 语义。

## 边界
### In Scope
- 模块类型定义与游戏数据生成：`src/types/x4.ts`、`scripts/x4_data_processor.py`、`src/assets/**/modules.json`
- Empire/Logic Flow 存储迁移：`src/store/useEmpireStore.ts`、`src/store/useLogicFlowStore.ts`
- 导入导出迁移管线：`src/store/logic/importExport.ts`
- x-game/XML 导入解析：`src/store/logic/blueprintParser.ts`、`src/components/ImportPlanModal.vue`、`src/store/useStationStore.ts`
- seed 与 fixture 生成链路：`tests/seeds/*.yaml`、`scripts/db_fixture.tsx`

### Out of Scope
- Ship Build 存储版本升级（本次仅要求保持兼容，不升级版本）
- 与 module id 迁移无关的 UI 视觉改造
- 无关业务算法调整（如产能计算公式）

## 验收标准（DoD）
1. 游戏模块数据中 `X4Module.id` 为 module id，且存在 `macroId` 字段。
2. Empire 导入与本地加载可将 v2 数据迁移到 v3，并保证站点模块 ID 可在当前模块表命中。
3. Logic Flow 导入与本地加载可将 v1 数据迁移到 v2，并保证节点 `moduleId` 可命中当前模块表。
4. Import 流程根据导入包版本动态迁移到最新版本；Export 始终导出最新版本（Empire=3、Flow=2）。
5. x-game/XML 输入无论给 macro id 还是 module id，最终都以 module id 入库。
6. `x4-import-move` 与 `import-export` 相关测试可覆盖版本迁移和 ID 归一化行为。
7. seed 重生后生成数据与最新版本规则一致。

## 未决项
无
