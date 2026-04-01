# Tasks: Save Import

## Task List

### T1: 类型定义与Store

**Scope**: 定义存档数据类型和创建 `useSaveStore`

**Files**:
- `src/types/saveArchive.ts` - 存档数据类型
- `src/store/useSaveStore.ts` - 存档Store

**Steps**:
1. 定义 `SaveArchive`, `SectorData`, `StationEntry`, `DatavaultEntry`, `AbandonedShipEntry` 类型
2. 定义 `ArchiveGroup` 类型
3. 创建 `useSaveStore` (Pinia)
4. 实现 `addArchive`, `selectArchive`, `removeArchive`, `exportToJson` 方法
5. 不实现持久化（仅内存存储）

---

### T2: 流式解析链路

**Scope**: 实现原始字节上传、Rust/SAX 解析与流式进度链路

**Files**:
- `src/components/save/saveUploadStreaming.ts`
- `src/workers/saveParserRust.worker.ts`
- `src/workers/saveParser.worker.ts`
- `rust-parser/src/model.rs`
- `rust-parser/src/core.rs`
- `rust-parser/src/stream.rs`

**Steps**:
1. 创建上传桥接模块，按 `parse_start / parse_chunk / parse_end` 协议发送原始文件字节
2. 在 Rust worker 中维护解析会话，承接 `expectedTotalBytes/currentVersion`、chunk 推进与完成收尾
3. 在 Rust 端实现 gzip 检测、header/trailer 处理与增量 gunzip，不再依赖浏览器 `DecompressionStream`
4. 保留 SAX 解析链路作为备用/CLI 默认解析器
5. 实现目标对象提取：stations, datavaults, erlkingVaults, abandonedShips
6. 实现坐标累加（position 栈）
7. 提取存档元信息：guid, seed, time, playerName, version
8. 实现流式进度报告与 `finalizing` 阶段补发
9. 实现早期版本校验（解析到 game 标签时立即校验）

---

### T3: 上传界面组件

**Scope**: 实现上传面板

**Files**:
- `src/components/save/SaveUploadPanel.vue`

**Steps**:
1. 创建拖拽上传区域UI
2. 创建文件选择按钮
3. 支持 .xml, .xml.gz, .json 文件类型
4. 文件上传后判断类型
5. XML/XML.GZ → 启动流式上传并驱动 Worker 解析
6. JSON → 直接加载（跳过解析）
7. JSON导入时校验 `meta.version`
8. 显示上传状态和进度
9. 进度条宽度直接绑定 worker 返回的 `percent`

---

### T4: 存档列表组件

**Scope**: 实现存档列表（按guid分组）

**Files**:
- `src/components/save/SaveList.vue`
- `src/components/save/SaveListItem.vue`

**Steps**:
1. 从Store读取archives数据
2. 按guid分组显示
3. 分组标题使用playerName
4. 组内按time降序排列
5. 每个存档项显示时间信息
6. 显示版本兼容状态（不匹配时标记）
7. 点击存档项触发选中事件
8. 每个存档项提供"下载JSON"按钮

---

### T5: 详情面板组件

**Scope**: 实现存档详情展示

**Files**:
- `src/components/save/SaveDetailPanel.vue`
- `src/components/save/SectorDetailList.vue`

**Steps**:
1. 创建详情面板容器
2. 未选中时显示提示信息
3. 选中后展示存档详情
4. 按sector分组展示
5. 展示stations列表（名称/坐标/owner）
6. 展示datavaults列表
7. 展示erlkingVaults列表（单独类型）
8. 展示abandonedShips列表
9. Sector名称显示翻译后名称

---

### T6: 主视图容器

**Scope**: 组合所有子组件

**Files**:
- `src/components/save/SaveImportView.vue`

**Steps**:
1. 创建主视图容器
2. 左侧放置SaveUploadPanel和SaveList
3. 右侧放置SaveDetailPanel
4. 连接Store状态
5. 处理上传事件 → Store.addArchive
6. 处理选中事件 → Store.selectArchive
7. 处理下载事件 → Store.exportToJson

---

### T7: TopViewSwitch集成

**Scope**: 新增存档同步Tab

**Files**:
- `src/components/common/TopViewSwitch.vue`

**Steps**:
1. 在 `defaultTabs` 新增 `{ key: 'save-import', label: t('view.save_import') }`
2. 设置 activeClass 为合适的样式
3. 确保Tab切换逻辑正常工作

---

### T8: MainWorkbench集成

**Scope**: 渲染SaveImportView

**Files**:
- `src/components/MainWorkbench.vue`

**Steps**:
1. 新增 `const isSaveImportView = computed(() => shipBuildStore.activeView === 'save-import')`
2. 导入SaveImportView组件
3. 新增条件渲染: `<SaveImportView v-else-if="isSaveImportView" />`
4. 确保视图切换逻辑正确

---

### T9: JSON导出功能

**Scope**: 实现JSON下载

**Files**:
- `src/utils/saveJsonFormat.ts`

**Steps**:
1. 定义标准JSON格式校验函数
2. 实现JSON生成函数（符合导出格式）
3. 实现下载触发（使用URL.createObjectURL + <a download>）
4. 文件名生成: `{playerName}_{guid}_{seed}.json`

---

### T10: 国际化文本

**Scope**: 添加中英文UI文本

**Files**:
- `src/locales/en.json`
- `src/locales/zh-CN.json`

**Steps**:
1. 新增 `view.save_import` 文本
2. 新增上传相关文本（拖拽提示、文件类型等）
3. 新增列表相关文本（时间格式、版本提示等）
4. 新增详情相关文本（sector、类型名称等）

---

### T11: 构建验证

**Scope**: 确保构建成功

**Steps**:
1. 运行 `npm run build`
2. Rust 相关改动后运行 `cargo test`
3. Rust 相关改动后运行 `./build.sh`
4. 修复所有编译错误
5. 重新运行build直到成功

## Task Dependencies

```
T1 (types/store) → T3, T4, T5, T6
T2 (worker) → T3
T3 (upload) → T6
T4 (list) → T6
T5 (detail) → T6
T6 (view) → T7, T8
T9 (export) → T4
T10 (i18n) → T7
T11 (build) ← all tasks
```

## Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| T1 | pending | |
| T2 | pending | |
| T3 | pending | |
| T4 | pending | |
| T5 | pending | |
| T6 | pending | |
| T7 | pending | |
| T8 | pending | |
| T9 | pending | |
| T10 | pending | |
| T11 | pending | |
