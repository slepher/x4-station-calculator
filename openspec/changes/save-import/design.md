# Design: Save Import

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      TopViewSwitch                               │
│  [量化生产] [星区地图] [逻辑组网] [船只建造] [存档同步]            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SaveImportView                               │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   SaveUploadPanel   │  │      SaveDetailPanel            │   │
│  │  ┌───────────────┐  │  │  ┌─────────────────────────┐    │   │
│  │  │ UploadZone    │  │  │  │ SectorList              │    │   │
│  │  │ (drag/select) │  │  │  │ - stations              │    │   │
│  │  └───────────────┘  │  │  │ - datavaults            │    │   │
│  │                     │  │  │ - erlkingVaults         │    │   │
│  │  ┌───────────────┐  │  │  │ - abandonedShips        │    │   │
│  │  │ SaveList      │  │  │  └─────────────────────────┘    │   │
│  │  │ (by guid)     │  │  │                                 │   │
│  │  │ - [download]  │  │  │                                 │   │
│  │  │ - [remove]    │  │  │                                 │   │
│  │  └───────────────┘  │  │                                 │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       useSaveStore                               │
│  - archives: Map<guid, ArchiveGroup>                            │
│  - selectedArchive: SaveArchive | null                          │
│  - isParsing: boolean                                           │
│  - parseProgress: string                                        │
│  - parseError: string | null                                    │
│  - archiveGroups: computed<ArchiveGroup[]>                      │
│  - totalArchiveCount: computed<number>                          │
│  - addArchive(save: SaveArchive)                                │
│  - selectArchive(guid: string, time: number)                    │
│  - clearSelection()                                             │
│  - removeArchive(guid: string, time: number)                    │
│  - clearAll()                                                   │
│  - exportToJson(guid: string, time: number)                     │
│  - importFromJson(jsonData: unknown)                            │
│  - checkVersionCompatibility(version: string)                   │
│  - setParsingState(parsing, progress, error)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 saveUploadStreaming.ts                           │
│  - File.stream() / Blob.slice() 原始字节读取                    │
│  - 发送 parse_start / parse_chunk / parse_end                   │
│  - 从 gzip trailer 预读 expectedTotalBytes                      │
│  - 不在 JS 侧执行 gunzip                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Rust Parser Worker                              │
│  - High-performance XML parsing (Rust WASM)                     │
│  - Raw byte session handling (parse_start/chunk/end)            │
│  - Incremental gunzip in WASM                                   │
│  - Extract: stations, datavaults, erlkingVaults, ships          │
│  - Accumulate coordinates (component offset stacking)           │
│  - Translate names ({page,id} → strings table)                  │
│  - Progress reporting (ProgressInfo)                            │
│  - CLI progress gating from Rust side                           │
│  - Optional performance profiling                               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### SaveArchive（存档实体）

