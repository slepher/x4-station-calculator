# request.md - research-binding

## 目标

在 save binding 后端中新增 research 存档运行时数据提取与持久化能力。解析原始 save XML 中 player 组件下的 research 相关节点，只输出科研可见 ID 列表、已完成 ID 列表、正在进行的 ID，并在 IndexedDB 的 `player_stations.data` 内与 `player_stations`、`player_buildstorages`、`terraforming_clusters` 同级保存为 `research`。

## 已确认方案（审核重点）

### 1. 数据来源

research runtime 数据分布在两处：

- player component 内保存可见 research 列表与已完成 research 列表。
- 玩家总部 research module 的 production queue 保存正在进行的 research。

parser SHALL 在现有流式读取流程中维护 component stack，遇到对应 component 后解析其直接子结构中的 research 数据。

已确认的原始 XML 形态：

```xml
<component class="player" ...>
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

正在研究的原始 XML 形态：

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

字段来源：

- `visibleIds`: `<entries type="researchables">` 下直接子 `<entry id="research_...">`。
- `completedIds`: player 直接子 `<research>` 下直接子 `<research ware="research_..." method="research"/>`。
- `activeId`: `component[@class="production" and @macro="landmarks_player_hq_01_research_macro"]` 的直接子 `<production>` 下 `<queue method="research" ware="research_...">` 的 `ware`。
- 若没有 research queue，则 `activeId=null`。
- activeId 只输出 research id，不输出 production state、start/end、insufficient resources 或其他进度字段。

### 2. 流式 parser 集成

research 提取 SHALL 插入现有 rust parser 的流式读取流程，复用当前 XML reader、element stack、component stack 与 archive builder。

parser MUST NOT 为 research 另起一次从文件开头开始的扫描，也 MUST NOT 在现有读取流程之外重新读取 save XML。

当前 research 来源位于 `<savegame>/<universe>` 内；save binding parser MAY 在关闭 `</universe>` 后提前完成，不继续扫描后续日志和脚本运行时顶层块。

### 3. 输出结构

archive 顶层 SHALL 新增：

```ts
research: {
  visibleIds: string[]
  completedIds: string[]
  activeId: string | null
}
```

只输出 ID，不输出研究名称、依赖、成本、分类、unlock 参数或进度百分比。

### 4. IndexedDB 持久化位置

不新增 Dexie table。

`research` SHALL 保存到现有 `player_stations` 表的 `data` 内部，与 `player_stations`、`player_buildstorages` 同级：

```ts
{
  player_stations: Record<string, Record<string, PlayerStationEntry>>,
  player_buildstorages: Record<string, Record<string, BuildStorageEntry>>,
  research: SaveResearchRuntime
}
```

archive 主体在写入 `archive_data` 前 SHALL 剥离 `research`，读取时再与 `player_stations.data.research` 合并回 archive。

### 5. 与 research.json 的关系

- `research.json` 仍是静态定义来源，提供研究项定义、名称、分类、成本、依赖与 unlock 元数据。
- save binding 输出的是运行时状态，不复制静态定义内容。
- 前端或 presenter 通过 research id 将 save runtime 与 `research.json.items[].id` 关联。

## 边界

### In Scope

- rust parser 从原始 save XML 的 player component 中提取 research runtime 数据。
- 输出 archive 级 `research`。
- 持久化到 IndexedDB `player_stations.data.research`。
- 解析 `visibleIds`、`completedIds`、`activeId`。
- 在存档导入、保存、读取合并流程中保留 research runtime 数据。
- 保持 backward compatible：旧记录缺少 `research` 时视为 `{ visibleIds: [], completedIds: [], activeId: null }`。

### Out of Scope

- 前端 UI 展示。
- presenter 层展示结构。
- 修改 `research.json` 静态定义生成逻辑。
- 研究成本、依赖、分类、unlock 参数输出。
- 科研进度百分比、剩余时间、production state、start/end、资源提交量、insufficient resources。
- 全局搜索 MD cue 或其他脚本变量来推断研究状态。
- 测试代码编写（属于 `/x4:test` 阶段）。

## 验收标准（DoD）

1. `npm run build` 成功。
2. rust parser 在解析包含 player research 数据的 save XML 后，archive JSON 包含 `research`。
3. `research.visibleIds` 来自 `<entries type="researchables">` 的 research entry id。
4. `research.completedIds` 来自 player 直接子 `<research>` 列表的 `ware` 属性。
5. `research.activeId` 来自 HQ research module production queue 的 `queue@ware`。
6. `research.activeId` 在没有正在进行记录时为 `null`。
7. IndexedDB 中 `player_stations.data` 包含 `research`，并与 `player_stations`、`player_buildstorages` 同级（`terraforming_clusters` 由独立变更添加）。
8. 读取 archive 时可将 `research` 合并回 archive 数据，旧存档缺失该字段不报错。

## 未决项

无。
