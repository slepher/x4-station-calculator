# design.md - research-binding

## 架构

本变更位于 save binding 后端数据链路，分为三层：

```
raw save XML
  -> rust-parser 提取 archive.research
  -> saveArchiveDB strip / persist / merge
  -> archive runtime data 供 store/presenter 后续消费
```

不新增 UI，不新增 presenter，不修改 research 静态数据生成。

## 数据模型

```ts
interface SaveResearchRuntime {
  visibleIds: string[]
  completedIds: string[]
  activeId: string | null
}
```

archive 顶层：

```ts
interface SaveArchive {
  research?: SaveResearchRuntime
}
```

`PlayerStationsRecord.data`：

```ts
{
  player_stations: Record<string, Record<string, PlayerStationEntry>>
  player_buildstorages: Record<string, Record<string, BuildStorageEntry>>
  research: SaveResearchRuntime
}
```

注：`terraforming_clusters` 属于 terraforming-binding 变更，不在本变更范围内。

## XML 解析策略

### 定位规则

实现者不需要重新阅读样本 XML；parser SHALL 按以下结构规则识别 research runtime：

```xml
<component class="player" macro="..." id="...">
  ...
  <entries type="researchables">
    <entry id="research_agentslot_01"/>
    <entry id="research_equipment_xenon" read="0"/>
  </entries>
  ...
  <research>
    <research ware="research_teleportation" method="research"/>
    <research ware="research_module_production" method="research"/>
  </research>
  ...
</component>
```

正在进行的 research 位于玩家总部 research module 的 production component：

```xml
<component class="production" macro="landmarks_player_hq_01_research_macro" ...>
  <production start="1345086.969" end="1345097.545" item="0" cycle="0" state="waitingforresources">
    <queue ware="research_warp_hq_02" method="research">
      <insufficient>
        <ware ware="advancedelectronics" amount="1345086"/>
        <ware ware="fieldcoils" amount="1345086"/>
      </insufficient>
    </queue>
  </production>
</component>
```

关键约束：

- visible/completed research runtime 数据属于 `component[@class="player"]` 子树。
- active research runtime 数据属于 `component[@class="production" and @macro="landmarks_player_hq_01_research_macro"]` 子树。
- parser MUST NOT 使用固定 XPath 深度。
- parser SHALL 使用 component stack 判断当前是否位于 player component 或 HQ research production component 内。
- research parser MUST 插入现有 rust-parser 的流式事件读取流程。
- research parser MUST 复用当前 reader 位置、element stack、component stack 和已有 archive builder。
- research parser MUST NOT 打开 save XML 做第二遍读取，也 MUST NOT 从文件开头重新扫描。
- parser SHALL 只解析 player component 子树中的 research runtime；其他位置出现的 `research_...` 文本、terraforming project 的 `research="..."` 属性、script refs 或 MD value 不属于本输出。

可实现为事件流状态机：

```text
start component:
  push component frame
  if class == "player": mark frame.isPlayer = true
  if class == "production" && macro == "landmarks_player_hq_01_research_macro":
    mark frame.isResearchProduction = true

while inside player component:
  start entries:
    if @type == "researchables":
      delegate to parse_researchables_entries(reader)
      append entry @id to archiveBuilder.research.visibleIds

  start research:
    if this is direct child of player component:
      delegate to parse_completed_research_list(reader)
      append child research @ware to archiveBuilder.research.completedIds

while inside HQ research production component:
  start production:
    inspect direct child queue nodes
  start queue:
    if @method == "research" && @ware starts with "research_":
      archiveBuilder.research.activeId = @ware

end component:
  pop component frame
```

### 集成方式要求：

- 不在 `open()` 中使用 `at_tags` 对 player component 子元素做 path suffix 匹配，因为 player component 内部的 `<entries>`、`<research>`、`<production>` 等元素可能有任意层中间元素，`at_tags` 固定深度匹配会失败。
- 改为使用 `comp_stack.iter().any()` 判断当前是否在 player component / HQ research production component 内，配合元素名 + 属性判断 + 标志位做状态管理。
- research SHALL 写入当前 archive builder，不创建并行 archive。

**实现状态机：**

```text
open(name, attrs):
  if name == "component" && class == "production"
     && macro == "landmarks_player_hq_01_research_macro":
    push component to comp_stack

  if name == "entries"
     && inside player component (comp_stack.any(ctx => ctx.class == "player"))
     && attrs["type"] == "researchables":
    set in_player_researchables = true

  if name == "entry" && in_player_researchables:
    capture attrs["id"] → visibleIds (if starts with "research_")

  if name == "research" && inside player component:
    if attrs contains "ware":
      if in_player_completed_research:
        capture attrs["ware"] → completedIds (if method=="research")
    else:
      set in_player_completed_research = true

  if name == "queue" && inside research production component
     && parent element is "production":
    capture attrs["ware"] → activeId (if method=="research")

close(name):
  if name == "entries":
    reset in_player_researchables
  if name == "research" && parent element != "research":
    reset in_player_completed_research
```

### visibleIds

`visibleIds` 来自 player component 内：

```xml
<entries type="researchables">
  <entry id="research_agentslot_01"/>
  <entry id="research_equipment_xenon" read="0"/>
</entries>
```

