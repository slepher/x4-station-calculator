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
5. 实现 IndexedDB 持久化与列表/详情读取
6. 为 `SaveArchive.meta` 增加 `parser_version/post_processor_version`
7. 为 `SaveArchive` 增加 `isValid`
8. 在初始化时按版本规则恢复缓存：
   - `parser_version` 不匹配 → 标记无效
   - `post_processor_version` 不匹配 → 自动重跑 `postProcess`

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
4. 冻结 SAX 解析链路为备用/CLI 默认解析器，不再继续添加新的业务提取功能
5. 在 Rust 解析链路中实现 sector `owner` 提取
6. 在 Rust 解析链路中将 station 按 `player/xenon/khaak/npc` 四组分类，并输出为 `playerStations/xenonStations/khaakStations/npcStations`
7. 在 Rust 解析链路中为 `npcStations/xenonStations/khaakStations` 提取聚合模块 `modules: [{ ref, amount }]`
8. 在 Rust 解析链路中为 `npcStations/xenonStations` 提取 `isShipyard/isWharf/isEquipmentdock/isTradestation`
9. 保持 `khaakStations` 不参与上述 `is*` 判定
10. 在 Rust 解析链路中为 `khaakStations` 提取 `isNest/isHive`
11. 将上述 `npc/xenon/khaak` 的派生判定落实在 `src/workers/saveParserRust.worker.ts` 层，而不是 `rust-parser/src/core.rs`
12. 在 Rust 解析链路中为 datavaults 与 erlkingVaults 提取 `unlocked`
13. 在 Rust 解析链路中为 datavaults 与 erlkingVaults 提取聚合 `wares: [{ ware, amount }]`
14. 保留目标对象提取：abandonedShips
15. 实现坐标累加（position 栈）
16. 提取存档元信息：guid, seed, time, playerName, version
17. 实现流式进度报告与 `finalizing` 阶段补发
18. 实现早期版本校验（解析到 game 标签时立即校验）
19. Rust parser 原始输出写入 `parser_version = v2`

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
10. XML 导入完成后统一经过 TS `postProcess` 再写入 Store/DB

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
9. 显示 `isValid` 无效存档状态

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
5. 展示 sector `owner`
6. 分别展示 `playerStations/xenonStations/khaakStations/npcStations`
7. `npcStations/xenonStations/khaakStations` 显示聚合模块列表 `modules: [{ ref, amount }]`
8. `npcStations/xenonStations` 显示 `isShipyard/isWharf/isEquipmentdock/isTradestation`
9. `khaakStations` 显示 `isNest/isHive`
10. 展示 datavaults 的 `unlocked` 与聚合 `wares`
11. 展示 erlkingVaults 的 `unlocked` 与聚合 `wares`
12. 展示abandonedShips列表
13. Sector名称显示翻译后名称
14. `isValid=false` 时显示需要重新导入的提示

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
5. 新增无效存档相关文本与提示

---

### T11: CLI --skip-post 参数

**Scope**: extract_save.tsx 增加 --skip-post 参数

**Files**:
- `scripts/extract_save.tsx`

**Steps**:
1. [x] 在 parseArgs 中添加 `--skip-post` 参数解析
2. [x] 在 printUsage 中添加参数说明
3. [x] extractSaveWasm 中根据 skipPost 决定是否调用 postProcessRustSaveArchive
4. [x] skipPost=true 时输出原始解析数据（未经过后处理）
5. [x] loadModulesByMacroId 函数：根据版本号加载 modules.json，构建 modulesByMacroId 映射
6. [x] postProcessRustSaveArchive 接收 modulesByMacroId 参数进行 module 信息填充

---

### T12: saveParser.post.ts 重构

**Scope**: 后处理逻辑重构，从 worker 移到上传流程

**Files**:
- `src/workers/saveParserRust.post.ts` → `src/workers/saveParser.post.ts`（重命名）
- `src/workers/saveParserRust.worker.ts`（更新导入）
- `src/components/save/SaveUploadPanel.vue`（直接调用后处理）
- `src/types/saveArchive.ts`（扩展 AggregatedStationModule 类型）

