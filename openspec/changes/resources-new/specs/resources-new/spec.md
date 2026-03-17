# Resources New Specification

## Purpose
定义地图资源数据处理在 `9.0+` 版本切换到 `resourceareas` 模型后的输出约束、兼容策略与 `maps.json` 摘要行为。

## ADDED Requirements

### Requirement: Version-Gated Map Resource Model
系统 MUST 在数据处理脚本内按当前游戏版本号选择地图资源模型。

#### Scenario: 9.0 以下使用旧模型
- **前提** 当前处理的游戏版本主版本号小于 `9`
- **当** 脚本生成地图资源相关 JSON
- **那么** 系统 SHALL 使用旧版 `regions` 资源模型
- **并且** 系统 SHALL 继续生成 `regions.json`
- **并且** 系统 SHALL 继续生成旧语义的 `regionyields.json`

#### Scenario: 9.0 及以上使用新模型
- **前提** 当前处理的游戏版本主版本号大于等于 `9`
- **当** 脚本生成地图资源相关 JSON
- **那么** 系统 SHALL 使用新版 `resourceareas` 资源模型
- **并且** 系统 SHALL 停止生成 `regions.json`
- **并且** 系统 SHALL 生成 `resourceareas.json`

### Requirement: Resourceareas Output Structure
系统 MUST 在 `9.0+` 输出统一的 `resourceareas.json`，同时包含 sector 资源区引用与资源区模板定义。

#### Scenario: 输出 sector resourceareas 引用
- **前提** 当前处理的游戏版本主版本号大于等于 `9`
- **当** 系统解析 `mapdefaults_final.xml`
- **那么** 系统 SHALL 读取各 sector 下的 `<resourceareas>/<resourcearea>`
- **并且** 系统 SHALL 为每个条目输出 `ref` 与 `amount`
- **并且** 系统 SHALL 按 `sector macro` 建立索引

#### Scenario: 输出 resourcearea definitions
- **前提** 当前处理的游戏版本主版本号大于等于 `9`
- **当** 系统解析 `regionyields_final.xml`
- **那么** 系统 SHALL 读取各 `definition` 节点
- **并且** 系统 SHALL 输出 `id`、`ware`、`tag`、`yield`、`respawnDelay`、`rating`
- **并且** 系统 SHALL 输出 `radius`
- **并且** 系统 SHALL 输出 `objectyieldfactor` 或 `gatherspeedfactor`

#### Scenario: definitions 包含派生字段
- **前提** 当前处理的游戏版本主版本号大于等于 `9`
- **当** 系统构建 `resourceareas.json` 中的 definition 数据
- **那么** 系统 SHALL 派生 `size`
- **并且** 系统 SHALL 派生 `sustainableYieldPerHour`

### Requirement: Regionyields Compatibility Placeholder
系统 MUST 在 `9.0+` 保留 `regionyields.json` 文件，但其内容 MUST 为兼容占位空数组。

#### Scenario: 9.0 及以上输出空数组
- **前提** 当前处理的游戏版本主版本号大于等于 `9`
- **当** 系统写入 `regionyields.json`
- **那么** 文件内容 SHALL 为 `[]`
- **并且** 该文件 SHALL NOT 承载新版资源区定义语义

### Requirement: Maps Sector Resource Summary Compatibility
系统 MUST 在 `9.0+` 继续为 `maps.json` 输出可被现有地图资源界面消费的 `sector.resources` 摘要。

#### Scenario: 由 resourceareas 聚合 sector.resources
- **前提** 当前处理的游戏版本主版本号大于等于 `9`
- **当** 系统构建 `maps.json`
- **那么** 系统 SHALL 根据 `sectorResourceAreas` 与 `definitions` 聚合每个 sector 的资源摘要
- **并且** 摘要 SHALL 至少包含 `ware`、`yield` 与 `level`

#### Scenario: 同一资源多球体时保留最高 yield 等级
- **前提** 某个 sector 下同一 `ware` 存在多个 `resourcearea` 引用
- **当** 系统聚合 `sector.resources`
- **那么** 系统 SHALL 使用该 `ware` 中最高的 `tag` 作为摘要 `yield`
- **并且** 系统 SHALL 输出与该 `yield` 对应的 `level`