```typescript
interface SaveArchive {
  meta: {
    guid: string          // 存档归属标识
    seed: number          // 存档独特性
    time: number          // 存档时间（游戏内秒）
    playerName: string    // 玩家名称（分组命名）
    version: string       // 游戏版本（如 "800"）
    filename: string      // 存档文件名（去扩展名）
    parser_version: 'v1' | 'v2'  // 解析器版本
    post_processor_version?: 'v1' | 'v2'  // 后处理版本
    source: 'original' | 'imported'  // 来源类型
  }
  sectors: Record<string, SectorData>
  isCompatible: boolean   // 版本兼容状态
  isValid: boolean        // parser_version 是否仍被当前代码接受
}

interface ProgressInfo {
  phase: 'receiving' | 'parsing' | 'finalizing' | 'done' | 'error'
  inputBytesTotal: number
  parsedBytesTotal: number
  bufferedBytes: number
  expectedTotalBytes: number
  percent: number
  tagCount: number
  sectorCount: number
  done: boolean
  inputComplete: boolean
  error: string | null
}

interface SectorData {
  name: string            // 翻译后名称
  is_known: boolean       // 是否已知
  owner?: string
  playerStations?: PlayerStationEntry[]
  xenonStations?: FactionStationEntry[]
  khaakStations?: FactionStationEntry[]
  npcStations?: NpcStationEntry[]
  datavaults?: DatavaultEntry[]
  erlkingVaults?: DatavaultEntry[]  // 同结构，单独类型
  abandonedShips?: AbandonedShipEntry[]
}

interface StationBaseEntry {
  code: string
  macro: string
  owner: string
  relative_position: { x: number; y: number; z: number }
  position: { x: number; y: number; z: number }
  zone_id?: string
  is_wreck?: boolean
  is_headquarter?: boolean
}

interface PlayerStationEntry extends StationBaseEntry {
  constructions?: PlayerStationConstruction[]
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
}

interface PlayerStationConstruction {
  index: number
  ref: string
  predecessor?: number
  equipments?: StationEquipment[]
}

interface NpcStationEntry extends StationBaseEntry {
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isTradestation?: boolean
}

interface FactionStationEntry extends StationBaseEntry {
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
}

interface AggregatedStationModule {
  ref: string
  amount: number
}

interface AggregatedEquipment {
  type: 'shields' | 'turrets'
  ref: string
  amount: number
}

interface StationEquipment {
  type: 'shields' | 'turrets'
  ref: string
  group: string
  exact: number
}

interface DatavaultEntry {
  code: string
  macro: string
  owner: string
  relative_position: { x: number; y: number; z: number }
  position: { x: number; y: number; z: number }
  zone_id?: string
  unlocked: boolean
  wares?: DatavaultWareEntry[]
  has_blueprints?: boolean
  has_wares?: boolean
  has_signalleak?: boolean
}

interface DatavaultWareEntry {
  ware: string
  amount: number
}

interface AbandonedShipEntry {
  code: string
  macro: string
  class: string  // ship_xs, ship_s, ship_m, etc.
  relative_position: { x: number; y: number; z: number }
  position: { x: number; y: number; z: number }
  zone_id?: string
}
```

### ArchiveGroup（存档分组）

```typescript
interface ArchiveGroup {
  guid: string
  playerName: string
  saves: SaveArchive[]  // 按 time 降序
}
```

### ArchiveMeta（IndexedDB 列表元数据）

```typescript
interface ArchiveMeta {
  id: string
  guid: string
  time: number
  playerName: string
  version: string
  filename: string
  parser_version: string
  post_processor_version?: string
  source: 'original' | 'imported'
  isCompatible: boolean
  isValid: boolean
  createdAt: Date
  sectorCount: number
}
```

### Map zones 数据

```typescript
interface X4Sector {
  zones?: Record<string, {
    id: string
    position: { x: number; y: number; z: number }
  }>
}
```

## Key Decisions

### Decision 1: Rust Worker Streaming

**问题**: 存档文件可达100MB+，直接解析会阻塞UI

**方案**: 使用 Rust Web Worker 执行高性能解析

**实现细节**:
- Worker 脚本: `src/workers/saveParserRust.worker.ts`（UI 默认路径）
- Worker 脚本（备用）: `src/workers/saveParser.worker.ts`（SAX / CLI 默认路径）
- 上传桥接模块: `src/components/save/saveUploadStreaming.ts`
- Rust 解析器源码: `rust-parser/`
- `src/workers/saveParser.worker.ts` 冻结为兼容/备用解析链，不再继续承载新的业务字段提取
- 后续业务演进只进入 Rust/WASM 解析链
- 上传链路采用三段式协议：
  - `parse_start`: 发送 `filename/currentVersion/expectedTotalBytes`
  - `parse_chunk`: 逐块发送原始文件字节
  - `parse_end`: 通知输入结束
- Web 端与 CLI 的 WASM 路径都只转发原始 `.xml` / `.xml.gz` 字节
- gzip 检测、header/trailer 处理、增量 gunzip 全部在 Rust/WASM 内完成
- Rust worker 内部维护 `RustParseSession`，负责 expected version / expected total bytes 设置、chunk 推进、`finalizing` 补发、进度节流与错误收尾
- 向主线程报告 ProgressInfo 进度
- 解析完成后一次性返回结果对象
- 可选性能分析（通过 `options.profile` 参数）
- **版本校验**: Worker 接收 `currentVersion` 参数
  - SAX Worker: 解析到 `<game>` 标签时立即校验，不匹配则抛出错误停止解析
  - Rust Worker: 调用 `set_expected_version()` 设置期望版本，解析到 `<game>` 标签时立即校验，不匹配则设置错误状态
