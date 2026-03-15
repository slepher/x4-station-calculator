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
