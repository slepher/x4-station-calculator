# station-derived-map Review Tasks

## Tasks

### Phase R1: 清理 map 层身份泄漏

- [x] R1. 删除 `StationDerivedMap` 中的 `computeSemanticForPlan(...)`
- [x] R2. 删除 `StationDerivedMap` 中的 `computeSemanticForArchive(...)`
- [x] R3. 检查 `StationDerivedMap` 对外公开 API，确认只保留功能型命名
- [x] R4. 禁止在 `StationDerivedMap` 中出现 `plan` / `archive` / `binding` / `live` 身份词

### Phase R2: 提供纯功能写口

- [x] R5. 在 `StationDerivedMap` 中保留 flow 计算入口
- [x] R6. 在 `StationDerivedMap` 中新增 `setSemantics(stationId, semantics)`
- [x] R7. 保证 map 层写 semantics 不需要感知来源身份

### Phase R3: 上移 semantic builder

- [x] R8. 新增或整理 `buildStationSemantics(...)` 纯逻辑函数
- [x] R9. 新增或整理 `buildArchiveSemantics(...)` 纯逻辑函数
- [x] R10. 复用现有 `classifyPlayerStationPoi(...)`、`buildAggregatedModulesFromStationPlan(...)`、archive 自带 semantic 字段与 fallback 规则
- [x] R11. 禁止在 builder 之外分散复制 `tag/factoryGroup/productionProfile/profileName` 组装逻辑

### Phase R4: 收口上层场景入口

- [x] R12. 在 planning 路径提供初始化入口：一次性写入 flow 与 semantics
- [x] R13. 在 archive 路径提供初始化入口：计算 flow，并写入 archive 自带 semantics 与 fallback 补齐结果
- [x] R14. 在 plan module 变动路径提供重算入口：同时更新 flow 与 semantics
- [x] R15. 在 plan setting 变动路径提供 flow-only 重算入口：只更新 flow，不更新 semantics
- [x] R16. 禁止调用方继续手工散落组合"compute + identity-specific semantic method"

### Phase R5: 替换调用点

- [x] R17. 更新 `useBlueprintProductionStore`，移除对 map 层身份型 semantic API 的调用
- [x] R18. 更新 `useLiveProductionStore`，移除对 map 层身份型 semantic API 的调用
- [x] R19. 校正初始化路径，保证 plan 与 archive 分别走各自固定入口
- [x] R20. 校正模块变动与 setting 变动路径，保证按场景矩阵执行

### Phase R6: 文档与验证

- [x] R21. 同步更新 `station-derived-map` 的 request/design/spec/tasks，使其与本 review 保持一致
- [x] R22. 运行 `npm run build`

## 强制矩阵

### 初始化

- [x] plan 初始化必须计算 flow + semantics
- [x] archive 初始化必须计算 flow + 写入 archive 自带 semantics + fallback 补齐

### 变更

- [x] module 变动必须更新 flow + semantics
- [x] setting 变动必须只更新 flow

## 禁止事项

- [x] 禁止在 map 层保留任何身份型 compute API
- [x] 禁止把 archive 路径改造成与 plan 对称的"semantic 重算路径"
- [x] 禁止把来源分流逻辑继续下沉到 `StationDerivedMap`
- [x] 禁止在调用方继续分散复制 semantic 组装代码
- [x] 禁止在 review 修复完成前继续扩展新的 semantics 字段