- Rust parser 原始输出负责写入 `parser_version`
- TS 后处理负责写入 `post_processor_version`、计算 `isValid`、补全最终 `position`

**Worker消息格式**:
```typescript
// 主线程 → Worker
{
  type: 'parse_start' | 'parse_chunk' | 'parse_end',
  filename: string,
  currentVersion: string,  // 从 useGameDataStore.currentVersion 获取
  expectedTotalBytes?: number,
  chunk?: ArrayBuffer
}

// Worker → 主线程（版本不匹配）
{
  type: 'error',
  message: 'Version mismatch: save version X does not match current game version Y'
}
```

### Decision 2: parser/post-processor 双层版本管理

**问题**: 单一版本号无法区分“原始 parser 产物过期”和“后处理逻辑过期”。

**方案**:
- `parser_version` 表示 parser 原始产物版本
- `post_processor_version` 表示二次后处理产物版本

**实现细节**:
- 当前版本基线：
  - `parser_version = "v2"`
  - `post_processor_version = "v2"`
- IndexedDB 恢复时：
  - `parser_version` 不匹配：保留存档，但标记 `isValid = false`
  - `parser_version` 匹配且 `post_processor_version` 不匹配：自动重跑一次 `postProcess`

### Decision 3: 无效存档不可进入深层消费界面

**问题**: 旧 parser 产物不可信，但直接删除缓存会丢失列表上下文。

**方案**:
- 一级列表保留无效存档
- 详情区域明确提示需要重新导入
- 地图侧无效存档不可进入二级菜单

### Decision 4: 基于 maps.zones 统一补坐标

**问题**: parser 只能得到组件相对位置，不能保证是星区最终坐标；同时 `shcon_anchors` 与 `zones` 并存会增加消费复杂度。

**方案**:
- 原始数据保留 `relative_position`
- 后处理使用 `zone_id + maps.zones` 计算最终 `position`
- `zones` 改为对象结构，主键和 `zone_id` 统一小写
- `shcon_anchors` 并回 `zones`

**替代方案**: SAX解析（`sax-js`）
- 缺点: 性能较 Rust 版本慢
- 优点: 纯JS实现，调试方便
- 结论: 作为备用方案保留，UI使用Rust版本

### Decision 2: Coordinate Accumulation

**问题**: 游戏坐标系统采用component层级累加

**方案**: 解析时维护position栈

**实现细节**:
```typescript
// Worker内部逻辑
const positionStack: Vector3[] = []
let currentSector: string | null = null

// 进入component时
onopentag(component) {
  // 累加offset
  if (component.offset?.position) {
    positionStack.push({
      x: parseFloat(component.offset.position.x || 0),
      y: parseFloat(component.offset.position.y || 0),
      z: parseFloat(component.offset.position.z || 0)
    })
  }
  // 累加macro预设offset
  const macroOffset = positionsTable[component.macro]
  if (macroOffset) {
    positionStack.push(macroOffset)
  }
  
  // 记录sector归属
  if (component.class === 'sector') {
    currentSector = component.macro
  }
}

// 退出component时
onclosetag() {
  positionStack.pop()
}

// 计算当前位置
getCurrentPosition(): Vector3 {
  return positionStack.reduce((acc, p) => ({
    x: acc.x + p.x,
    y: acc.y + p.y,
    z: acc.z + p.z
  }), { x: 0, y: 0, z: 0 })
}
```

### Decision 3: Sector And Station Classification

**问题**: 现有 `stations[]` 平铺结构无法直接表达敌对势力、玩家与普通 NPC 的差异化业务需求

**方案**: 在 sector 层补充 `owner`，并将 station 按 owner 拆成四组

**实现细节**:
- `component class="sector"` 额外提取 `owner` attribute
- `component class="station"` 按 `owner` 进入：
  - `playerStations`
  - `xenonStations`
  - `khaakStations`
  - `npcStations`
