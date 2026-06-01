# Research Binding Specification

## ADDED Requirements

### Requirement: Save Research Runtime Extraction

rust parser SHALL extract research runtime state from raw save XML and expose it on the parsed archive as `research`.

#### Scenario: integrate with existing streaming parser

- **前提** rust parser 已经以流式方式读取 save XML 并构建 archive
- **当** parser 进入 `component class="player"` 或 HQ research module production component 并遇到 research runtime 子节点
- **那么** research 解析 SHALL 在当前读取流程中消费对应子树
- **并且** research 解析 SHALL 复用当前 XML reader、component stack 和 archive builder
- **并且** research 解析 SHALL NOT 从文件开头重新读取 save XML

#### Scenario: stop after universe without losing research runtime

- **前提** visible/completed/active research 来源均位于 `<savegame>/<universe>` 内
- **当** parser 读到 `</universe>`
- **那么** parser MAY 将当前 archive 视为解析完成
- **并且** parser SHALL NOT 继续扫描后续日志和脚本运行时顶层块来推断 research

#### Scenario: output default research runtime when absent

- **前提** save XML 中没有可解析的 research runtime 数据
- **当** parser 输出 archive
- **那么** `research` SHALL 为 `{ visibleIds: [], completedIds: [], activeId: null }`

### Requirement: Visible Research IDs

parser SHALL extract visible research ids from player researchable entries.

#### Scenario: parse researchables entries

- **前提** player component 内存在 `<entries type="researchables"><entry id="research_agentslot_01"/></entries>`
- **当** parser 输出 research runtime
- **那么** `research.visibleIds` SHALL 包含 `research_agentslot_01`

#### Scenario: ignore unread marker

- **前提** researchable entry 为 `<entry id="research_equipment_xenon" read="0"/>`
- **当** parser 输出 visible research ids
- **那么** `research.visibleIds` SHALL 包含 `research_equipment_xenon`
- **并且** 输出 SHALL NOT 记录 `read`

#### Scenario: ignore non-research entries

- **前提** player component 内存在其他 `<entries>` block 或非 `research_` id
- **当** parser 输出 research runtime
- **那么** 这些 entry SHALL NOT 进入 `research.visibleIds`

### Requirement: Completed Research IDs

parser SHALL extract completed research ids from the player research list.

#### Scenario: parse completed research list

- **前提** player component 的直接子 `<research>` 包含 `<research ware="research_teleportation" method="research"/>`
- **当** parser 输出 research runtime
- **那么** `research.completedIds` SHALL 包含 `research_teleportation`

#### Scenario: preserve completed order

- **前提** player research list 中按 XML 顺序出现多个 completed research
- **当** parser 输出 `research.completedIds`
- **那么** id 顺序 SHALL 与 XML 顺序一致

#### Scenario: ignore static research references elsewhere

- **前提** save XML 其他位置出现 terraforming project 的 `research="research_tf_tech"` 或 script ref 中的 `research_...`
- **当** parser 输出 research runtime
- **那么** 这些引用 SHALL NOT 进入 `research.completedIds`

### Requirement: Active Research ID

parser SHALL expose the currently running research id when the save XML provides an explicit current research record.

#### Scenario: parse active research from HQ research module queue

- **前提** 存在 `<component class="production" macro="landmarks_player_hq_01_research_macro">`
- **并且** 其 `<production>` 子树包含 `<queue ware="research_warp_hq_02" method="research">`
- **当** parser 输出 research runtime
- **那么** `research.activeId` SHALL 等于 `research_warp_hq_02`

#### Scenario: active research waiting for resources

- **前提** HQ research module 的 `<production>` 具有 `state="waitingforresources"`
- **并且** 其 queue 为 `<queue ware="research_warp_hq_02" method="research">`
- **当** parser 输出 research runtime
- **那么** `research.activeId` SHALL 仍等于 `research_warp_hq_02`
- **并且** 输出 SHALL NOT 包含 production state 或 insufficient resources

#### Scenario: active research absent

- **前提** HQ research module production component 中不存在 `method="research"` 的 research queue
- **当** parser 输出 research runtime
- **那么** `research.activeId` SHALL 为 `null`

#### Scenario: do not infer active research

- **前提** 某 research id 可见但未完成
- **当** parser 输出 research runtime
- **那么** parser SHALL NOT 仅凭 visible/completed 差集推断 `activeId`

### Requirement: IndexedDB Persistence

save archive persistence SHALL store research runtime data inside the existing `player_stations` table data payload.

#### Scenario: store research beside terraforming clusters

- **前提** archive 包含 `research`
- **当** archive 被写入 IndexedDB
- **那么** `player_stations.data.research` SHALL 包含该数据
- **并且** 它 SHALL 与 `player_stations.data.player_stations`、`player_stations.data.player_buildstorages` 同级
- **注** `terraforming_clusters` 由 terraforming-binding 变更独立添加，与本变更同级

**实现说明**：Rust 端 `SaveResearchRuntime` 使用 `#[serde(rename_all = "camelCase")]` derive + `serialize_option_str_or_null` 自定义 serializer 确保 `activeId: null` 而不是省略字段。

#### Scenario: strip research from archive body

- **前提** archive 写入 `archive_data`
- **当** 分离 player station 相关大字段
- **那么** `research` SHALL 从 archive body 中剥离

#### Scenario: merge research when reading archive

- **前提** IndexedDB 中存在 `player_stations.data.research`
- **当** 读取 archive
- **那么** 返回的 archive SHALL 重新包含 `research`

#### Scenario: backward compatible missing field

- **前提** 旧 IndexedDB 记录没有 `research`
- **当** 读取 archive
- **那么** 系统 SHALL 将其视为 `{ visibleIds: [], completedIds: [], activeId: null }`，且不抛错
