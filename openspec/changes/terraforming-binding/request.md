# request.md - terraforming-binding

## 目标

在 save binding 后端中新增 terraforming 存档运行时数据提取与持久化能力。解析原始 save XML 中位于 `component class="cluster"` 内的 `<terraforming>` 块，将每个星区的改造状态、项目进度、资源滞留、已完成项目和事件执行次数写入 archive 数据，并在 IndexedDB 的 `player_stations.data` 内与 `player_stations`、`player_buildstorages` 同级保存为 `terraforming_clusters`。

## 已确认方案（审核重点）

### 1. 数据来源与 cluster 关联

- `<terraforming>` 位于原始 XML 的 cluster component 内，结构为：
  - `<component class="cluster" macro="cluster_26_macro" ...>`
  - `<system>...</system>`
  - `<terraforming part="planet001b" seed="..." ...>`
- parser SHALL 不依赖固定 XML 深度；save XML 中 cluster 位于多层 `connections/connection/component` 嵌套中。
- parser SHALL 通过流式 element stack 维护最近的 `component[@class="cluster"]` ancestor。
- 当遇到该 cluster component 的直接子节点 `<terraforming>` 时，开始解析 terraforming runtime block。
- terraforming 提取 SHALL 插入现有 rust parser 的流式读取流程，复用当前 XML reader、element stack 与 component 上下文。
- parser MUST NOT 为 terraforming 另起一次从文件开头开始的扫描，也 MUST NOT 在现有读取流程之外重新读取 save XML。
- rust parser SHALL 在流式解析 save XML 时维护当前 cluster component 上下文。
- save binding 所需的 universe/component 数据、terraforming 和当前 research 来源均位于 `<universe>` 子树内；parser MAY 在关闭 `</universe>` 后提前完成，不继续扫描后续 `economylog/log/script/md/aidirector/ui/signature` 等顶层块。
- 遇到 `<terraforming>` 时，使用当前 cluster component 的 `macro` 作为 `clusterId`。
- `clusterId` 足够关联存档中的 terraforming 运行时数据与 `terraforming.json` 中的 cluster 定义。
- `part` 与 `seed` 仍 SHALL 保留，用于区分同一 cluster 内的 terraforming 实例和辅助诊断。
- 推荐存储 key 为 `clusterId`，若后续发现同一 cluster 多实例，再扩展为 `clusterId:part:seed`；当前已确认需求以 `clusterId` 关联为准。

### 2. 提取范围

每个 `terraforming_clusters[clusterId]` SHALL 输出：

- `clusterId`
- `part`
- `seed`
- `missionCue`
- `missionComplete`
- `stats`
- `rebates`
- `activeProject`
- `completedProjects`
- `retainedProjects`
- `events`

### 3. 星区状态

- `missionComplete` 来自 `<terraforming missioncomplete="1">`。
- 当前星区由存在有效 `activeProject` 推导。
- 已完成星区由 `missionComplete=true` 推导。
- 没有 active project 且未 missionComplete 的星区仍可输出，保留其 stats、rebates、completedProjects、retainedProjects 和 events。

### 4. 项目状态

- 当前进行中的项目来自 `<terraforming active="project_id">`。
- 若 `<terraforming aborted="1">`，该项目仍 SHALL 作为 `activeProject` 输出，并标记 `aborted=true`，表示项目正在取消。
- 正在取消但尚未彻底取消的项目在数据上与 active project 没有区别，也不能开始新 project，因此不归入 `retainedProjects`。
- 已完成项目来自带 `completed` 属性的顶层 `<project>`。
- `completed` 属性值是完成次数；例如 `completed="2"` 表示同一可重复项目已完成 2 次。
- 已完成项目 SHALL 输出 `projectId`、`completedCount` 和可用的 `startTime`。
- `starttime` 是项目开始时间，不视为完成时间。
- `completedProjects` 与 `retainedProjects` 是两个维度，不互斥。
- 非 active 但存在持久资源进度的项目 SHALL 进入 `retainedProjects`，即使该项目也有 `completed` 属性。该场景用于表达可重复项目已经完成过若干次，同时又有一轮已退出 active 状态后的资源滞留。

### 5. 资源进度

对 activeProject 和 retainedProjects，资源字段 SHALL 包含：

- `scaledResources`: `<scaledresources>` 中的目标资源量。
- `submittedResources`: `<deliveredresources>` 中已经交付到行星的资源量。
- `inTransitResources`: `<ships>` 下所有 `<ship>` cargo 中的 `<ware>` 按 ware 汇总后的在途资源量；没有在途飞船时不输出该字段。
- `inTransitShipBatches`: `<ships>` 下直接子 `<ship>` 的数量，例如 `save_009.xml` 当前活动项目为 `126`；没有在途飞船时不输出该字段。