解析规则：

- 只读取 `type="researchables"` 的 entries block。
- 只读取直接子 `<entry>`。
- 只保留 `id` 以 `research_` 开头的条目。
- 保留 XML 顺序。
- `read="0"` 只表示未读 UI 状态，不影响 visibleIds。

### completedIds

`completedIds` 来自 player component 的直接子 `<research>` block：

```xml
<research>
  <research ware="research_teleportation" method="research"/>
  <research ware="research_module_production" method="research"/>
</research>
```

解析规则：

- 只解析 player component 的直接子 `<research>` block。
- 只读取该 block 的直接子 `<research ware="...">`。
- `ware` 以 `research_` 开头时加入 `completedIds`。
- `method` 当前只保留为过滤辅助；输出不记录 method。
- 保留 XML 顺序。

### activeId

`activeId` 表示当前正在进行的 research id。

解析规则：

- 如果 `component[@class="production" and @macro="landmarks_player_hq_01_research_macro"]` 的 `<production>` 直接子队列中存在 `<queue method="research" ware="research_...">`，则输出该 `ware`。
- 如果没有 research queue，输出 `null`。
- `production@state` 可以是 `waitingforresources` 等状态；只要 queue 存在且 `method="research"`，该 queue 的 `ware` 就是正在进行的 research id。
- parser 不从 completedIds 或 visibleIds 推断 activeId。
- parser 不全局搜索 script variables、MD cue 或文本引用推断 activeId。
- parser 不输出 `production@start`、`production@end`、`production@state`、`insufficient` 或 queue 内资源。

当前样本 `save_009.xml` 的 active research 为 `research_warp_hq_02`，来源是 HQ research module production queue。

## Archive 与 IndexedDB

### archive 输出

rust parser 输出 archive 时新增：

```ts
archive.research = {
  visibleIds: string[]
  completedIds: string[]
  activeId: string | null
}
```

### IndexedDB 存储

现有 `player_stations` Dexie table 保持不变：

```ts
player_stations!: Table<PlayerStationsRecord>
```

扩展 `PlayerStationsRecord.data`：

```ts
{
  player_stations: Record<string, Record<string, PlayerStationEntry>>
  player_buildstorages: Record<string, Record<string, BuildStorageEntry>>
  research: SaveResearchRuntime
}
```

（`terraforming_clusters` 由 terraforming-binding 变更独立添加。）

### strip / extract / merge

保存 archive 时：

- `stripPlayerStationsFromArchive()` 同时从 archive 主体剥离 `research`。
- `extractPlayerStationsData()` 将 `archive.research ?? defaultResearchRuntime` 写入 `PlayerStationsRecord.data.research`。

读取 archive 时：

- `mergePlayerStationsIntoArchive()` 将 `stationsData.research ?? defaultResearchRuntime` 合并回 archive。

旧数据兼容：

```ts
const defaultResearchRuntime = {
  visibleIds: [],
  completedIds: [],
  activeId: null
}
```

## 与 research.json 的关联

`research.json.items[].id` 是静态 research id。

save runtime：

```ts
archive.research.visibleIds.includes("research_teleportation")
archive.research.completedIds.includes("research_teleportation")
archive.research.activeId === "research_xxx" || archive.research.activeId === null
```

静态定义：

```ts
research.items.find(item => item.id === "research_teleportation")
```

两者通过 research id 直接关联。

## 非目标决策

- 不输出研究名称、成本、依赖、分类或 unlock 参数。
- 不输出进度百分比、剩余时间、production state、start/end、资源提交量或 insufficient resources。
- 不通过 visible/completed 差集推断 active。
- 不全局搜索 `research_` 文本。

## 实现细节

### Rust 端 activeId 序列化

`SaveResearchRuntime.active_id` 为 `Option<String>`。serde 默认会跳过 `None`（字段不出现在 JSON 中），但 spec 要求 `activeId: string | null` 始终出现。因此使用 `#[serde(serialize_with = "serialize_option_str_or_null")]` 自定义 serializer：

```rust
fn serialize_option_str_or_null<S: Serializer>(v: &Option<String>, s: S) -> Result<S::Ok, S::Error> {
    match v {
        Some(val) => s.serialize_str(val),
        None => s.serialize_none(),  // 输出 JSON null
    }
}
```

### 标志位状态管理

parser 在 `SaveParserCore` 中维护三个运行时状态：

- `research: SaveResearchRuntime` — 累积的解析结果，`finish_archive()` 输出到 archive
- `in_player_researchables: bool` — 当前在 `<entries type="researchables">` 内
- `in_player_completed_research: bool` — 当前在 player component 的直接子 `<research>` block 内

`in_player_completed_research` 的关闭判断：在 `close("research")` 时检查 path 中 parent 元素是否为 "research"（inner research）以区分内层/外层 research close 事件。

### 组件定位

不使用 `at_tags` 做 path suffix 匹配（player component 子元素可能有多层中间元素），改用：

- `is_inside_player_component()`: `comp_stack.iter().any(|ctx| ctx.class == "player")`
- `is_inside_research_production()`: `comp_stack.iter().any(|ctx| ctx.class == "production" && ctx.macro_field == "landmarks_player_hq_01_research_macro")`
