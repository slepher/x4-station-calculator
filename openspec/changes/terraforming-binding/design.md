# design.md - terraforming-binding

## 架构

本变更位于 save binding 后端数据链路，分为三层：

```
raw save XML
  -> rust-parser 提取 archive.terraforming_clusters
  -> saveArchiveDB strip / persist / merge
  -> archive runtime data 供 store/presenter 后续消费
```

不新增 UI，不新增 presenter，不修改 terraforming 静态数据生成。

## 数据模型

```ts
interface SaveTerraformingCluster {
  clusterId: string
  part: string
  seed: string
  missionCue?: string
  missionComplete: boolean
  stats: Record<string, number>
  rebates: SaveTerraformingRebateAmount[]
  activeProject?: SaveTerraformingProjectProgress
  completedProjects: SaveTerraformingCompletedProject[]
  retainedProjects: SaveTerraformingProjectProgress[]
  events: SaveTerraformingEventProgress[]
}

interface SaveTerraformingCompletedProject {
  projectId: string
  completedCount: number
  startTime?: number
}

interface SaveTerraformingProjectProgress {
  projectId: string
  aborted?: boolean
  scaledResources: WareAmount[]
  submittedResources: WareAmount[]
  inTransitResources?: WareAmount[]
  inTransitShipBatches?: number
}

interface SaveTerraformingEventProgress {
  eventId: string
  completedCount: number
  startTime?: number
}

interface SaveTerraformingRebateAmount {
  ware?: string
  wareGroup?: string
  amount: number
}

interface WareAmount {
  ware: string
  amount: number
}
```

## XML 解析策略

## Rust 模块拆分

- `rust-parser/src/core.rs` 只维护通用 XML 事件流、component stack 和 archive 组装。
- `rust-parser/src/terraforming.rs` 拥有 terraforming runtime 的状态机、项目分类、资源汇总、event/rebate 解析和 `SaveTerraformingCluster` 组装。
- core 在 `open()` 时把当前 element、属性、path 和当前 cluster id 分派给 `TerraformingParser::open()`。
- core 在 `close()` 时把关闭 element 分派给 `TerraformingParser::close()`。
- `TerraformingParser` 不打开 XML 文件，不创建新 reader，不从头扫描；它只消费 core 当前流式读取中的事件上下文。

### universe 边界提前结束

实测 save XML 的 world/component 数据位于 `<savegame>/<universe>` 子树内；`cluster`、`sector`、player/HQ research component 与 terraforming block 均在该子树中。`</universe>` 之后的顶层块主要是 `economylog`、`stats`、`log`、`script`、`md`、`missions`、`aidirector`、`ui` 和 `signature`，不属于当前 save binding 输出来源。

parser SHALL 在关闭 `</universe>` 后允许提前完成：

- Rust parser 在 `close("universe")` 后将 streaming parser 标记为 done，后续 chunk 直接忽略。
- CLI WASM 解析在 parser done 后停止继续读取输入 stream。
- 浏览器上传链路在 worker 返回 complete/error 后取消 file reader，不继续发送 chunk。
- TS fallback parser 按自己的 SAX runtime 在 `</universe>` 后停止喂入后续文本；提前停止后 close 不再调用 `saxParser.close()`，避免因为 `<savegame>` 未完整闭合而报错。
- 对 gzip 输入，提前完成不要求读取 gzip trailer，也不校验后续压缩流 CRC；一旦解压出的 XML 已到达 `</universe>`，parser 即可输出 archive，调用方应停止继续推送压缩 chunk。

该优化不以固定 sector 数量作为条件，也不硬编码版本地图数量；边界来自 XML 结构本身。

### 定位规则

实现者不需要重新阅读样本 XML；parser SHALL 按以下结构规则识别 terraforming runtime：

```xml
<component class="cluster" macro="cluster_26_macro" ...>
  <events>...</events>
  <offset .../>
  <system>
    <planets>
      <planet part="planet001b" .../>
    </planets>
  </system>
  <terraforming part="planet001b" seed="..." active="..." aborted="1" missioncue="..." missioncomplete="1">
    ...
  </terraforming>
</component>
```

关键约束：