- `playerStations` 保留现有玩家站模块明细提取
- `npcStations`、`xenonStations`、`khaakStations` 额外提取所有 module 的聚合统计：
  - `modules: [{ ref, amount }]`
  - `ref` 为模块标识
  - `amount` 为该模块在站内出现次数
- `npcStations` 与 `xenonStations` 额外基于聚合模块 / station macro 计算：
  - `isShipyard`
  - `isWharf`
  - `isEquipmentdock`
  - `isTradestation`
- 判定规则：
  - 模块包含 `buildmodule_*_ships_x` 或 `buildmodule_*_ships_xl` -> `isShipyard`
  - 模块包含 `buildmodule_*_ships_m` -> `isWharf`
  - 模块包含 `buildmodule_*_equip` -> `isEquipmentdock`
  - station `macro` 包含 `tradestation` -> `isTradestation`
- `khaakStations` 只保留聚合 modules，不参与上述 `is*` 判定
- `khaakStations` 额外根据 station `macro` 输出：
  - `landmarks_kha_nest_` -> `isNest`
  - `landmarks_kha_hive_` -> `isHive`
- 这些派生判定暂定放在 `src/workers/saveParserRust.worker.ts` 层完成，Rust core 继续只负责基础抽取与模块聚合
- 所有空数组字段在导出 JSON 中省略，不输出 `[]`

### Decision 4: Datavault Loot Extraction

**问题**: datavault 与 erlking_vault 除了坐标和布尔标记外，还需要表达是否已解锁以及内部可拾取战利品

**方案**: 统一提取 `unlocked` 与聚合 `wares`

**实现细节**:
- 适用对象：
  - `component class="datavault"`
  - `macro` 包含 `erlking_vault`
- `unlocked` 提取规则：
  - 查找对象内部 `<unlock state="..."/>`
  - 仅当 `state="unlocked"` 时输出 `true`
  - tag 不存在或值不是 `unlocked` 时输出 `false`
- `wares` 提取规则：
  - 进入对象下 `class="collectablewares"` 子组件
  - 扫描其 `<wares><ware .../></wares>`
  - 输出 `wares: [{ ware, amount }]`
  - 同名 `ware` 进行聚合
  - `amount` 缺失按 `1` 处理

### Decision 5: Name Translation

**问题**: 存档名称使用 `{page,id}` 格式，需翻译

**方案**: Worker预加载strings表，实时翻译

**实现细节**:
- Worker初始化时接收strings配置数据
- 解析名称时立即替换 `{page,id}` 为翻译文本
- 使用 `resolveName()` 函数（参考x4-vault-finder）

```typescript
function resolveName(s: string): string {
  const REFERENCE = /\{(\d*),\s*(\d+)\}/g
  while (true) {
    const match = REFERENCE.exec(s)
    if (!match) break
    const page = match[1] || '20'
    const id = match[2]
    const replacement = strings[page]?.[id] || ''
    s = s.replace(match[0], replacement)
  }
  // 去除括号后缀
  s = s.replace(/\([^)]*\)/g, '')
  return s.trim()
}
```

### Decision 6: Version Validation

**问题**: 存档版本需与当前游戏数据版本匹配

**方案**: 解析时提取version字段，加载时校验

**实现细节**:
- 存档XML root: `<game id="X4" version="800" ...>`
- 版本映射: `800` → `8.0`
- Store校验: `saveArchive.meta.version === gameDataStore.currentVersion`
- 不匹配时: 设置 `isCompatible = false`，显示警告
- Rust 与 SAX 两条解析链在未提供 `expected_version` 时都默认兼容，避免 UI / CLI 语义分叉

### Decision 7: Browser Upload Streaming

**问题**: 浏览器侧上传超大存档时，若先 `arrayBuffer()` 或先 gunzip，会拉高主线程和 JS 内存峰值

**方案**: 上传入口只负责原始字节流转发，不负责解压

**实现细节**:
- `SaveUploadPanel` 不直接持有整文件内容
- `saveUploadStreaming.ts` 使用 `File.stream()` 优先读取原始字节
- 若需要读取 gzip trailer 获取解压后总大小，只额外 `slice()` 尾部少量字节
- 每个 chunk 直接 transfer 给 worker，避免重复复制
- 浏览器端不再使用 `DecompressionStream('gzip')`