**Steps**:
1. [x] 重命名文件 saveParserRust.post.ts → saveParser.post.ts
2. [x] 更新所有导入引用
3. [x] AggregatedStationModule 新增可选字段：module_id, type, group
4. [x] 新增函数 enrichModulesWithGameData(modules, modulesByMacroId)
   - 遍历 modules，根据 ref (macro) 匹配 modulesByMacroId
   - 匹配成功：填充 module_id, type, group
   - 匹配失败：字段保持 undefined
5. [x] 修改 postProcessRustSaveArchive 签名，接收 modulesByMacroId 参数
6. [x] 修改 tag 判断逻辑：
   - isFactory: 改为检查 modules 中是否有 type === 'production'
   - factoryGroup: 新增字段，按优先顺序匹配（shiptech → hightech → refined → pharmaceutical → food → agricultural → water → energy → 'factory'）
   - isDefencemodule: 改为检查 modules 中是否有 type === 'defencemodule'
   - tag 优先级调整为：piratebase → shipyard → wharf → equipmentdock → factory → tradestation → defencemodule → fallback
7. [x] SaveUploadPanel.vue 中：
   - worker 完成后获取原始 archive
   - 调用 postProcessRustSaveArchive(archive, gameDataStore.modulesByMacroId)
   - emit 处理后的 archive
8. [x] 定义 `CURRENT_PARSER_VERSION = "v2"`
9. [x] 定义 `CURRENT_POST_PROCESSOR_VERSION = "v2"`
10. [x] `postProcessRustSaveArchive` 写入 `post_processor_version`
11. [x] `postProcessRustSaveArchive` 计算 `isValid`
12. [x] 基于 `zone_id + maps.zones` 补全最终 `position`
13. [x] `zone_id` 查表统一使用小写
14. [x] 兼容 `maps.zones` 对象结构
15. [x] 停止依赖独立 `shcon_anchors`

---

### T13: 地图数据与消费方同步

**Scope**: 同步 maps 结构迁移到 save-import 相关链路

**Files**:
- `scripts/processor/map/generator.py`
- `scripts/processor/step1_map/generator.py`
- `scripts/x4_data_map_processor.py`
- `src/assets/x4_game_data/*/data/maps.json`
- `src/components/empire/MapSaveArchiveList.vue`

**Steps**:
1. [x] 将 `zones` 从数组改为对象，主键为 `ref/id`
2. [x] 将 map 处理链路中的 `zone_id` 统一为小写
3. [x] 将 `shcon_anchors` 并回 `zones`
4. [x] 修改所有消费 `shcon_anchors` 的代码为直接消费 `zones`
5. [x] 地图侧对无效存档显示禁用态
6. [x] 地图侧无效存档不可进入二级菜单

---

### T14: 构建验证

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
T14 (build) ← all tasks
```

## Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| T1 | completed | 类型与 store 已扩展到 sector owner、四类 station、datavault unlocked/wares 结构 |
| T2 | completed | Rust 解析链已实现 station 分类、npc/xenon/khaak modules 聚合、datavault/erlking loot 提取；派生判定需求记录为后续在 saveParserRust.worker.ts 层处理；JS parser 冻结为兼容路径 |
| T3 | pending | |
| T4 | pending | |
| T5 | completed | SaveDetailPanel 已展示 sector owner、xenon/khaak/npc 分组、聚合模块与 vault unlocked/wares；派生标记展示待 worker 层产出后接入 |
| T6 | pending | |
| T7 | pending | |
| T8 | pending | |
| T9 | pending | |
| T10 | pending | |
| T11 | completed | 已支持 CLI `--skip-post` 与 postProcess 拆分 |
| T12 | completed | `saveParser.post.ts` 已承接版本常量、坐标后处理、模块 enrich 与 `isValid` 生成 |
| T13 | completed | `zones/shcon_anchors` 迁移完成，地图侧无效存档已禁止进入二级菜单 |
| T14 | completed | 已执行 rust-parser/build.sh；相关单测已覆盖版本恢复与无效存档交互 |
