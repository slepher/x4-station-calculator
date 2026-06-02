# Terraforming Binding Specification

## ADDED Requirements

### Requirement: Save Terraforming Runtime Extraction

rust parser SHALL extract terraforming runtime state from raw save XML and expose it on the parsed archive as `terraforming_clusters`.

#### Scenario: locate terraforming by cluster component stack

- **前提** save XML 中 cluster component 位于多层 `connections/connection/component` 嵌套中
- **当** parser 遇到 `component class="cluster"` 时
- **那么** parser SHALL 将该 component 的 `macro` 记录为当前 cluster context
- **并且** parser SHALL 在遇到该 cluster component 的直接子 `<terraforming>` 时解析 terraforming runtime
- **并且** parser SHALL NOT 依赖固定 XPath 深度

#### Scenario: integrate with existing streaming parser

- **前提** rust parser 已经以流式方式读取 save XML 并构建 archive
- **当** parser 遇到 `<terraforming>` start element
- **那么** terraforming 解析 SHALL 在当前读取流程中消费该 `<terraforming>` 子树
- **并且** terraforming 解析 SHALL 复用当前 XML reader、component stack 和 archive builder
- **并且** terraforming 解析 SHALL NOT 从文件开头重新读取 save XML

#### Scenario: stop after universe for save binding extraction

- **前提** save binding 所需的 component、terraforming 和 research runtime 数据位于 `<savegame>/<universe>` 内
- **当** parser 读到 `</universe>`
- **那么** parser MAY 将当前 archive 视为解析完成
- **并且** parser SHALL NOT 继续扫描后续 `economylog/log/script/md/aidirector/ui/signature` 顶层块
- **并且** 该提前结束 SHALL NOT 依赖固定 sector 数量

#### Scenario: stop gzip stream after universe without requiring trailer

- **前提** gzip save XML 解压出的事件流已经到达 `</universe>`
- **当** parser 将 archive 标记为完成
- **那么** 调用方 MAY 停止继续读取或推送剩余 gzip chunk
- **并且** parser SHALL NOT 要求 gzip trailer/CRC 已经被读取后才允许输出 archive

#### Scenario: bind terraforming block to cluster component

- **前提** 原始 save XML 中 `<terraforming>` 位于 `<component class="cluster" macro="cluster_26_macro">` 内
- **当** rust parser 解析该 `<terraforming>` block
- **那么** 输出的 `SaveTerraformingCluster.clusterId` SHALL 为 `cluster_26_macro`
- **并且** archive 的 `terraforming_clusters` SHALL 使用该 `clusterId` 作为 key

#### Scenario: preserve terraforming identity fields

- **前提** `<terraforming>` 包含 `part`, `seed`, `missioncue`, `missioncomplete`
- **当** parser 输出 `SaveTerraformingCluster`
- **那么** `part`, `seed`, `missionCue`, `missionComplete` SHALL 被保留

#### Scenario: parse cluster stats

- **前提** `<terraforming>` 包含 `<stats><stat id="temperature" value="9"/></stats>`
- **当** parser 输出 `SaveTerraformingCluster`
- **那么** `stats.temperature` SHALL 等于 `9`

### Requirement: Terraforming Project Progress

parser SHALL classify active, completed, and retained terraforming projects from the save XML without changing project inner semantics.

#### Scenario: ignore nested predecessor project references

- **前提** 顶层 project 内部存在 `<predecessors><projects><project id="foo"/></projects></predecessors>`
- **当** parser 遍历 `<terraforming>/<projects>`
- **那么** parser SHALL 只把 `<terraforming>/<projects>` 的直接子 `<project>` 当作 runtime project
- **并且** parser SHALL NOT 把 predecessor 内的 `<project>` 引用输出为 completed、active 或 retained project

#### Scenario: parse active project

- **前提** `<terraforming active="agr_hydroponics">` 且项目列表中存在 `<project id="agr_hydroponics">`
- **当** parser 输出 cluster runtime
- **那么** `activeProject.projectId` SHALL 等于 `agr_hydroponics`
- **并且** `activeProject` SHALL 包含 scaled/submitted/in-transit resources

#### Scenario: mark active project as aborting

- **前提** `<terraforming active="atm_methane_oxidize" aborted="1">`
- **当** parser 输出 active project
- **那么** `activeProject.aborted` SHALL 为 `true`
- **并且** 该项目 SHALL NOT 因为 `aborted="1"` 被归入 `retainedProjects`

#### Scenario: parse completed project count

- **前提** 顶层项目 XML 包含 `<project id="foo" completed="2" starttime="123">`
- **当** parser 输出 cluster runtime
- **那么** `completedProjects` SHALL 包含 `{ projectId: "foo", completedCount: 2, startTime: 123 }`
- **并且** `startTime` SHALL 表示项目开始时间，不表示完成时间

