# map-json-refactory Tasks

## Phase 1: 类型与数据契约重定义

### T1.1 重定义地图类型

- [x] 修改 `src/types/x4.ts` 中 `X4Map`、`X4MapCluster`、`X4MapSector` 的结构定义
- [x] 去除 `cluster.sectors` 作为正式主结构的类型入口
- [x] 为 `Cluster` 增加 `sectors: string[]` 轻量关联字段
- [x] 为 `Sector` 明确保留 `cluster_id: string`
- [x] 明确 cluster / sector 相关引用字段统一小写

### T1.2 收敛地图域辅助类型

- [x] 更新 `src/components/map/types.ts` 与其他直接复用 map 类型的辅助定义
- [x] 清理依赖旧结构命名的局部类型假设

## Phase 2: `maps.json` 生成链路硬切

### T2.1 修改地图处理脚本输出

- [x] 修改 `scripts/x4_data_map_processor.py` 直接生成顶层 `clusters` 与顶层 `sectors`
- [x] 确保 cluster / sector id 及相关引用字段在输出阶段全部转为小写
- [x] 调整相关 processor/service 层，避免回写旧结构

### T2.2 更新静态数据产物

- [x] 基于新处理逻辑更新仓库中的 `maps.json`
- [x] 确认静态产物中不存在旧大写 id 与 `cluster.sectors` 主结构

## Phase 3: 运行时消费逻辑切换

### T3.1 修改基础读取与索引逻辑

- [x] 更新 `src/store/logic/useGameData.ts`、`src/store/useGameDataStore.ts`
- [x] 更新 `src/store/useMapStore.ts` 的 sector 解析与索引构建
- [x] 更新 `src/utils/saveParserConfig.ts` 的 sector 名称与坐标加载
- [x] 更新 `src/utils/saveResourceExtract.ts` 的 sector 枚举与资源关联

### T3.2 修改地图渲染与搜索逻辑

- [x] 更新 `src/components/map/**` 中对 cluster / sector 结构的访问
- [x] 更新 `src/utils/mapSearch.ts` 与 `MapWorkbenchView.vue` 中的 cluster id / sector id 假设
- [x] 更新 `src/store/logic/mapAdvancedResourceFilter.ts` 对 cluster gate / sector 图的读取方式
- [x] 将共享 sector 图构建 / BFS 逻辑从 `mapAdvancedResourceFilter.ts` 抽离到独立 helper，避免 `station-binding` 继续耦合 resource filter 模块
- [x] 更新 `savePoiSearchFilter`、`MapResourceFilterAdvancedPanel` 与相关单测到新的共享拓扑 helper

### T3.3 修改 save parser 与导入导出相关逻辑

- [x] 更新 `src/workers/saveParser.post.ts` 中 zone、sector center、scale basis 等 lookup 构建逻辑
- [ ] 更新 `src/store/logic/importExport.ts` 等直接持有 `X4Map` 的使用点

### T3.4 修改 `station-binding` 对新结构的依赖

- [x] 更新 `MapBindingPanel.vue`、`MapBindingSectorGroup.vue`、`MapBindingStation.vue` 对 sector 明细的读取方式，统一改为顶层 `maps.sectors`
- [x] 更新 `saveBindingUtils.ts` 与 `useMapBindingViewModel.ts`，使 coverage 图构建基于 `clusters + sectors`
- [x] 去除 `station-binding` 组件内分散的 `sectorMacro.toLowerCase()` 比较，改为直接比较规范化后的小写 macro/id
- [ ] 复查 `station-binding` 与高级资源页是否仍存在共享拓扑 helper 抽离后的行为回归；若存在，转为独立 bug 处理

## Phase 4: 脚本与分析工具同步

### T4.1 更新直接依赖 `maps.json` 的脚本

- [x] 更新 `scripts/extract_resources.py`
- [x] 更新 `scripts/extract_resources.tsx`
- [x] 更新 `scripts/extract_save.tsx`
- [ ] 更新仓库内直接遍历旧 `maps.json` 结构的分析脚本

## Phase 5: 测试与夹具同步

### T5.1 更新 mock / fixture / 单元测试数据

- [ ] 更新直接 mock `maps.json` 的测试样例为新结构
- [ ] 统一测试中的 cluster / sector id 为小写
- [ ] 删除断言中对旧 `cluster.sectors` 主结构的依赖

### T5.2 更新断言与构建预期

- [ ] 更新 map-search、map-resource-filter、map-tooltip、user-save-map 等相关测试断言
- [ ] 确认测试描述与夹具结构不再引用旧格式
- [x] 更新 `advanced-resource-filter` 单测中对 `buildSectorGraph` 的旧结构 mock，改为新结构输入

## Task Dependencies

```text
T1.1 -> T1.2 -> T2.1 -> T2.2 -> T3.1 -> T3.2 -> T3.3 -> T3.4 -> T4.1 -> T5.1 -> T5.2
```