### Decision 8: JSON Import/Export

**问题**: 需支持导入已提取JSON和导出解析结果

**方案**: 标准化JSON格式，直接加载/生成

**实现细节**:
- 导入时校验 `meta.version`，跳过解析步骤
- 导出时生成标准化JSON，使用 `URL.createObjectURL` + `<a download>`
- 文件名: `{playerName}_{guid[:8]}_{time}.json`

### Decision 9: Store Design

**问题**: 存档数据管理

**方案**: 新增 `useSaveStore`（Pinia）

**实现细节**:
- 使用 IndexedDB 持久化列表元数据与完整存档详情
- 状态: `archives`, `selectedArchive`, `isParsing`, `parseProgress`, `parseError`
- 计算属性: `archiveGroups`, `totalArchiveCount`
- 方法:
  - `addArchive(archive)` - 添加存档，含版本兼容检查
  - `selectArchive(guid, time)` - 选中存档（使用time作为标识）
  - `clearSelection()` - 清空选中状态
  - `removeArchive(guid, time)` - 删除存档
  - `clearAll()` - 清空所有存档和状态
  - `exportToJson(guid, time)` - 导出JSON文件
  - `importFromJson(jsonData)` - 导入JSON，含结构校验
  - `checkVersionCompatibility(version)` - 版本兼容检查
  - `setParsingState(parsing, progress, error)` - 设置解析状态

### Decision 10: CLI Extraction Tool

**问题**: 需要命令行工具进行批量存档提取

**方案**: 提供 `scripts/extract_save.tsx` CLI 工具

**实现细节**:
- 用法: `npm exec tsx scripts/extract_save.tsx <input.xml|input.xml.gz> [output.json] [--wasm]`
- 支持两种解析器:
  - 默认: sax-js 解析器（使用 `saveParser.worker.ts`）
  - `--wasm`: Rust WASM 解析器（约 3.25x 更快，实验性）
- 输入格式: `.xml`, `.xml.gz`, `.gz`
- 输出格式: `.json`（符合导出格式规范）
- `--wasm` 路径直接转发原始文件字节给 Rust/WASM
- CLI 不再自行推断或节流 WASM 进度，只消费 Rust 侧返回的 CLI progress
- 进度报告: 解析进度、sector 数量、耗时

### Decision 11: WASM Parser Module

**问题**: 需要高性能解析器处理大型存档

**方案**: 使用 Rust 编译为 WebAssembly

**实现细节**:
- 位置: `src/wasm/`
- Rust 实现按职责拆分：
  - `rust-parser/src/model.rs` - 数据模型与错误类型
  - `rust-parser/src/core.rs` - 业务状态机与 `SaveArchive` 聚合
  - `rust-parser/src/stream.rs` - 流式 XML/gzip 输入、progress、pump
- `SaveParser` 类:
  - `push_chunk(chunk: Uint8Array)` - 输入数据块
  - `pump(max_events: number): boolean` - 处理事件，返回是否还有更多
  - `finish(filename: string): string` - 完成解析，返回 JSON 字符串
  - `progress_json(): string` - 获取进度信息（ProgressInfo JSON）
  - `take_cli_progress_json(): string | null` - 仅在 Rust 认为应上报时返回 CLI progress
  - `set_expected_total_bytes(total: number)` - 设置预期总字节数
  - `set_expected_version(version: string)` - 设置期望版本（用于早期版本校验）
- 使用流程:
  1. 创建 `SaveParser` 实例
  2. 调用 `push_chunk` 输入数据
  3. 循环调用 `pump` 处理事件
  4. 调用 `finish` 获取结果
- gzip 输入模式:
  - 自动探测 gzip header
  - 在 Rust 内部用 `flate2::Decompress` 增量解压 raw deflate
  - 在 `finish_input()` 阶段持续推进到 `StreamEnd`
- attribute 语义对齐 JS 路径:
  - key 统一转小写
  - 进行 XML entity decode
  - 未设置 `expected_version` 时默认兼容

### Decision 12: Progress Semantics

