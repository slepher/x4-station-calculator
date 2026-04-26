# map-json-refactory Design

## Architecture

### 新 `maps.json` 目标形状

```json
{
  "meta": {},
  "clusters": {
    "cluster_01_macro": {
      "id": "cluster_01_macro",
      "nameId": "{20003,10001}",
      "name": "Grand Exchange",
      "dlc_tag": "base",
      "owner": "teladi",
      "owner_color": "#B3B300",
      "raw_pos": { "x": 0, "z": 0 },
      "normalized": {},
      "sectors": [
        "cluster_01_sector001_macro"
      ],
      "sector_links": {}
    }
  },
  "sectors": {
    "cluster_01_sector001_macro": {
      "id": "cluster_01_sector001_macro",
      "cluster_id": "cluster_01_macro",
      "nameId": "{20004,10011}",
      "name": "Grand Exchange I",
      "owner": "teladi",
      "owner_color": "#B3B300",
      "area": {},
      "raw_local_pos": { "x": 0, "z": 0 },
      "raw_world_pos": { "x": 0, "z": 0 },
      "raw_center_pos": { "x": 0, "y": 0, "z": 0 },
      "normalized": {},
      "zones": {},
      "highways": {},
      "cluster_gates": {},
      "resources": []
    }
  }
}
```

### 消费原则

- cluster 级信息从 `maps.clusters` 读取。
- sector 级信息从 `maps.sectors` 读取。
- cluster 与 sector 的关联通过 `cluster.sectors` 与 `sector.cluster_id` 建立。
- 所有引用字段统一为小写，不再在消费层做大小写归一化兜底。

## Decisions

### D1: 顶层 `sectors` 成为唯一 sector 主索引

**决策**：全量 sector 读取、sector 名称查找、sector 坐标查找、sector 搜索、resource 统计都统一从顶层 `maps.sectors` 开始。

**理由**：

- 旧结构下 sector 被嵌套在 cluster 内，导致每个消费方都要重复双层遍历。
- 顶层 sector 索引更适合搜索、查找、save parser 辅助与 resource 聚合。
- 可以消除“有的代码按 cluster 遍历、有的代码按 sector 遍历”的结构分裂。

**影响**：

- `saveParserConfig`、`saveResourceExtract`、`useMapStore`、`saveParser.post`、地图搜索逻辑都需要切换读取入口。

### D2: cluster 保留 `sectors: string[]` 关联，但不再内嵌 sector 对象

**决策**：cluster 节点保留 `sectors: string[]` 这样的轻量关联字段，而不再内嵌 `sectors: Record<string, Sector>`。

**理由**：

- 地图渲染仍然需要按 cluster 组织 sector 展示。
- 只保留 sector id 数组即可满足 cluster 内聚合需求，避免 sector 数据重复存放。
- 这样既保留 cluster 视角，又让 sector 主数据只有一份。

### D3: 小写 id 在数据生成阶段落地，而不是消费阶段补救

**决策**：所有 id 与引用字段在 `maps.json` 生成阶段直接写为小写，消费方默认输入已经规范化。

**理由**：

- 如果继续在运行时做 `toLowerCase()` 兜底，会长期保留旧格式影子。
- 本次目标是硬切，不是兼容迁移。
- 统一由数据源保证规范，类型与实现才会稳定。

### D4: 类型先行，批量硬切

**决策**：先修改 `X4Map`、`X4MapCluster`、`X4MapSector` 与相关 map types，再以类型错误反推所有受影响消费点。

**理由**：

- 当前依赖面广，先改类型可以最快暴露旧访问路径。
- 比人工搜索更不容易漏掉深层引用。

### D5: 生成脚本与静态产物同轮更新

**决策**：本次重构不接受“代码改完但 `maps.json` 还是旧格式”的中间态；生成脚本与静态产物必须同步更新。

**理由**：

- 否则运行时与脚本会分别依赖不同数据形状，留下长期尾巴。
- 你的要求是一次性重构完成，不留手尾。

### D6: 将 sector 图构建抽为共享 helper，避免业务模块夹带拓扑逻辑

**决策**：把 sector 图构建与 BFS 可达性从 `mapAdvancedResourceFilter.ts` 中抽离为共享 map 拓扑 helper，由 resource filter、POI 搜索、station-binding 等共同复用。

**理由**：

- `station-binding` 的 coverage 计算复用了高级资源筛选的跳数语义，但这不应导致拓扑逻辑继续寄存在 resource filter 模块里。
- 拓扑逻辑留在业务模块内，会把结构重构、业务需求和回归排查耦合在一起。
- 抽离后可以更清楚地区分“map-json 结构适配”和“具体业务行为回归”。

### D7: `station-binding` 按规范值精确比较 macro/id，不再局部重复归一化

**决策**：`station-binding` 内部的 coverage、sector 归属判断、拖拽落点校验统一直接比较规范化后的小写 macro/id；不在组件里继续散落 `toLowerCase()` 对比。

**理由**：

- `map-json-refactory` 已把地图数据源与引用字段统一到小写。
- `station-binding` 自己追加归一化会掩盖旧结构残留和非规范值来源，让问题难以定位。
- 但共享 helper 的行为变更必须单独验证；如果抽离后仍出现资源页候选减少，这应当被视为独立 bug，而不是强行归因给结构重构。

## Impacted Areas

### 运行时代码

- `src/types/x4.ts`
- `src/store/useGameDataStore.ts`
- `src/store/logic/useGameData.ts`
- `src/store/useMapStore.ts`
- `src/utils/saveParserConfig.ts`
- `src/utils/saveResourceExtract.ts`
- `src/utils/mapSearch.ts`
- `src/components/map/**`
- `src/store/logic/mapAdvancedResourceFilter.ts`
- `src/store/logic/mapSectorGraph.ts`
- `src/store/logic/saveBindingUtils.ts`
- `src/composables/useMapBindingViewModel.ts`
- `src/workers/saveParser.post.ts`
- `src/store/logic/importExport.ts`

### 数据生成与分析脚本

- `scripts/x4_data_map_processor.py`
- `scripts/processor/map/service.py`
- `scripts/processor/step1_map/service.py`
- `scripts/extract_resources.py`
- `scripts/extract_resources.tsx`
- `scripts/extract_save.tsx`
- 其他直接遍历 `maps.json` 旧结构的分析脚本

### 测试与夹具

- `tests/unit/map-search/**`
- `tests/unit/map-resource-filter/**`
- `tests/unit/map-refactory/**`
- `tests/unit/map-tooltip/**`
- `tests/unit/user-save-map/**`
- `tests/unit/game-data-loader/**`
- 直接 mock `maps.json` 的单元测试与 fixture

## Verification Strategy

### 文档阶段验证重点

- request/spec/design/tasks 全部以“顶层双索引 + 小写 id + 无兼容层”为中心，不残留旧目标。
- spec 使用 feature 子目录，不再沿用旧的根级 `spec.md` 结构。

### 实施阶段验证重点

- 类型改动后通过编译错误定位所有旧访问方式。
- `maps.json` 生成结果确认不存在顶层大写 key 与 cluster 内嵌 sector 主结构。
- 地图渲染、地图搜索、save parser 配置、resource 提取与 station-binding 覆盖计算至少完成构建级验证。
- 对共享拓扑 helper 的抽离需要额外检查高级资源页候选数是否保持一致；若结构重整后仍下降，则转为独立 bug 修复。