- `<terraforming>` 是 `component[@class="cluster"]` 的直接子节点。
- cluster component 本身位于 save XML 的多层 `connections/connection/component` 嵌套中，父级深度不固定。
- parser MUST NOT 使用固定 XPath 深度。
- parser SHALL 使用 element stack 找到最近的 `component[@class="cluster"]` ancestor。
- 绑定 `clusterId` 时使用该 cluster component 的 `macro` 属性，不使用 `part` 或 `seed` 反查。
- terraforming parser MUST 插入现有 rust-parser 的流式事件读取流程。
- terraforming parser MUST 复用当前 reader 位置、element stack、component stack 和已有 archive builder。
- terraforming parser MUST NOT 打开 save XML 做第二遍读取，也 MUST NOT 从文件开头重新扫描。

可实现为事件流状态机：

```text
start component:
  push component frame
  if class == "cluster": mark frame.clusterMacro = @macro

start terraforming:
  find nearest open component frame with class == "cluster"
  currentClusterId = frame.macro
  delegate to parse_terraforming_subtree(reader, currentClusterId, startAttributes)
  // parse_terraforming_subtree consumes only this subtree and returns at </terraforming>
  archiveBuilder.terraforming_clusters[currentClusterId] = parsedCluster

end component:
  pop component frame
```

集成方式要求：

- `parse_terraforming_subtree` 接收现有 XML reader 的可变引用，不创建新 reader。
- 调用点位于当前 parser 已经处理 start element 的分支中，例如遇到 `Start(terraforming)` 时分派。
- 子解析函数只消费当前 `<terraforming>...</terraforming>` 子树内的事件。
- 子解析函数返回后，外层 parser 继续从 `</terraforming>` 后面的下一个事件读取。
- 如果现有 parser 已有 archive/player station/buildstorage 的输出 builder，terraforming SHALL 写入同一个 builder，不创建并行 archive。

### cluster 上下文

rust parser 在解析 component 时维护 component 栈：

- 进入 `<component class="cluster" macro="...">` 时记录当前 cluster context。
- 进入子 component 时保留最近的 cluster ancestor。
- 遇到 `<terraforming>` 时读取当前 cluster context，并写入 `clusterId=currentCluster.macro`。
- 离开 cluster component 时清除该 cluster context。

实测 `save_009.xml` 中当前活动项目：

```xml
<component class="cluster" macro="cluster_26_macro" ...>
  <system>...</system>
  <terraforming part="planet001b" seed="14132372697985274587" active="agr_hydroponics" ...>
    ...
  </terraforming>
</component>
```

因此 parser 不需要通过 `part` 或 `planetid` 反推 cluster。

### terraforming block

解析 `<terraforming>` 属性：

- `part`
- `seed`
- `active`
- `aborted`
- `missioncue`
- `missioncomplete`

`active` 为空字符串时不生成 activeProject。

`<terraforming>` 直接子结构按以下节点解析：

```xml
<terraforming ...>
  <stats>...</stats>
  <projects>...</projects>
  <events>...</events>
  <rebates>...</rebates>
  <shadervalues>...</shadervalues>
</terraforming>
```

未知或无需输出的直接子节点 SHALL 跳过但保持流式解析状态正确，例如 `<shadervalues>`。

### stats

`<stats><stat id="..." value="..."/></stats>` 转为 `Record<string, number>`。

### projects

只遍历 `<terraforming>/<projects>` 的直接子 `<project ...>`。project 内部可能存在 `<predecessors><projects><project id="..."/></projects></predecessors>` 这类引用节点，parser MUST NOT 把这些嵌套引用当成顶层 project runtime 记录。

顶层 project 结构示例：

```xml
<project id="agr_hydroponics" completed="2" starttime="123" ...>
  <conditions>...</conditions>
  <resources>...</resources>
  <deliveries>...</deliveries>
  <scaledresources>...</scaledresources>
  <scaleddeliveries>...</scaleddeliveries>
  <deliveredresources>...</deliveredresources>
  <ships>...</ships>
</project>
```

遍历顶层 `<project ...>`：

- 带 `completed` 属性 -> `completedProjects`，`completed` 的数值保存为 `completedCount`
- `id === terraforming.active` -> `activeProject`
- 非 active 且存在持久资源进度 -> `retainedProjects`