建造中的 drone/build ship 不作为 terraforming 进度来源。原因是经存档对比确认，资源在飞船出发时才进入 ship cargo；未出发的 buildtasks 不代表已投送或在途资源。

### 6. 飞船信息

- 只输出在途 ship 数量和 cargo 资源汇总，不输出具体 ship id。
- 不做 ship id 到 `<component class="ship_*" macro="...">` 的全局匹配。
- 不输出 ship macro/type；`inTransitShipBatches` 是 number，不是按 macro 或 cargo signature 分组的数组。
- 不输出建造中 drone 列表。

### 7. events

- `<event>` 只有存在 `completed` 属性时才输出。
- 输出字段为：
  - `eventId`
  - `completedCount`
  - `startTime`（若存在）
- 没有 `completed` 属性的 event 不输出。

### 8. rebates

- `<rebates>` 是该 cluster 当时的 rebates 累计值。
- rebates SHALL 按 cluster 保存到 `SaveTerraformingCluster.rebates`。
- rebates 不从 `terraforming.json` 的静态 project 定义推导。

### 9. IndexedDB 持久化位置

不新增 Dexie table。

`terraforming_clusters` SHALL 保存到现有 `player_stations` 表的 `data` 内部，与 `player_stations`、`player_buildstorages` 同级：

```ts
{
  player_stations: Record<string, Record<string, PlayerStationEntry>>,
  player_buildstorages: Record<string, Record<string, BuildStorageEntry>>,
  terraforming_clusters: Record<string, SaveTerraformingCluster>
}
```

archive 主体在写入 `archive_data` 前 SHALL 剥离 `terraforming_clusters`，读取时再与 `player_stations.data.terraforming_clusters` 合并回 archive。

### 10. 与现有数据定义的关系

- `terraforming.json` 仍是静态定义来源，提供 cluster 定义、project 定义、deliveries、资源目标解释、名称与分组。
- save binding 输出的是运行时状态，不复制静态定义中的完整 project 内容。
- 前端或 presenter 通过 `clusterId` 将 save runtime 与 `terraforming.json.clusters[].macro` 关联。

## 边界

### In Scope

- rust parser 从原始 save XML 解析 terraforming runtime 数据。
- 维护 cluster component 上下文，将 `<terraforming>` 绑定到 `clusterId`。
- 输出 archive 级 `terraforming_clusters`。
- 持久化到 IndexedDB `player_stations.data.terraforming_clusters`。
- 解析 stats、rebates、activeProject、completedProjects、retainedProjects、events。
- 汇总 submitted resources 与 in-transit resources。
- 在存档导入、保存、读取合并流程中保留 terraforming runtime 数据。
- 在 `</universe>` 后提前停止解析，避免继续扫描与 save binding 无关的日志和脚本运行时块。
- 保持 backward compatible：旧记录缺少 `terraforming_clusters` 时视为空对象。

### Out of Scope

- 前端 UI 展示。
- presenter 层展示结构。
- 修改 `terraforming.json` 静态定义生成逻辑。
- buildtasks/建造中 drone 进度统计。
- 具体 ship id 追踪。
- 还原项目完成时间；当前 save XML 只确认有 `starttime`。
- 测试代码编写（属于 `/x4:test` 阶段）。

## 验收标准（DoD）

1. `npm run build` 成功。
2. rust parser 在解析包含 `<terraforming>` 的 save XML 后，archive JSON 包含 `terraforming_clusters`。
3. `terraforming_clusters` 的 key 可通过 `clusterId` 与 `terraforming.json.clusters[].macro` 关联。
4. 活动项目输出 `activeProject.projectId`、`scaledResources`、`submittedResources`；有在途飞船时输出 `inTransitResources` 和 `inTransitShipBatches`。
5. `active` 指向的项目即使 `aborted="1"` 也输出为 `activeProject.aborted=true`，不输出到 `retainedProjects`。
6. 非 active 但保留持久资源进度的项目输出到 `retainedProjects`；该项目可以同时出现在 `completedProjects`。
7. 带 `completed` 属性的顶层项目输出到 `completedProjects`，并保留 `completedCount`；无 completed 项目时输出空数组。
8. event 仅在 XML event 存在 `completed` 属性时输出，并包含执行次数。
9. rebates 输出为 cluster 当前累计值。
10. IndexedDB 中 `player_stations.data` 包含 `terraforming_clusters`，并与 `player_stations`、`player_buildstorages` 同级。
11. 读取 archive 时可将 `terraforming_clusters` 合并回 archive 数据，旧存档缺失该字段不报错。

## 未决项

无。
