# map-resources-split 设计

## 目标

将地图主数据与资源副数据解耦，形成：

- `maps.json`: 纯地图结构文件
- `map_resources.json`: 纯地图资源文件

这样 `x4_data_processor.py` 与 `x4_resource_processor.py` 的输出边界清晰，前端也能明确区分“地图结构读取”和“资源能力读取”。

## 现状问题

当前链路存在三个耦合点：

1. `maps.json` 同时承载地图结构与资源字段，导致文件职责混杂
2. `x4_resource_processor.py` 会基于资源计算结果回写 `maps.json.sector.resources`
3. 前端地图组件与资源面板存在多处直接读取 `maps.sectors[*].resources` 的历史遗留路径

这使得地图主文件无法稳定作为“纯地图快照”，也使资源处理命令对主文件有副作用。

## 目标输出模型

### maps.json

保留：

- `clusters`
- `sectors`
- cluster / sector / zone / highway / link / owner / sunlight / name / 坐标 / khaak 等结构字段

移除：

- `sectors[*].regions`
- `sectors[*].resources`

原则：`maps.json` 不承载任何资源定义、资源引用、资源结果。

### map_resources.json

建议结构：

```json
{
  "version": "9.0",
  "resource_model": "resourceareas",
  "sectors": {
    "cluster_01_sector001_macro": {
      "regions": [],
      "resources": [],
      "areas": []
    }
  },
  "regionyield_definitions": []
}
```

说明：

- `sectors[*].regions`
  - 原 `maps.json.sector.regions`
  - 作为资源输入引用层保留在副文件中
- `sectors[*].resources`
  - 原 `maps.json.sector.resources`
  - 作为前端直接消费的 sector 级摘要
- `sectors[*].areas`
  - 原 `resourceareas.json` 中分组到该 sector 的 area 数据
- `regionyield_definitions`
  - `9.0` 有效，`8.0` 输出空数组即可

## 处理链路设计

### Step A: x4_data_processor.py

职责收敛为纯地图生成：

- 解析地图 XML
- 写出 `maps.json`
- 不向 sector 注入 `regions/resources`
- 不依赖资源处理步骤产物

`8.0` 与 `9.0` 在此阶段都只输出纯地图。

### Step B: x4_resource_processor.py

职责收敛为资源副文件生成：

- 读取 `maps.json` 获取 sector 索引与基础结构
- 结合 `regions.json` / `resourceareas` / `mapdefaults` / `regionyield_definitions`
- 生成统一的 `map_resources.json`
- 不回写 `maps.json`

### 8.0 处理

`8.0` 下 `map_resources.json` 需要聚合：

- `regions` 引用关系
- `resources` sector 摘要
- `areas` 明细（原 `resourceareas.json`）

### 9.0 处理

`9.0` 下 `map_resources.json` 需要聚合：

- `mapdefaults` 中的 `resourcearea ref`
- `resources` sector 摘要
- `areas` 明细
- `regionyield_definitions`

## 前端数据流设计

### Loader

`useGameData.ts` 增加 `map_resources.json` 加载项，形成并行加载：

- `maps`
- `mapResources`

### Store

`useGameDataStore` 增加 `mapResources` 状态。

`useMapStore` 或对应 presenter 层负责把：

- `maps` 中的结构信息
- `mapResources` 中的资源信息

组装为界面需要的 sector 视图数据。

### Vue 消费约束

新方案中，Vue 组件不再直接从 `gameDataStore.maps.sectors[*]` 获取资源字段。

地图 tooltip、资源筛选、扇形着色、资源徽标等逻辑应通过：

- store
- presenter / logic

拿到统一组装后的 sector 资源视图。

## 迁移顺序

### Phase 1

先引入 `map_resources.json` 输出与类型，不立即删除旧输出文件。

### Phase 2

前端切换读取 `map_resources.json`。

### Phase 3

移除 `maps.json` 中的资源字段写入。

### Phase 4

清理前端对旧 `sector.resources` 的历史直连读取。

## 风险与控制

### 风险 1: 前端遗漏直连点

地图资源相关组件目前存在多处直接读取 `sector.resources`。

控制方式：

- 先全局检索消费点
- 统一迁移到 store / presenter
- 最后再删除旧字段

### 风险 2: 8.0 与 9.0 外部结构不统一

控制方式：

- 以 `sectorId -> { regions, resources, areas }` 为统一外部形状
- 差异字段仅保留在顶层元数据（如 `resource_model`、`regionyield_definitions`）

### 风险 3: 资源处理仍隐式修改 maps

控制方式：

- 明确禁止 `x4_resource_processor.py` 写回 `maps.json`
- 将 sector 资源聚合结果只写入 `map_resources.json`

## 结果

完成后，地图主文件与资源副文件将具备稳定的职责边界：

- `maps.json` 可独立重建、独立缓存、独立作为地图域输入
- `map_resources.json` 可独立重建、独立替换，不影响主地图结构