项目进度解析：

- `<scaledresources><ware ware="..." amount="..."/></scaledresources>` -> `scaledResources`
- `<deliveredresources><ware ware="..." amount="..."/></deliveredresources>` -> `submittedResources`
- `<ships>` 下每个直接子 `<ship>` 的 cargo ware -> `inTransitResources`
- `<ships>` 下直接子 `<ship>` 数量 -> `inTransitShipBatches`

`starttime` 只保存为 `startTime`，不推导 completion time。

同一顶层 project 不通过重复 `<project>` 表示多次完成；重复完成次数由该 project 的 `completed` 属性承载，例如 `completed="2"`。

`completedProjects` 与 `retainedProjects` 不互斥。可重复项目可能已经 `completed="2"`，同时又保留下一轮未完成或取消后的 `<deliveredresources>`；这种项目 SHALL 同时进入 completed 与 retained 两个输出。

`aborted="1"` 不改变 active 分类。只要 `<terraforming active="...">` 仍指向该项目，它就 SHALL 输出为 `activeProject`，并通过 `activeProject.aborted=true` 表示正在取消。取消尚未彻底完成时，存档数据形态与 active project 相同，且游戏不能开始新 project，因此不作为 retained。

### in-transit ship count

`<ships>` 下 ship 不输出具体 id。

`<ships>` 仅在 project 内表示已经出发、携带资源的在途飞船。parser SHALL 读取每个直接子 `<ship>` 的 cargo ware 子节点并聚合为 `inTransitResources`，同时把直接子 `<ship>` 数量输出为 `inTransitShipBatches`。如果没有在途飞船，parser SHALL 不输出 `inTransitResources` 和 `inTransitShipBatches`，而不是输出空数组和 `0`。

计数规则：

1. 不做 ship id 到全局 `<component class="ship_*" macro="...">` 的匹配。
2. 不输出 ship macro/type。
3. 每关闭一个 project `<ships>` 的直接子 `<ship>`，`inTransitShipBatches += 1`。
4. 对所有 ship cargo 汇总为 `inTransitResources`。

`save_009.xml` 的 `agr_hydroponics` 当前活动项目中 `<ships>` 直接子 `<ship>` 为 126 个，因此输出 `inTransitShipBatches: 126`。

### events

遍历 terraforming block 内的 `<event>`：

- 没有 `completed` 属性：跳过。
- 有 `completed` 属性：输出 `eventId`, `completedCount`, `startTime?`。

### rebates

遍历 `<rebates>`，保留 save XML 的累计值。

rebates 是 cluster runtime 状态，不从 project 静态定义合成。

## Archive 与 IndexedDB

### archive 输出

rust parser 输出 archive 时新增：

```ts
archive.terraforming_clusters = Record<string, SaveTerraformingCluster>
```

key 使用 `clusterId`。

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
  terraforming_clusters: Record<string, SaveTerraformingCluster>
}
```

### strip / extract / merge

保存 archive 时：

- `stripPlayerStationsFromArchive()` 同时从 archive 主体剥离 `terraforming_clusters`。
- `extractPlayerStationsData()` 将 `archive.terraforming_clusters ?? {}` 写入 `PlayerStationsRecord.data.terraforming_clusters`。

读取 archive 时：

- `mergePlayerStationsIntoArchive()` 将 `stationsData.terraforming_clusters ?? {}` 合并回 archive。

旧数据兼容：

- 读取旧 `PlayerStationsRecord.data` 时，如果缺少 `terraforming_clusters`，按 `{}` 处理。

## 与 terraforming.json 的关联

`terraforming.json.clusters[].macro` 是静态 cluster macro。

save runtime:

```ts
terraforming_clusters["cluster_26_macro"].clusterId === "cluster_26_macro"
```

静态定义:

```ts
terraforming.clusters.find(cluster => cluster.macro === "cluster_26_macro")
```

两者通过 `clusterId/macro` 直接关联。

## 非目标决策

- 不解析 buildtasks 为资源进度。
- 不记录具体 ship id。
- 不通过 `part` 或 `seed` 反查 cluster。
- 不把 project 静态定义复制进 save runtime。
