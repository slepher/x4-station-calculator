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

### T3.3 修改 save parser 与导入导出相关逻辑

- [x] 更新 `src/workers/saveParser.post.ts` 中 zone、sector center、scale basis 等 lookup 构建逻辑
- [ ] 更新 `src/store/logic/importExport.ts` 等直接持有 `X4Map` 的使用点

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

## Task Dependencies

```text
T1.1 -> T1.2 -> T2.1 -> T2.2 -> T3.1 -> T3.2 -> T3.3 -> T4.1 -> T5.1 -> T5.2
```
