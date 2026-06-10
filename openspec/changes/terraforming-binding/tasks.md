# tasks.md - terraforming-binding

## 实施任务

### 1. 定义 save terraforming runtime 类型

- [x] 新增或扩展 save binding 类型，包含 `SaveTerraformingCluster`、`SaveTerraformingProjectProgress`、`SaveTerraformingCompletedProject`、`SaveTerraformingEventProgress`、`SaveTerraformingRebateAmount`。
- [x] archive 顶层类型增加 `terraforming_clusters?: Record<string, SaveTerraformingCluster>`。
- [x] `PlayerStationsRecord.data` 增加 `terraforming_clusters` 字段，并兼容旧数据缺失。

### 2. rust parser 维护 cluster 上下文

- [x] 在解析 component 时识别 `class="cluster"`。
- [x] 保存当前 cluster component 的 `macro` 作为 `clusterId`。
- [x] 在 `<terraforming>` block 开始时绑定当前 `clusterId`。
- [x] 解析完成后以 `clusterId` 写入 archive 的 `terraforming_clusters`。
- [x] 将 terraforming 解析作为现有流式 parser 的分支接入，复用当前 reader 和 builder。
- [x] 将 terraforming 状态机拆分到 `rust-parser/src/terraforming.rs`，`core.rs` 只负责事件分派。
- [x] 不新增从 save XML 文件开头重新读取/重新扫描的解析流程。
- [x] 在 `</universe>` 后提前完成解析，不继续扫描后续日志和脚本运行时顶层块。

### 3. 解析 terraforming block 属性与 stats

- [x] 解析 `part`, `seed`, `active`, `aborted`, `missioncue`, `missioncomplete`。
- [x] 解析 `<stats><stat id value/>` 为 `stats`。
- [x] 空 `active` 不生成 activeProject。

### 4. 解析 project runtime 状态

- [x] 遍历 `<projects><project>`。
- [x] 带 `completed` 属性的顶层 project 输出到 `completedProjects`，并将属性值保存为 `completedCount`。
- [x] `id === active` 输出为 `activeProject`，`aborted="1"` 时仍保持 active 分类并标记 `aborted=true`。
- [x] 非 active 且存在持久资源进度的 project 输出到 `retainedProjects`，不因存在 `completed` 属性而排除。
- [x] 解析 `starttime` 为 `startTime`，不推导完成时间。

### 5. 解析资源进度

- [x] 从 `<scaledresources>` 解析 `scaledResources`。
- [x] 从 `<deliveredresources>` 解析 `submittedResources`。
- [x] 从 `<ships>` cargo 汇总 `inTransitResources`。
- [x] 将 `<ships>` 下直接子 `<ship>` 数量输出为 number 型 `inTransitShipBatches`。
- [x] 没有在途飞船时不输出 `inTransitResources` 和 `inTransitShipBatches`。
- [x] 不做 ship id 到全局 ship component macro 的匹配。
- [x] 不输出 buildtasks/建造中 drone 作为进度。

### 6. 解析 events 与 rebates

- [x] 只输出带 `completed` 属性的 event。
- [x] event 输出 `eventId`, `completedCount`, `startTime?`。
- [x] 解析 `<rebates>` 为 cluster runtime 累计值
  - 存档 XML 使用 `value` 属性（非 `amount`）：`<rebate waregroup="food" value="10"/>`
  - 仅捕获 `<terraforming>` 直子级 `<rebate>`（`project_depth == 0`），排除 `<project>` 内部的项目定义 rebates

### 7. 更新 IndexedDB archive 分离与合并

- [x] `stripPlayerStationsFromArchive()` 剥离 `terraforming_clusters`。
- [x] `extractPlayerStationsData()` 写入 `data.terraforming_clusters`。
- [x] `mergePlayerStationsIntoArchive()` 合并回 archive。
- [x] 保持现有 Dexie schema/table 不变。

### 8. 构建验证

- [x] 执行 `npm run build`。
- [x] 使用 `save_009.xml` 确认 archive JSON 中包含 `terraforming_clusters`，且 `cluster_26_macro.activeProject.inTransitShipBatches === 126`。
- [ ] 确认旧 IndexedDB 记录缺失 `terraforming_clusters` 时不报错。