**问题**: UI 和 CLI 都需要进度，但两条链路不能各自发明不同语义

**方案**: Rust/WASM 负责产生真实进度快照；UI 和 CLI 只消费，不重复推断

**实现细节**:
- UI worker 向主线程发送节流后的 `ProgressInfo`
- `SaveUploadPanel` 文本状态读取 store 的 `parseProgress`
- `SaveUploadPanel` 进度条宽度绑定本地 `parsePercent`，直接取 worker `percent`
- CLI `--wasm` 只打印 Rust `take_cli_progress_json()` 返回的快照
- Rust 侧负责 CLI progress 的时间/阶段节流，不在 `extract_save.tsx` 再追加第二套控制

## File Structure

```
src/
├── components/
│   └── save/
│       ├── SaveImportView.vue          # 主视图容器
│       ├── SaveUploadPanel.vue         # 上传面板
│       ├── saveUploadStreaming.ts      # 原始字节流上传桥接
│       ├── SaveList.vue                # 存档列表
│       ├── SaveListItem.vue            # 存档项（含下载按钮）
│       ├── SaveDetailPanel.vue         # 详情面板
│       └── SectorDetailList.vue        # Sector详情列表
│
├── store/
│   └── useSaveStore.ts                 # 存档Store
│
├── workers/
│   ├── saveParserRust.worker.ts        # Rust解析Worker（UI使用）
│   └── saveParser.worker.ts            # SAX解析Worker（CLI使用）
│
├── wasm/
│   ├── save_parser.js                  # Rust WASM JS绑定
│   ├── save_parser_bg.wasm             # Rust WASM二进制
│   └── save_parser.d.ts                # 类型定义
│
├── utils/
│   └── saveParserConfig.ts             # Worker配置数据打包
│   └── saveResourceExtract.ts          # 资源区域提取（独立模块）
│
├── types/
│   └── saveArchive.ts                  # 存档数据类型定义
│
└── assets/
    └── x4_game_data/
        └── 8.0-Diplomacy/
            └── locales/                # strings表（用于翻译）

scripts/
└── extract_save.tsx                    # CLI提取工具

rust-parser/                            # Rust WASM解析器源码
├── Cargo.toml                          # Rust项目配置
├── src/
│   ├── lib.rs                          # WASM 导出包装
│   ├── model.rs                        # 数据模型与错误类型
│   ├── core.rs                         # 业务解析核心
│   └── stream.rs                       # 流式输入、gunzip、progress
└── pkg/                                # 编译输出（wasm-pack）
    ├── save_parser.js
    ├── save_parser_bg.wasm
    └── save_parser.d.ts
```

## Integration Points

### TopViewSwitch Integration

- 在 `defaultTabs` 中新增 `{ key: 'save-import', label: t('view.save_import'), activeClass: '...' }`
- Tab切换逻辑无需修改（已有机制支持）

### MainWorkbench Integration

- 新增条件判断: `const isSaveImportView = computed(() => shipBuildStore.activeView === 'save-import')`
- 渲染 `SaveImportView` 组件

### GameDataStore Integration

- 版本校验: `gameDataStore.currentVersion`（如 `8.0`）
- strings表: `gameDataStore` 已加载locale数据

## Performance Considerations

### Worker Performance

- 预估100MB存档解析时间: 5-15秒
- UI 进度报告使用节流后的快照，避免高频主线程更新
- CLI `--wasm` 进度由 Rust 侧统一控制
- 内存占用: 以原始字节流 + Rust 内部解析缓冲为主，避免浏览器端完整 gunzip 缓冲

### Coordinate Accumulation

- O(n) 栈操作，每个component进出栈一次
- 避免重复计算，仅在需要时计算当前位置

### JSON Import

- 直接加载，无解析开销
- 版本校验为简单字符串比较

## Error Handling

### Parse Error

- Worker报错时显示错误信息
- 允许重新上传

### Version Mismatch

- 显示警告，不阻止用户继续加载（但标记为不兼容）

### JSON Format Error

- 校验JSON结构
- 缺少必需字段时显示错误

### Duplicate Save

- 同guid+time视为更新，替换旧数据
