# resources-new 需求说明

## 目标
将地图资源数据处理链路扩展为按游戏版本分流：
- `9.0` 以下继续沿用旧版 `regions` 模型；
- `9.0` 及以上停止生成 `regions.json`，改为生成 `resourceareas.json`；
- `9.0` 及以上的 `regionyields.json` 不再承载资源语义，只输出空数组 `[]` 作为兼容占位。

## 已确认方案（审核重点）

### 1. 版本分流放在 Python 脚本内
- 不在版本配置文件中新增 `map_resource_model` 字段。
- 由 Python 数据处理脚本直接根据当前游戏版本号判定资源模型。
- 判定目标是“主版本号是否大于等于 `9`”。
- 该分流逻辑属于数据处理实现细节，不要求暴露到 `versions.json` 或其他前端配置中。

### 2. `9.0` 以下保持旧产物不变
- 继续生成 `maps.json`。
- 继续生成 `regions.json`。
- 继续生成旧结构的 `regionyields.json`。
- 旧版 `maps.json` 中的 `sector.resources` 继续由现有旧链路生成。

### 3. `9.0` 及以上切换到 `resourceareas.json`
- 不再生成 `regions.json`。
- 新增 `resourceareas.json` 作为新版资源主数据文件。
- `resourceareas.json` 分为两段：
  - 一段来自 `mapdefaults_final.xml` 中各 sector 的 `<resourceareas>` 列表；
  - 一段来自 `regionyields_final.xml` 中各 `definition` 的模板定义数据。
- 两段数据需要在同一个 JSON 文件中同时落地，避免前端或后续脚本做多文件 join。

### 4. `9.0` 及以上的 `regionyields.json` 固定输出空数组
- 继续落盘 `regionyields.json`，但内容固定为 `[]`。
- 目的不是提供新版资源数据，而是保持现有文件加载链路不因缺文件直接报错。
- 该空文件在语义上表示“此版本不再使用旧版 region yield 模型”。

### 5. `resourceareas.json` 的结构
- JSON 顶层包含：
  - `meta`
  - `sectorResourceAreas`
  - `definitions`
- `sectorResourceAreas` 按 `sector macro` 建立索引，保留每个 `resourcearea` 的：
  - `ref`
  - `amount`
- `definitions` 按 `definition id` 建立索引，至少保留：
  - `id`
  - `ware`
  - `tag`
  - `yield`
  - `respawnDelay`
  - `rating`
  - `radius`
  - `objectyieldfactor` 或 `gatherspeedfactor`
  - `sustainableYieldPerHour`

### 6. `maps.json` 继续保留兼容摘要
- 当前地图与资源筛选 UI 已消费 `maps.json` 中的 `sector.resources` 摘要。
- 本次变更不要求前端立即改为直接消费 `resourceareas.json`。
- 因此 `9.0` 及以上仍需要在生成 `maps.json` 时，从 `resourceareas.json` 对应源数据聚合出兼容型 `sector.resources`。
- 该摘要至少需要支持：
  - `ware`
  - `yield`
  - `level`
- 若实现成本可控，可同时补充：
  - `totalYield`
  - `sustainableYieldPerHour`

### 7. 旧版与新版解析逻辑必须完全隔离
- `9.0` 的 `regionyields_final.xml` 已不再是旧版 `<resource><yield>` 结构。
- 新版解析不得复用旧版 `migrate_regionyields()` 语义后强行兼容。
- 应明确拆分为旧链路与新版 `resourceareas` 链路，避免后续维护中继续混淆两个模型。

## 边界

### In Scope
- Python 数据处理脚本内按版本号分流资源模型。
- `9.0` 及以上新增 `resourceareas.json`。
- `9.0` 及以上停产 `regions.json`。
- `9.0` 及以上将 `regionyields.json` 固定输出为 `[]`。
- `9.0` 及以上从 `mapdefaults_final.xml` 与 `regionyields_final.xml` 生成新版资源数据。
- `9.0` 及以上继续为 `maps.json` 产出兼容型 `sector.resources` 摘要。

### Out of Scope
- 本次不要求前端立即改写为直接消费 `resourceareas.json`。
- 本次不要求删除前端对 `regionyields.json` 的加载代码。
- 本次不处理 `regionobjectgroups_final.xml` 或其他额外资源来源。
- 本次不引入资源产能 UI、星级面板或新的地图展示交互。

## 验收标准（DoD）
1. 当当前游戏版本小于 `9.0` 时，脚本输出保持现状，继续生成 `regions.json` 与旧结构 `regionyields.json`。
2. 当当前游戏版本大于等于 `9.0` 时，脚本不再生成 `regions.json`。
3. 当当前游戏版本大于等于 `9.0` 时，脚本会生成 `resourceareas.json`。
4. `resourceareas.json` 同时包含 sector 资源区引用数据与资源区模板定义数据。
5. 当当前游戏版本大于等于 `9.0` 时，`regionyields.json` 内容固定为 `[]`。
6. `maps.json` 在 `9.0` 及以上版本仍然包含可供现有地图资源 UI 使用的 `sector.resources` 摘要。
7. 旧版 `region` 解析逻辑与新版 `resourcearea` 解析逻辑在代码层面清晰分流，不复用错误的数据语义。

## 未决项
无。
