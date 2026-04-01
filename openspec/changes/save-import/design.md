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
│                  Rust Parser Worker                              │
│  - High-performance XML parsing (Rust WASM)                     │
│  - Extract: stations, datavaults, erlkingVaults, ships          │
│  - Accumulate coordinates (component offset stacking)           │
│  - Translate names ({page,id} → strings table)                  │
│  - Progress reporting (ProgressInfo)                            │
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
    source: 'original' | 'imported'  // 来源类型
  }
  sectors: Record<string, SectorData>
  isCompatible: boolean   // 版本兼容状态
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
  stations: StationEntry[]
  datavaults: DatavaultEntry[]
  erlkingVaults: DatavaultEntry[]  // 同结构，单独类型
  abandonedShips: AbandonedShipEntry[]
}

interface StationEntry {
  code: string
  macro: string
  owner: string
  x: number
  y: number
  z: number
  is_wreck?: boolean
  is_headquarter?: boolean
  modules?: StationModule[]  // 仅owner=player时提取
}

interface StationModule {
  index: number
  ref: string
  equipments?: StationEquipment[]
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
  x: number
  y: number
  z: number
  has_blueprints?: boolean
  has_wares?: boolean
  has_signalleak?: boolean
}

interface AbandonedShipEntry {
  code: string
  macro: string
  class: string  // ship_xs, ship_s, ship_m, etc.
  x: number
  y: number
  z: number
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

## Key Decisions

### Decision 1: Rust Worker Streaming

**问题**: 存档文件可达100MB+，直接解析会阻塞UI

**方案**: 使用 Rust Web Worker 执行高性能解析

**实现细节**:
- Worker 脚本: `src/workers/saveParserRust.worker.ts`（Rust WASM）
- Worker 脚本（备用）: `src/workers/saveParser.worker.ts`（SAX，未在UI中使用）
- 支持gzip检测并自动解压（`DecompressionStream`）
- 向主线程报告 ProgressInfo 进度
- 解析完成后一次性返回结果对象
- 可选性能分析（通过 `options.profile` 参数）

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

### Decision 3: Name Translation

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

### Decision 4: Version Validation

**问题**: 存档版本需与当前游戏数据版本匹配

**方案**: 解析时提取version字段，加载时校验

**实现细节**:
- 存档XML root: `<game id="X4" version="800" ...>`
- 版本映射: `800` → `8.0`
- Store校验: `saveArchive.meta.version === gameDataStore.currentVersion`
- 不匹配时: 设置 `isCompatible = false`，显示警告

### Decision 5: JSON Import/Export

**问题**: 需支持导入已提取JSON和导出解析结果

**方案**: 标准化JSON格式，直接加载/生成

**实现细节**:
- 导入时校验 `meta.version`，跳过解析步骤
- 导出时生成标准化JSON，使用 `URL.createObjectURL` + `<a download>`
- 文件名: `{playerName}_{guid[:8]}_{time}.json`

### Decision 6: Store Design

**问题**: 存档数据管理

**方案**: 新增 `useSaveStore`（Pinia）

**实现细节**:
- 不持久化（暂不实现localStorage/IndexedDB）
- 数据仅在内存中存储
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

## File Structure

```
src/
├── components/
│   └── save/
│       ├── SaveImportView.vue          # 主视图容器
│       ├── SaveUploadPanel.vue         # 上传面板
│       ├── SaveList.vue                # 存档列表
│       ├── SaveListItem.vue            # 存档项（含下载按钮）
│       ├── SaveDetailPanel.vue         # 详情面板
│       └── SectorDetailList.vue        # Sector详情列表
│
├── store/
│   └── useSaveStore.ts                 # 存档Store
│
│  ├── workers/
│  │   ├── saveParserRust.worker.ts     # Rust解析Worker（UI使用）
│  │   └── saveParser.worker.ts         # SAX解析Worker（备用）
│
│  ├── utils/
│  │   └── saveParserConfig.ts          # Worker配置数据打包
│  │   └── saveResourceExtract.ts       # 资源区域提取（独立模块）
│
├── utils/
│   └── saveParserConfig.ts             # Worker配置数据打包
│   └── saveJsonFormat.ts               # JSON格式校验/生成
│
├── types/
│   └── saveArchive.ts                  # 存档数据类型定义
│
└── assets/
│   └── x4_game_data/
│       └── 8.0-Diplomacy/
│           └── locales/                # strings表（用于翻译）
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
- 进度报告频率: 每1MB报告一次
- 内存占用: Worker内约50-100MB（流式处理）

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