#### Scenario: parse retained progress independently from completion

- **前提** 顶层项目不是 active，包含 `completed="2"`，并且包含 `<deliveredresources>`
- **当** parser 输出 cluster runtime
- **那么** 该项目 SHALL 出现在 `completedProjects`
- **并且** 该项目 SHALL 同时出现在 `retainedProjects`
- **并且** 其 `submittedResources` SHALL 来自 `<deliveredresources>`

### Requirement: Terraforming Resource Progress

parser SHALL extract resource progress from delivered resources and in-transit ship cargo.

#### Scenario: parse submitted resources

- **前提** project 包含 `<deliveredresources><ware ware="energycells" amount="963090"/></deliveredresources>`
- **当** parser 输出 project progress
- **那么** `submittedResources` SHALL 包含 `{ ware: "energycells", amount: 963090 }`

#### Scenario: parse scaled target resources

- **前提** project 包含 `<scaledresources><ware ware="graphene" amount="218296"/></scaledresources>`
- **当** parser 输出 project progress
- **那么** `scaledResources` SHALL 包含 `{ ware: "graphene", amount: 218296 }`

#### Scenario: aggregate in-transit ship cargo

- **前提** project 的 `<ships>` 下有多艘 ship 携带相同 cargo
- **当** parser 输出 project progress
- **那么** `inTransitShipBatches` SHALL 等于 `<ships>` 下直接子 `<ship>` 的数量
- **并且** `inTransitResources` SHALL 按 ware 汇总所有在途 cargo
- **并且** parser SHALL NOT 为该字段做 ship id 到全局 ship component macro 的匹配

#### Scenario: count save_009 active terraforming ships

- **前提** `save_009.xml` 当前活动 terraforming project 的 `<ships>` 下有 126 个直接子 `<ship>`
- **当** parser 输出该 project progress
- **那么** `inTransitShipBatches` SHALL 等于 `126`

#### Scenario: omit in-transit fields when no ships are in transit

- **前提** project 没有 `<ships>` 下的直接子 `<ship>`
- **当** parser 输出 project progress
- **那么** `inTransitResources` SHALL NOT 出现在输出 JSON 中
- **并且** `inTransitShipBatches` SHALL NOT 出现在输出 JSON 中

#### Scenario: ignore buildtasks as progress source

- **前提** project 存在 buildtasks 或 drone deliveries
- **当** parser 输出 project progress
- **那么** buildtasks SHALL NOT 被计入 `submittedResources`
- **并且** buildtasks SHALL NOT 被计入 `inTransitResources`

### Requirement: Terraforming Events and Rebates

parser SHALL extract event execution counts and cluster rebate accumulators from terraforming runtime data.

#### Scenario: output only completed events

- **前提** `<event id="evt_globalwarming_methane" completed="2" starttime="100">`
- **当** parser 输出 cluster runtime
- **那么** `events` SHALL 包含 `{ eventId: "evt_globalwarming_methane", completedCount: 2, startTime: 100 }`

#### Scenario: skip events without completed attribute

- **前提** `<event>` 缺少 `completed` 属性
- **当** parser 输出 cluster runtime
- **那么** 该 event SHALL NOT 出现在 `events`

#### Scenario: preserve cluster rebates

- **前提** `<terraforming>` 包含 `<rebates>` 累计值
- **当** parser 输出 cluster runtime
- **那么** `rebates` SHALL 保留这些 cluster runtime 累计值

### Requirement: IndexedDB Persistence

save archive persistence SHALL store terraforming runtime data inside the existing `player_stations` table data payload.

#### Scenario: store terraforming clusters beside player station records

- **前提** archive 包含 `terraforming_clusters`
- **当** archive 被写入 IndexedDB
- **那么** `player_stations.data.terraforming_clusters` SHALL 包含该数据
- **并且** 它 SHALL 与 `player_stations.data.player_stations`、`player_stations.data.player_buildstorages` 同级

#### Scenario: strip terraforming clusters from archive body

- **前提** archive 写入 `archive_data`
- **当** 分离 player station 相关大字段
- **那么** `terraforming_clusters` SHALL 从 archive body 中剥离

#### Scenario: merge terraforming clusters when reading archive

- **前提** IndexedDB 中存在 `player_stations.data.terraforming_clusters`
- **当** 读取 archive
- **那么** 返回的 archive SHALL 重新包含 `terraforming_clusters`

#### Scenario: backward compatible missing field

- **前提** 旧 IndexedDB 记录没有 `terraforming_clusters`
- **当** 读取 archive
- **那么** 系统 SHALL 将其视为 `{}`，且不抛错
