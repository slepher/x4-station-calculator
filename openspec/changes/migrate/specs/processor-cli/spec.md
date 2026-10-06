# Processor CLI Specification

## Purpose

定义 Python processor 迁移后的统一 TypeScript 执行入口、产物兼容、资源状态及切换验收行为。

## ADDED Requirements

### Requirement: Unified TypeScript execution

系统 SHALL 提供 `npm run process -- <data|map|resources> [options]`，最终三个任务及其运行时依赖 MUST 全部使用 TypeScript/Node 执行。

#### Scenario: Full data processing

- **当** 用户运行 `data` 任务
- **那么** 系统执行现有基础数据完整流水线，包括 factions、地图、语言、terraforming、research、blueprints 及后续名称注入和导出
- **并且** 不自动执行独立资源计算任务。

#### Scenario: Independent tasks

- **当** 用户运行 `map` 或 `resources` 任务
- **那么** 系统仅执行对应业务及必要依赖
- **并且** 不需要 Python 或依赖 Python 子进程。

### Requirement: Explicit version selection

系统 SHALL 从 `x4-station-calculator.config.json` 选择版本，并在所有任务中应用同一规则。`--version` 与 `--all-versions` MUST 互斥，`--beta` 与 `--stable` MUST 互斥。全版本运行 SHALL 按配置顺序串行处理所有版本项，不使用 flavor 选项隐式过滤列表。

#### Scenario: Configured default

- **前提** 用户没有指定版本或 flavor
- **当** 任一任务启动
- **那么** 选择配置中的 `current_version` 及 `beta` 对应项
- **并且** resources 不再固定默认 8.0。

#### Scenario: Explicit flavor and ambiguous version

- **前提** 某版本存在多个 flavor 候选
- **当** 用户仅指定版本号
- **那么** 系统报错并要求显式选择 `--beta` 或 `--stable`
- **并且** 显式选择后仅运行匹配项；未指定版本时 flavor 作用于配置中的当前版本。

#### Scenario: Missing or conflicting selection

- **当** 参数互斥规则被违反、配置缺少 versions 或找不到指定版本/flavor
- **那么** 任务返回非零退出码及可定位错误，不转而选择其他版本。

#### Scenario: Sequential versions

- **当** 用户运行 `--all-versions`
- **那么** 各版本分别初始化配置、数据索引与语言状态，按配置顺序串行运行
- **并且** 后一个版本结果不包含前一个版本独有数据，失败时停止后续版本并返回非零退出码。

### Requirement: Observable command contract

系统 SHALL 提供帮助信息、版本和阶段进度、输出摘要及统一失败规则；已接受的路径覆盖选项 MUST 在对应任务生效。

#### Scenario: Help and path overrides

- **当** 用户查看帮助或指定地图/资源输入输出路径
- **那么** 帮助列明可用选项、默认版本规则和资源模型适用范围
- **并且** 对应任务使用指定路径，不忽略选项或写入默认正式目录。

#### Scenario: Isolated output directory

- **当** 用户指定 `--output-dir`
- **那么** 产物写入指定根目录，保留 `data/`、`locales/` 布局，单文件覆盖优先
- **并且** resources 未指定输出根目录时由 `maps-json` 所在目录确定输出。

#### Scenario: Invalid invocation or missing input

- **当** 用户指定未知任务、未知选项、缺少选项值，或必要文件不存在/无法解析
- **那么** 系统返回非零退出码，指出任务及相关参数/路径
- **并且** 不打印完成成功摘要，不以空结果或其他输入掩盖失败。

### Requirement: Compatible generated artifacts

系统 SHALL 保持现有输出文件清单、JSON schema、业务值、数组顺序、语言引用、DLC 顺序与业务修正，允许 JSON 排版及对象 key 顺序不同。

#### Scenario: Equivalent input comparison

- **前提** Python 与 TS 使用相同原始数据、存档样例和等价缓存初始状态
- **当** 比较基础数据、地图和资源产物
- **那么** 文件集合、字段存在性、null、值类型和数组顺序一致
- **并且** 整数结果一致，浮点差异逐项定位；仅经确认的不可避免差异允许字段局部容差。

#### Scenario: Numeric semantics

- **当** 输入涉及半整数、负数截断、float32 中间步骤、噪声或边界采样
- **那么** TS 保留 Python 业务计算语义，并通过针对性 Unit 与产物对照验证。

### Requirement: Map and resource output separation

系统 MUST 保持 `maps.json` 为纯地图结构；资源任务 SHALL 写入既有资源副文件与明细/缓存，不得回写地图文件。

#### Scenario: Resource processing leaves map unchanged

- **前提** 已生成某版本 `maps.json`
- **当** 执行 resources 的全量或单星区处理
- **那么** 地图文件字节内容不变
- **并且** `map_resources.json` 及该模型所需产物按既有契约更新。

### Requirement: Resource model and incremental state fidelity

系统 SHALL 保留 8.0 `regions` 与 9.0+ `resourceareas` 的现有分支语义，包括模型适用的逐格缓存和存档参与计算规则。

#### Scenario: Cold, warm and partial cache

- **前提** 8.0 逐格缓存为空、完整或仅缺部分星区
- **当** 用户执行常规资源任务
- **那么** 分别计算全部、复用已有缓存或仅补算缺失星区
- **并且** 输出与对应 Python 基线一致，不误用其他版本的缓存。

#### Scenario: Version cache and damaged cache

- **当** 用户未指定 `--blocks-cache`
- **那么** 逐格缓存使用 `analysis/resources/<folder_name>/resourcearea_blocks.json`，不自动读取旧无版本缓存
- **并且** 默认缓存缺失按冷缓存处理；损坏时报错，可显式强制重算恢复。

#### Scenario: Calculation failure preserves previous output

- **前提** 已有资源产物与缓存
- **当** 新一轮增量计算或合并失败
- **那么** 原产物及缓存不被计算中的部分结果覆盖。

#### Scenario: Targeted update and forced recalculation

- **当** 用户指定 `--sector` 或 `--force-recalc-per-block`
- **那么** 按既有业务规则更新目标范围，强制重算时不复用目标范围缓存
- **并且** 非目标星区及其缓存被保留，模型不支持的选项明确报错，不静默忽略。

#### Scenario: Save sample input

- **前提** 模型支持存档数据参与资源计算
- **当** 使用有存档与无存档两种输入运行
- **那么** 两种结果分别符合 Python 原有储量、刷新率及 rating 规则
- **并且** 显式指定但不存在的目录报错；默认存档目录缺失时保留现有无存档计算行为。

### Requirement: Isolated validation and controlled cutover

系统 SHALL 在独立目录中生成 Python/TS 对照产物与缓存，迁移验证不得覆盖正式资产。Python 清理 MUST 在用户验证通过后执行。

#### Scenario: Baseline validation

- **当** 执行对照检查
- **那么** 分别保存两套产物和缓存，报告缺失/多出文件及结构/数值差异
- **并且** 输入不齐时报告无法完成的验收范围，不以现有产物冒充重跑基线。

#### Scenario: Final cutover

- **前提** 相关 Unit、类型检查、构建和完整 TS 运行通过，用户验证通过
- **当** 清理已替代的 Python 实现
- **那么** 统一命令及文档保持可用，运行链路没有 Python 调用
- **并且** 范围外脚本仍需要的共享实现被保留。
