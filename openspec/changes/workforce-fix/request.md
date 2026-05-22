# Workforce Fix

## 目标

修正当前 production wareflow 对工人食物/医疗消耗的计算口径，使其符合 X4 `wares.xml` 中 `workunit_idle` 与 `workunit_busy` 的双档定义。

本次变更同时澄清 live 存档数据中的 `workforces` 语义，避免把全部居民统一按 busy 消耗计算，导致 food / medical / race-specific food 的需求被高估。

## 已确认方案（审核重点）

### XML 提取口径

- 当前 `scripts/x4_data_processor.py` 只提取 `workunit_busy`，这会让运行时只有一套 busy 消耗表。
- 新方案必须同时提取：
  - `workunit_idle`
  - `workunit_busy`
- 提取结果必须保留种族方法（`default` / `paranid` / `teladi` / `split` / `terran` / `boron`）与各 ware 的消耗映射。
- 提取后的数值统一保存为“每人每小时消耗量”。
- 现有类型/注释中若仍沿用“每秒”或其他旧口径，必须同步修正，避免数据语义继续误导计算层。

### 运行时消耗模型

- 运行时不得再把所有工人统一按 busy 消耗计算。
- 新方案必须显式区分：
  - `busyWorkers`
  - `idleWorkers`
- 总消耗 = `busyWorkers * busyRate + idleWorkers * idleRate`。
- `busyWorkers` 的定义必须与“参与生产效率计算的人口”一致。
- `idleWorkers` 的定义必须是“已居住但未参与生产效率的人口”。

### live / archive 路径语义

- 对于 live / archive 路径，`station.workforces` 表示站上真实居民分布，不应直接等价为全部 busy 人口。
- live 计算必须基于：
  - `totalResidents = sum(workforces.amount)`
  - `neededWorkforce = 当前生产模块需要的人口`
  - `busyWorkers = min(totalResidents, neededWorkforce)`
  - `idleWorkers = max(0, totalResidents - busyWorkers)`
- 若 `workforces` 按 race 提供分布，但未提供“各 race 中谁在工作”，系统应按 race 占总居民的比例分摊 busy / idle。
- race 不存在于消费表时，仍使用 `default` 作为 race key fallback。

### blueprint / planning 路径边界

- 当前 blueprint / planning 路径只有“用于效率计算的实际 workforce”概念，没有“总站内居民总数”事实输入。
- `workforceAuto = true` 时，系统没有独立的总居民输入：
  - 当前参与效率计算的人口按 busy 计算
  - idle 人口视为 0
- `workforceAuto = false` 且用户通过 `settings.manualWorkforce` 手动指定人数时，该值应视为“总站实际居民数”输入。
- `manualWorkforce` 本身不带 race，但系统已经会根据当前 habitation 环境把它拆成各 race 居民数。
- 一旦完成按 race 拆分，后续不得继续走 busy-only 的旧路径，而必须与 `workforceOverride` 使用同一套后处理流程：
  - `totalResidents`
  - `busyWorkers`
  - `idleWorkers`
  - race 级 busy / idle 分摊
- 只有 live / archive 路径，且存在真实 `workforces` 数据时，才计算 idle 人口。
- 本次不新增新的 UI 输入来手工编辑“总居民数”。

### ProductionFlow 与 Contribution 构成

- `productionFlow` 仍保持现有主结构，不为了本次改造新增 contribution 字段数量。
- `workforce` 与 `idle workforce` 的区分，直接通过现有 `FlowContribution.class` 完成。
- 约定：
  - `class: 'workforce'` 表示 busy workforce consumption
  - `class: 'workforce_idle'` 表示 idle workforce consumption
- `FlowContribution.type` 继续保持现有语义：
  - busy workforce 为 `type: 'consumption'`
  - idle workforce 为 `type: 'consumption'`
- 不在 contribution 中额外记录 auto / override 来源，因为两条 workforce 计算路径是互斥的，不会同时进入同一轮计算。
- auto 计算路径下：
  - 只生成 `class: 'workforce'`
  - 不生成 `class: 'workforce_idle'`
- override 路径下：
  - busy 部分生成 `class: 'workforce'`
  - idle 部分生成 `class: 'workforce_idle'`
- manualWorkforce 路径下：
  - 先按 habitation race 拆分为 race population entries
  - 再与 override 路径共用同一套 busy / idle contribution 构造逻辑
  - busy 部分生成 `class: 'workforce'`
  - idle 部分生成 `class: 'workforce_idle'`
- 若 `busyWorkers === 0`，则不得生成任何 `class: 'workforce'` contribution，避免明细出现“0 workers”造成混淆。
- 若 `idleWorkers === 0`，则不得生成任何 `class: 'workforce_idle'` contribution，避免明细出现“0 idle workforce”造成混淆。

### 数据结构与命名

- 现有 `RaceMedicalConsumption` / `medicalConsumptionMap` 命名过窄，已无法准确表达 food + medical + idle/busy 双档结构。
- 新方案应改为更准确的 workforce consumption 命名。
- 变更后数据结构必须同时表达：
  - race
  - state (`idle` / `busy`)
  - wareId -> perPersonPerHour

### 向后兼容与范围控制

- 本次变更只修正工人消耗口径与相关类型/命名，不改动模块产出、模块输入、效率加成规则本身。
- 本次不改 save parser 对 `workforces` 原始字段的解析来源。
- 本次不扩展 transit hub 的 workforce 逻辑。

## 边界

### In Scope

- 修正 XML 提取阶段的 workforce consumption 数据结构
- 修正运行时 live / archive 路径对 `workforces` 的 busy / idle 分摊逻辑
- 修正 blueprint / planning 路径的 workforce consumption 语义说明与实现口径
- 修正相关类型、注释、命名与文档
- 补充覆盖 idle / busy 双档与 live race 分摊的测试需求

### Out of Scope

- 新增手工编辑“总站居民总数”的 UI
- 修改 save 文件解析格式
- 修改模块效率公式
- 编写测试代码或执行测试

## 验收标准（DoD）

1. 数据提取阶段同时产出 idle 与 busy 两套 workforce consumption 数据。
2. 提取结果的单位在类型与注释中明确为“每人每小时”。
3. live / archive 路径存在 `workforces` 时，不再把全部居民都按 busy 计算。
4. live / archive 路径能正确计算 `busyWorkers` 与 `idleWorkers`，并同时计入 wareflow。
5. live / archive 路径中各 race 的 busy / idle 消耗按 race 居民占比进行分摊。
6. `workforceAuto = true` 的 blueprint / planning 路径在没有总居民输入时，不虚构 idle 人口。
7. `manualWorkforce` 路径在按 habitation race 拆分后，与 `workforceOverride` 共用同一套 busy / idle 后处理逻辑。
8. auto 路径下 contribution 只生成 `class: 'workforce'`，不生成 idle contribution。
9. override 与 manualWorkforce 路径下，idle 部分使用 `class: 'workforce_idle'` 表达，且 `idleWorkers === 0` 时不生成该 contribution。
10. `busyWorkers === 0` 时不生成 0 值 busy contribution。
11. food / medical / race-specific food 的 wareflow 在 live 与 manualWorkforce 路径下都能反映 idle + busy 的合计消耗。
12. 相关类型、命名、注释不再把 workforce consumption 误写成 medical-only 或错误时间单位。
13. 变更不影响模块生产输入输出、效率加成与非 workforce wareflow 计算。

## 未决项

- 无。
