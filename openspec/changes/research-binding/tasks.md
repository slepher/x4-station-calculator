# tasks.md - research-binding

## 实施任务

### 1. 定义 save research runtime 类型

- [x] 新增或扩展 save binding 类型，包含 `SaveResearchRuntime`。
- [x] archive 顶层类型增加 `research?: SaveResearchRuntime`。
- [x] `PlayerStationsRecord.data` 增加 `research` 字段，并兼容旧数据缺失。

### 2. rust parser 接入 player research 解析

- [x] 在解析 component 时识别 `class="player"`。
- [x] 在解析 component 时识别 `class="production"` 且 `macro="landmarks_player_hq_01_research_macro"` 的 HQ research module。
- [x] 将 research 解析作为现有流式 parser 的分支接入，复用当前 reader、component stack 和 builder。
- [x] 不新增从 save XML 文件开头重新读取/重新扫描的解析流程。

### 3. 解析 visibleIds

- [x] 在 player component 内识别 `<entries type="researchables">`。
- [x] 读取直接子 `<entry id="research_...">`。
- [x] 写入 `archive.research.visibleIds`。
- [x] 忽略 `read="0"` 等 UI 未读状态。

### 4. 解析 completedIds

- [x] 在 player component 内识别直接子 `<research>` block。
- [x] 读取直接子 `<research ware="research_..." method="research"/>`。
- [x] 写入 `archive.research.completedIds`。
- [x] 不输出 method。

### 5. 解析 activeId

- [x] 在 HQ research module production component 内识别 `<production><queue ware="research_..." method="research">`。
- [x] 若存在 research queue，写入 `archive.research.activeId = queue@ware`。
- [x] 若不存在 research queue，写入 `null`。
- [x] 不输出 production state、start/end、insufficient resources。
- [x] 不从 visible/completed 差集推断 active。

### 6. 更新 IndexedDB archive 分离与合并

- [x] `stripPlayerStationsFromArchive()` 剥离 `research`。
- [x] `extractPlayerStationsData()` 写入 `data.research`，缺失时使用默认空结构。
- [x] `mergePlayerStationsIntoArchive()` 合并回 archive。
- [x] 保持现有 Dexie schema/table 不变。

### 7. 构建验证

- [x] 执行 `npm run build`。
- [x] 使用已有 save XML fixture 或手动样本确认 archive JSON 中包含 `research`。
- [x] 确认旧 IndexedDB 记录缺失 `research` 时不报错。
