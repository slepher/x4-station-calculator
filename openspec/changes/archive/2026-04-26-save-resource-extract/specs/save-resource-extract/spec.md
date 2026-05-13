# Save Resource Extract Specification

## Purpose

为 `src/utils/saveResourceExtract.ts` 与 `scripts/extract_resources.tsx` 定义与当前需求一致的提取与校验聚合规则，使其文档能够作为后续实现与验证的单一依据。

## ADDED Requirements

### Requirement: Implement As TypeScript Utility And Tsx CLI

实现 SHALL 将核心逻辑放在 `src/utils/` 下的 TypeScript 模块，并提供 `scripts/` 下的 `tsx` 命令行入口。

#### Scenario: Place Core Logic In Src Utils

**前提** 资源提取与聚合逻辑需要可复用
**当** 实现落地
**那么** 核心逻辑 MUST 位于 `src/utils/saveResourceExtract.ts`

#### Scenario: Place Command Entry In Scripts

**前提** 需要提供命令行工具
**当** 实现落地
**那么** 命令行入口 MUST 位于 `scripts/extract_resources.tsx`

### Requirement: Read 8.0 Assets Only

实现 SHALL 固定读取 `src/assets/x4_game_data/8.0-Diplomacy/` 下的资源资产。

#### Scenario: Resolve Static Assets From 8.0 Directory

**前提** 命令行工具执行资源提取或聚合
**当** 实现加载 maps、region yields、resource areas、regions 数据
**那么** MUST 从 `8.0-Diplomacy` 目录读取
**并且** MUST NOT 做其他版本的动态切换

### Requirement: Extract Save Resource Points

脚本 SHALL 从实际存档中提取指定 sector 的资源点，并保留 `ware + yield_name + 坐标 + max + time` 粒度。

#### Scenario: Extract Single Yield Resource Point

**前提** 存档 sector 中某个 `area` 下存在单个 `ware` 和单个 `yield_name`
**当** 脚本执行 sector 资源提取
**那么** 输出 MUST 包含该点的 `x/y/z`、`ware`、`max`、`time`、`yield_name`

#### Scenario: Expand Multi Yield Resource Point

**前提** 存档 sector 中某个资源点对同一 `ware` 包含多个 `<yield>`
**当** 脚本执行 sector 资源提取
**那么** 输出 MUST 将该点展开为多条记录
**并且** 每条记录只保留一个 `yield_name`

### Requirement: Preserve Sector Extraction JSON

脚本 SHALL 将单个 sector 的提取结果保存为中间 JSON，并继续采用 `ware -> yield_name -> resources[]` 结构。

#### Scenario: Save Sector Extraction Result

**前提** sector 提取结果已生成
**当** 脚本写入 sector JSON
**那么** JSON MUST 包含 `sector_id`
**并且** `ware` 层 MUST 以 `yield_name` 为子键
**并且** `resources[]` 中 MUST 保留 `x/y/z/max/time`

### Requirement: Map Resource Points To Candidate Regions

脚本 SHALL 在聚合阶段基于 `resourceareas.json` 与 `regions.json` 将资源点尽最大努力映射到 region。

#### Scenario: Match Region By Attribute And Space

**前提** 某个资源点存在 `ware`、`yield_name` 和坐标
**并且** `resourceareas.json` 中存在一个 region 候选
**并且** `regions.json` 可提供该候选的边界几何信息
**当** 以该点为中心的 `64km x 64km x 64km` 方块与该 region 范围发生重叠
**并且** 若该 region 为 `cylinder`，则其 `position.y` 按底边 `y` 解释，竖向范围为 `[position.y, position.y + linear]`
**那么** 该点 MUST 视为命中该 region

#### Scenario: Resolve To Single Region

**前提** 某个资源点存在多个 region 候选
**当** 只有一个候选 region 同时满足属性和空间匹配
**那么** 该点 MUST 仅归入该 region

#### Scenario: Keep Overlapping Region Matches

**前提** 某个资源点同时命中多个 region
**并且** 这些命中在空间判定上都成立
**当** 脚本执行聚合
**那么** 该点 MUST 同时归入多个 region
**并且** MUST NOT 做排他选择或均分

### Requirement: Collapse Overlapping Regions Into Sector Components

脚本 SHALL 在每个 sector 内先根据 region 的重叠关系构建 connected components，并按 component 聚合。

#### Scenario: Merge Overlapping Regions Into One Bucket

**前提** 某个 sector 中 region `A` 与 `B` 彼此重叠
**当** 脚本构建该 sector 的聚合桶
**那么** `A` 与 `B` MUST 合并为同一个 bucket
**并且** MUST NOT 再单独输出 `A` 或 `B` 的独立桶

#### Scenario: Assign Point To Overlap Component

**前提** 某个资源点命中 region `A`
**并且** `A` 属于该 sector 的重叠组 `A+B`
**当** 脚本执行聚合
**那么** 该点 MUST 归入 `A+B` 对应的 bucket

#### Scenario: Use Empty Bucket For Unmatched Points

**前提** 某个资源点未命中任何 region
**当** 脚本执行聚合
**那么** 该点 MUST 归入 `regions = [{ ref: \"\" }]` 的 bucket

### Requirement: Produce Validation Total Json

脚本 SHALL 输出用于理论值校验的 `total.json`，按 `sector -> ware` 汇总，并在 ware 下保留重叠组 bucket 列表。

#### Scenario: Output Ware Summary With Region References

**前提** 某个 sector 的资源点已完成 region 映射
**当** 脚本写入 `total.json`
**那么** 每个 `ware` 节点 MUST 输出为 bucket 数组
**并且** 每个 bucket MUST 包含 `max`
**并且** 每个 bucket MUST 包含 `regions[]`
**并且** 每个 region 项 MUST 至少包含 `ref`
**并且** `time` MUST NOT 出现在 `total.json` 中

#### Scenario: Do Not Emit Ware Level Total Max

**前提** 某个 `ware` 在同一个 sector 内存在多个重叠组 bucket
**当** 脚本写入 `total.json`
**那么** MUST NOT 再额外输出跨所有 bucket 的 ware 总 `max`
