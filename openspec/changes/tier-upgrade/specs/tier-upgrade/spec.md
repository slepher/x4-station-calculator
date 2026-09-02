# Tier Upgrade Specification

## ADDED Requirements

### Requirement: Production Network Tier Membership

系统 SHALL 仅根据 Ware 生产配方及其输入引用关系判定 Tier。具有配方或被配方引用的 Ware SHALL 参与 Tier 排行；其他商品 SHALL 使用 `tier: null` 表示不属于生产网络。

#### Scenario: Referenced raw ware becomes T0

**前提** 一个 Ware 没有自身生产配方，但被另一个 Ware 的生产配方引用为输入  
**当** 生成 Tier 数据  
**那么** 该 Ware 的 Tier SHALL 为 0  
**并且** 该 Ware SHALL 参与生产网络

#### Scenario: Unreferenced ware remains unranked

**前提** 一个正式商品没有生产配方，也未被任何生产配方引用  
**当** 生成 Tier 数据  
**那么** 该商品 SHALL 保留在 `wares.json`  
**并且** 其 `tier` SHALL 为 null  
**并且** 该商品 SHALL NOT 进入 T0 集合或 `res.json`

#### Scenario: Transmutable does not alter tier

**前提** 一个 Ware 带有 `transmutable` tag  
**当** 计算其 Tier  
**那么** 系统 SHALL 只依据配方依赖计算 Tier  
**并且** SHALL NOT 因 `transmutable` tag 增加或改变 Tier

#### Scenario: Khaak chain tiers are dependency-derived

**前提** 当前游戏数据包含 `rawkhaakscrap → khaakscrapmetal → khaakalloy` 配方链  
**当** 生成 Tier 数据  
**那么** `rawkhaakscrap` SHALL 为 T0  
**并且** `khaakscrapmetal` SHALL 为 T1  
**并且** `khaakalloy` SHALL 为 T2

### Requirement: Transmutable Ware Metadata

每个导出的 Ware SHALL 包含必填 boolean 字段 `transmutable`，其值 SHALL 来自原始 Ware tags。本次变更 SHALL NOT 基于该字段执行材料替代。

#### Scenario: Tagged ware exports true

**前提** 原始 Ware tags 包含独立 tag `transmutable`  
**当** 生成 `wares.json`  
**那么** 对应条目的 `transmutable` SHALL 为 true

#### Scenario: Untagged ware exports false

**前提** 原始 Ware tags 不包含 `transmutable`  
**当** 生成 `wares.json`  
**那么** 对应条目的 `transmutable` SHALL 为 false

### Requirement: Explicit Temporary Ware Exclusion

系统 SHALL 在应用层 Ware 导出边界排除 ID 为 `nividiumgems` 的临时商品，同时保留原始资产和内部解析数据。

#### Scenario: Temporary nividium gems is not exported

**前提** 原始游戏数据包含 ID 为 `nividiumgems`、名称为 `(TEMP)nividiumgems` 的 Ware  
**当** 生成应用静态数据  
**那么** `wares.json` SHALL NOT 包含该 ID  
**并且** 原始 XML、ware 索引和 recipe 解析 SHALL 保持可用

#### Scenario: Exclusion is not inferred from display fields

**前提** 其他 Ware 具有空 group 或名称包含临时文本  
**当** 生成应用静态数据  
**那么** 系统 SHALL NOT 仅凭名称前缀或空 group 排除该 Ware

### Requirement: Alternating Queue Hourly Rates

系统 SHALL 保留模块的聚合 `outputs` 与 `inputs`，并按一次完整 queue 序列的总耗时计算多 queue item 模块的基础小时率。

#### Scenario: Equal-duration queue items split duty time

**前提** 一个模块包含两个各 300 秒的 queue item  
**当** 生成模块小时率  
**那么** 每个 item SHALL 在 600 秒完整序列中执行一次  
**并且** 每个 item 的产出和输入 SHALL 等于其独立连续小时率的 50%  
**并且** SHALL NOT 将两个 item 的完整连续小时率直接相加

#### Scenario: Standard recycler rates

**前提** 生成标准 Scrap Recycler 数据  
**当** 应用默认交替序列  
**那么** outputs SHALL 包含 `hullparts: 1200` 与 `claytronics: 360`  
**并且** inputs SHALL 包含 `energycells: 93000` 与 `scrapmetal: 2250`

#### Scenario: Current Terran recycler rates

**前提** 当前原始数据中的 Terran Scrap Recycler 交替执行 300 秒 Computronic Substrate 配方与 300 秒 Silicon Carbide 配方  
**当** 生成模块数据  
**那么** outputs SHALL 包含 `computronicsubstrate: 300` 与 `siliconcarbide: 360`  
**并且** inputs SHALL 包含 `energycells: 99000` 与 `scrapmetal: 7500`

#### Scenario: Single queue item remains unchanged

**前提** 一个生产模块只有一个 queue item  
**当** 生成模块小时率  
**那么** 系统 SHALL 使用该配方自身周期换算小时率  
**并且** SHALL NOT 因交替规则额外折半

### Requirement: Cross-Environment Production Data Consistency

Logic Flow、Station 与 BuildPlan SHALL 通过当前游戏版本的 `modulesMap` 消费同一份聚合模块小时率，不在用户存档中复制 recipe 数据。

#### Scenario: Logic flow module imported into station

**前提** Logic Flow 方案包含一个多产物回收模块  
**当** 该组导入 Station  
**那么** Station SHALL 通过 module ID 解析当前版本模块  
**并且** SHALL 使用该模块的全部聚合 outputs/inputs  
**并且** SHALL NOT 再次按 `cycleTime` 换算小时率

#### Scenario: Logic flow module consumed by build plan

**前提** BuildPlan 从 Logic Flow 获取一个多产物回收模块  
**当** 计算净生产流  
**那么** BuildPlan SHALL 使用与 Station 相同的聚合 outputs/inputs  
**并且** SHALL NOT 依赖持久化 recipe 快照

### Requirement: Logic Flow Excludes Unranked Wares

Logic Flow SHALL 只为具有数值 Tier 的 Ware 创建候选、预览、手动节点或自动上游节点。

#### Scenario: Unranked ware is absent from candidates

**前提** `waresMap` 中存在 `tier: null` 的孤立商品  
**当** 构建 Logic Flow 候选集合  
**那么** 候选集合 SHALL NOT 包含该商品  
**并且** 该商品 SHALL NOT 被解释为 T0

#### Scenario: Missing historical ware is skipped safely

**前提** 已保存的 Logic Flow 节点引用当前版本 `waresMap` 中不存在的 Ware  
**当** 恢复方案  
**那么** 系统 SHALL 跳过该节点并记录 warning  
**并且** SHALL 继续恢复其余有效节点

### Requirement: Static Data Regeneration Without Save Migration

系统 SHALL 通过现有数据处理器重新生成受支持版本的静态游戏数据，且 SHALL NOT 修改用户存档 schema 或 storage version。

#### Scenario: All supported versions are regenerated

**前提** 数据处理器已包含新的 Tier、Ware 和 queue 规则  
**当** 执行全版本生成  
**那么** 8.0 Diplomacy 与 9.0 Empire SHALL 都获得一致的数据结构和语义

#### Scenario: Existing persisted module references remain valid

**前提** 用户存档只保存 module ID 和数量  
**当** 应用加载重新生成的静态数据  
**那么** 现有引用 SHALL 通过当前版本 `modulesMap` 解析  
**并且** empire、flow 与 build-plan storage version SHALL 保持不变