### Requirement: 8.0 Regions.json Resources Array Enhancement
系统 MUST 在 8.0 版本的 `regions.json` 中为 `resources` 数组的每个资源项添加更多字段信息。

#### Scenario: 为 resources 添加 yield_name 字段
- **前提** 当前处理的游戏版本主版本号小于 `9`（8.0 版本）
- **当** 系统解析 `region_definitions_final.xml` 的 region 节点
- **那么** 系统 SHALL 读取 `<resources>/<resource>` 节点的 `yield` 属性
- **并且** 系统 SHALL 在输出的 `resources` 数组中为每个资源项添加 `yield_name` 字段

#### Scenario: 为 resources 添加 resourcedensity 字段
- **前提** 当前处理的游戏版本主版本号小于 `9`（8.0 版本）
- **当** 系统解析 `regionyields_final.xml`
- **那么** 系统 SHALL 根据 `ware` 和 `yield_name` 查找对应的 `resourcedensity`
- **并且** 系统 SHALL 在输出的 `resources` 数组中为每个资源项添加 `resourcedensity` 字段

#### Scenario: resources 数组完整字段结构
- **前提** 当前处理的游戏版本主版本号小于 `9`（8.0 版本）
- **当** 系统输出 `regions.json` 的 `resources` 数组
- **那么** 每个资源项 SHALL 包含以下字段：
  - `ware` - 资源类型
  - `yield` - 总产量（整数）
  - `delay` - 回复时间（分钟）
  - `respawn` - 总回复量（整数）
  - `density` - 单位密度（resources/km³）
  - `respawn_density` - 单位回复密度（resources/km³/hour）
  - `factor` - 修正因子（默认 1.0）
  - `yield_name` - Yield 等级名称（新增）
  - `resourcedensity` - 基础资源密度（新增）

### Requirement: 8.0 Regions.json Field Arrays Enhancement
系统 MUST 在 8.0 版本的 `regions.json` 中为每个 region 添加原始 field 数据数组。

#### Scenario: 添加 asteroids 数组
- **前提** 当前处理的游戏版本主版本号小于 `9`（8.0 版本）
- **当** 系统解析 `region_definitions_final.xml` 的 region 节点
- **那么** 系统 SHALL 读取 `<fields><asteroid .../>` 节点
- **并且** 系统 SHALL 根据 `groupref` 查找对应的 asteroid group 定义
- **并且** 系统 SHALL 在输出中添加 `asteroids` 数组
- **并且** 每个 asteroid 项 SHALL 包含以下字段：
  - `groupref` - 引用的 asteroid group ID
  - `resource` - 该 asteroid 产出的 ware（从 group 解析）
  - `yield` - 基础产量（从 group 解析）
  - `densityfactor` - 密度修正因子
  - `minnoisevalue` - 噪声最小值
  - `maxnoisevalue` - 噪声最大值
  - `resourcepercentage` - 资源百分比

#### Scenario: 添加 debris 数组
- **前提** 当前处理的游戏版本主版本号小于 `9`（8.0 版本）
- **当** 系统解析 `region_definitions_final.xml` 的 region 节点
- **那么** 系统 SHALL 读取 `<fields><debris .../>` 节点
- **并且** 系统 SHALL 根据 `groupref` 查找对应的 debris group 定义
- **并且** 系统 SHALL 在输出中添加 `debris` 数组
- **并且** 每个 debris 项 SHALL 包含以下字段：
  - `groupref` - 引用的 debris group ID
  - `resource` - 该 debris 产出的 ware（从 group 解析）
  - `yield` - 基础产量（从 group 解析）
  - `densityfactor` - 密度修正因子
  - `minnoisevalue` - 噪声最小值
  - `maxnoisevalue` - 噪声最大值
  - `resourcepercentage` - 资源百分比

#### Scenario: 添加 nebulae 数组
- **前提** 当前处理的游戏版本主版本号小于 `9`（8.0 版本）
- **当** 系统解析 `region_definitions_final.xml` 的 region 节点
- **那么** 系统 SHALL 读取 `<fields><nebula resources="..."/>` 节点
- **并且** 系统 SHALL 在输出中添加 `nebulae` 数组
- **并且** 每个 nebula 项 SHALL 包含以下字段：
  - `resources` - 气体资源 ware 列表（数组，解析逗号分隔的 resources 属性）
