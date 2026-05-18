# map-resources-split 任务

## [x] T1: 定义地图资源副文件类型

- 文件: `src/types/x4.ts`
- 新增 `X4MapResources`、`X4MapSectorResources`、`X4MapResourceAreaGroup` 等类型
- 从地图类型中删除 `sector.regions` / `sector.resources` 的正式定义
- 明确 `maps` 与 `mapResources` 的领域边界

## [x] T2: 扩展资源输出路径

- 文件: `scripts/processor/path_utils.py`
- 新增 `map_resources.json` 输出路径定义
- 更新需要读取输出路径的脚本配置

## [x] T3: 调整 x4_data_processor 地图输出边界

- 文件:
  - `scripts/x4_data_processor.py`
  - `scripts/x4_map_processor.py`
  - `scripts/processor/step1_map/service.py`
  - `scripts/processor/step1_map/generator.py`
- 移除向 `maps.json` 注入 `sector.regions` / `sector.resources` 的逻辑
- 保证 `maps.json` 只输出纯地图结构

## [x] T4: 设计并实现 map_resources.json 生成

- 文件:
  - `scripts/x4_resource_processor.py`
  - `scripts/processor/step2_resource/service.py`
  - `scripts/processor/step2_resource/modern_processor.py`
- 统一生成 `map_resources.json`
- 保持 `8.0` / `9.0` 输出统一外部结构
- 禁止回写 `maps.json`

## [x] T5: 聚合 8.0 资源数据到新副文件

- 文件: `scripts/processor/step2_resource/service.py`
- 将 `8.0` 的：
  - `regions`
  - sector `resources`
  - `resourceareas`
  聚合到 `map_resources.json.sectors[sectorId]`

## [x] T6: 聚合 9.0 资源数据到新副文件

- 文件:
  - `scripts/processor/step2_resource/service.py`
  - `scripts/processor/step2_resource/modern_processor.py`
- 将 `9.0` 的：
  - `regions`
  - sector `resources`
  - `areas`
  - `regionyield_definitions`
  聚合到 `map_resources.json`

## [x] T7: 扩展前端 loader

- 文件: `src/store/logic/useGameData.ts`
- 在 `GameDataFiles` 中新增 `mapResources`
- 增加 `map_resources.json` 的 bundle loader
- 让 `maps` 与 `mapResources` 并行加载

## [x] T8: 扩展 gameData store

- 文件: `src/store/useGameDataStore.ts`
- 新增 `mapResources` 状态
- 初始化时加载并保存 `mapResources`
- 保持现有地图结构读取能力不变

## [x] T9: 收口地图资源读取到 store / presenter

- 文件:
  - `src/store/useMapStore.ts`
  - `src/store/logic/mapResourceFilter.ts`
  - `src/store/logic/mapAdvancedResourceFilter.ts`
- 使用 `mapResources` 作为资源来源
- 保证资源筛选、tooltip、扇形覆盖等逻辑不再依赖 `maps.sectors[*].resources`

## [x] T10: 调整地图组件消费入口

- 文件:
  - `src/components/map/MapWorkbenchView.vue`
  - `src/components/map/layers/MapSectorLayer.vue`
  - `src/components/map/MapSectorTooltip.vue`
  - `src/components/map/MapResourceFilterSimplePanel.vue`
  - `src/components/map/MapResourceFilterAdvancedPanel.vue`
- 移除组件内直接读取 `maps.sectors[*].resources` 的逻辑
- 改为读取 store / presenter 提供的统一资源视图

## [x] T11: 清理历史 maps 资源字段依赖

- 文件: 全局检索 `sector.resources` / `sector.regions` 相关消费点
- 清理剩余直接依赖
- 确认资源 UI 已全部切换到 `map_resources.json`

## [x] T12: 构建验证

- 文件: 无新增文档范围外代码
- 完成实现后执行构建验证，确保地图主文件与资源副文件边界成立
- 验证 `x4_data_processor.py` 与 `x4_resource_processor.py` 可独立运行
