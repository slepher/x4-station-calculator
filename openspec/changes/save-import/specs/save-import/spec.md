# Save Import Specification

## Purpose

提供存档上传、解析、展示和导出功能，支持用户上传X4原始存档或已提取JSON，解析并展示空间站、datavault、erlking_vault、弃船等信息，支持导出提取结果为JSON文件。

## ADDED Requirements

### Requirement: Tab Entry

新增"存档同步"Tab入口。

#### Scenario: Tab显示与切换

**前提** 用户已打开应用并完成初始化

**当** 用户查看 TopViewSwitch 组件

**那么** 显示第5个Tab"存档同步"，排在"船只建造"之后

**并且** Tab key 为 `save-import`

**当** 用户点击"存档同步"Tab

**那么** 切换到存档同步视图

**并且** 左侧显示上传界面和存档列表

**并且** 右侧显示存档详情面板（初始为空或提示状态）

### Requirement: Upload Interface

提供上传界面，支持原始存档和已提取JSON两种格式。

#### Scenario: 上传原始存档文件

**前提** 用户已切换到存档同步视图

**当** 用户拖拽或选择 `.xml` 或 `.xml.gz` 文件上传

**那么** 启动流式解析（Rust Worker）

**并且** 传入当前游戏版本用于校验

**并且** 显示解析进度状态：
- 百分比进度
- 已解析sector数量
- 当前阶段（receiving/parsing/finalizing/done/error）
- 错误信息（如有）

**当** 解析完成且版本匹配

**那么** 存档数据添加到对应guid分组

**并且** 存档列表更新显示

**当** 解析完成但版本不匹配

**那么** 返回版本错误

**并且** 显示错误信息："Version mismatch: save version X does not match current game version Y"

**并且** 不加载该存档

#### Scenario: 上传已提取JSON文件

**前提** 用户已切换到存档同步视图

**当** 用户拖拽或选择 `.json` 文件上传（符合导出格式）

**那么** 直接加载JSON数据（跳过解析步骤）

**并且** 校验 `meta.version` 是否匹配当前游戏版本

**当** 版本匹配

**那么** 存档数据添加到对应guid分组

**并且** 存档列表更新显示

**当** 版本不匹配

**那么** 返回错误消息："Version mismatch: save version X does not match current game version Y"

**并且** 不加载该存档数据

### Requirement: Version Validation

存档版本必须与当前游戏数据版本匹配，版本不匹配时拒绝加载。

#### Scenario: 版本匹配校验

**前提** 存档包含 `version` 字段（如 `800`）

**当** 解析存档时（解析到 `<game>` 标签后立即校验）

**那么** 校验 `version` 是否匹配 `useGameDataStore.currentVersion`

**并且** 版本映射规则：`800` → `8.0`

**当** 版本匹配

**那么** 继续解析并加载存档

**当** 版本不匹配

**那么** 立即停止解析

**并且** 返回错误消息："Version mismatch: save version X (x.x) does not match current game version Y (y.y)"

**并且** 不加载该存档数据

**并且** 不继续解析剩余存档内容

### Requirement: Save Archive Grouping

存档按guid分组，按time降序排列。

#### Scenario: 存档分组显示

**前提** 存档已解析完成

**当** 存档列表渲染

**那么** 按 `game.guid` 分组显示

**并且** 分组标题使用 `player.name` 命名

**并且** 分组按 `playerName` 字母顺序排列

**并且** 组内存档按 `game.time` 降序排列（最新的在前）

**并且** 每个存档项显示时间信息

**并且** 每个存档项提供操作按钮：
- 下载JSON按钮：导出存档数据
- 删除按钮：移除该存档

#### Scenario: 同guid同time存档处理

**前提** 上传的存档 `guid` 和 `time` 与已有存档相同

**当** 解析完成

**那么** 视为同一存档的更新

**并且** 替换旧数据

### Requirement: Save Data Extraction

从存档XML提取指定对象。

#### Scenario: 提取sector owner并组织分组

**前提** 对象位于某个 `<component class="sector">` 内

**当** 解析 sector 节点

**那么** 提取以下字段：
- `name`
- `is_known`
- `owner`

**并且** 初始化以下 station 分组：
- `playerStations`
- `xenonStations`
- `khaakStations`
- `npcStations`

#### Scenario: 提取所有空间站并按owner分类

**前提** 存档解析开始

**当** 解析 `<component class="station">`

**那么** 提取以下字段：
- `code`: 存档唯一ID
- `macro`: 模板宏名
- `owner`: 所属faction
- `x, y, z`: 坐标（累加层级offset）
- `is_wreck`: 是否残骸
- `is_headquarter`: 是否HQ

**并且** 根据 `owner` 分类归入：
- `playerStations`
- `xenonStations`
- `khaakStations`
- `npcStations`

**当** 空间站 `owner="player"`

**那么** 额外提取模块信息：
- `modules`: 模块列表（从 construction/sequence/entry 提取）
  - `index`: 模块序号
  - `ref`: 模块macro引用
  - `equipments`: 装备列表（可选）
    - `type`: `shields` | `turrets`
    - `ref`: 装备macro
    - `group`: 装备组名
    - `exact`: 数量

#### Scenario: 提取普通NPC空间站模块聚合

**前提** 存档解析开始

**当** 解析 `<component class="station">`

**并且** `owner!="player"`

**并且** `owner!="xenon"`

**并且** `owner!="khaak"`

**那么** 额外提取聚合模块信息：
- `modules`: 模块统计列表
  - `ref`: 模块标识
  - `amount`: 该模块在站内出现次数

**并且** 不提取玩家站使用的 construction/equipment 明细结构

#### Scenario: xenon与khaak空间站只做分类

**前提** 存档解析开始

**当** 解析 `<component class="station">`

**并且** `owner="xenon"` 或 `owner="khaak"`

**那么** 仅按 faction 分类归组

**并且** 不提取 `modules: [{ ref, amount }]`

#### Scenario: 提取Datavault

**前提** 存档解析开始

**当** 解析 `<component class="datavault">`

**那么** 提取以下字段：
- `code`
- `macro`
- `owner`
- `x, y, z`
- `unlocked`
- `wares`
- `has_blueprints`
- `has_wares`
- `has_signalleak`

#### Scenario: 提取Datavault解锁状态与战利品

**前提** 存档解析开始

**当** 解析 `<component class="datavault">`

**那么** 查找其内部 `<unlock state="..."/>`

**并且** 当 `state="unlocked"` 时输出 `unlocked=true`

**并且** 当 `<unlock>` 不存在或 `state!="unlocked"` 时输出 `unlocked=false`

**并且** 从其下 `class="collectablewares"` 子组件的 `<wares><ware .../></wares>` 提取聚合战利品：
- `wares: [{ ware, amount }]`
- 同名 `ware` 合并
- `amount` 缺失按 `1` 处理

#### Scenario: 提取Erlking Vault

**前提** 存档解析开始

**当** 解析 `<component macro>` 包含 `erlking_vault`

**那么** 提取以下字段：
- `code`
- `macro`
- `owner`
- `x, y, z`
- `unlocked`
- `wares`
- `has_blueprints`
- `has_wares`
- `has_signalleak`

**并且** 作为单独类型（不与datavault合并）

#### Scenario: 提取Erlking Vault解锁状态与战利品

**前提** 存档解析开始

**当** 解析 `<component macro>` 包含 `erlking_vault`

**那么** 按 datavault 相同规则提取：
- `unlocked`
- `wares: [{ ware, amount }]`

**并且** 同名 `ware` 合并

**并且** `amount` 缺失按 `1` 处理

#### Scenario: 提取弃船

**前提** 存档解析开始

**当** 解析 `<component class="ship_*">` 且 `owner="ownerless"`

**那么** 提取以下字段：
- `code`
- `macro`
- `class`: 船型类别
- `x, y, z`

### Requirement: Sector Organization

提取对象按sector组织。

#### Scenario: 对象归属sector

**前提** 对象位于某个 `<component class="sector">` 内

**当** 解析对象时

**那么** 记录所属 `sector_macro`

**并且** 累加sector层级offset到坐标计算

**并且** 对象归入对应sector分组

#### Scenario: Sector名称翻译

**前提** sector名称为 `{page,id}` 格式

**当** 展示sector名称

**那么** 查找strings表翻译为可读名称

**并且** 使用游戏数据中的locale映射

### Requirement: Parser Capability Boundary

JS parser 冻结为兼容/备用链路，后续业务演进仅进入 Rust/WASM 解析链。

#### Scenario: 新增业务提取字段

**前提** 需要新增 save-import 业务字段或分类逻辑

**当** 更新解析实现

**那么** 仅在 Rust/WASM 解析链中实现

**并且** `src/workers/saveParser.worker.ts` 不再增加新的业务提取能力

**并且** JS parser 只保留兼容、回退或 CLI 默认用途

### Requirement: Save Detail Display

右侧面板展示存档详情。

#### Scenario: 显示存档详情

**前提** 用户点击存档列表中的存档项

**当** 存档选中

**那么** 右侧面板显示该存档详情

**并且** 按sector分组展示：
- 空间站列表
- Datavault列表
- Erlking Vault列表
- 弃船列表

**并且** 每个对象显示：名称/坐标/owner

#### Scenario: 未选中存档时显示

**前提** 无存档选中

**当** 右侧面板渲染

**那么** 显示提示信息："请选择存档查看详情"或上传引导

### Requirement: JSON Export

支持导出提取结果为JSON文件。

#### Scenario: 导出存档JSON

**前提** 存档已解析完成

**当** 用户点击"下载JSON"按钮

**那么** 生成JSON文件（符合导出格式规范）

**并且** 使用浏览器原生下载API触发下载

**并且** 文件名格式：`{playerName}_{guid[:8]}_{time}.json`

#### Scenario: JSON导出格式

**前提** 生成导出JSON

**当** 序列化存档数据

**那么** JSON包含以下结构：

```json
{
  "meta": {
    "guid": "...",
    "seed": 123,
    "time": 770722.838,
    "playerName": "slepher",
    "version": "800",
    "filename": "save_001",
    "parser_version": "v1",
    "source": "original"
  },
  "sectors": {
    "sector_macro": {
      "name": "翻译后名称",
      "is_known": true,
      "stations": [...],
      "datavaults": [...],
      "erlkingVaults": [...],
      "abandonedShips": [...]
    }
  }
}
```

### Requirement: SAX Streaming Parser

存档解析使用流式解析避免阻塞UI。

#### Scenario: 流式解析大文件

**前提** 上传存档文件大小超过100MB

**当** 解析开始

**那么** 使用Rust Web Worker执行解析（替代SAX）

**并且** 主线程不阻塞

**并且** 显示解析进度（ProgressInfo）

**当** 解析完成

**那么** Worker返回解析结果

**并且** 更新存档列表

#### Scenario: 解析进度报告

**前提** 解析进行中

**当** Worker向主线程发送进度消息

**那么** ProgressInfo 包含以下字段：
- `phase`: `receiving` | `parsing` | `finalizing` | `done` | `error`
- `percent`: 完成百分比
- `sectorCount`: 已解析sector数
- `tagCount`: 已处理标签数
- `error`: 错误信息（如有）

#### Scenario: 坐标累加计算

**前提** 解析嵌套component结构

**当** 遍历component层级

**那么** 累加各层 `<offset><position>` 的 `x, y, z`

**并且** 包含macro预设offset（positions表）

**并且** 最终坐标为游戏内米级单位

### Requirement: Name Translation

存档内 `{page,id}` 格式名称需翻译。

#### Scenario: 翻译名称引用

**前提** 存档包含名称字段如 `{20004,480011}`

**当** 展示名称时

**那么** 查找strings表对应page和id

**并且** 使用当前语言locale获取翻译文本

**并且** 去除括号后缀格式

### Requirement: Save Store

新增 `useSaveStore` 管理存档数据。

#### Scenario: 存档数据存储

**前提** 存档解析完成

**当** 存档数据加载

**那么** 存储在 `useSaveStore` 中

**并且** 数据结构：
- `archives`: Map<guid, ArchiveGroup>
- `selectedArchive`: 当前选中存档
- `isParsing`: 解析状态
- `parseProgress`: 进度文本
- `parseError`: 错误信息
- `archiveGroups`: 分组列表（computed）
- `totalArchiveCount`: 存档总数（computed）

**并且** 不持久化（仅内存存储）

#### Scenario: 存档分组数据结构

**前提** ArchiveGroup 定义

**当** 存档分组

**那么** 包含以下字段：
- `guid`: 存档归属
- `playerName`: 分组命名
- `saves`: SaveArchive[]（按time降序）

**并且** SaveArchive 包含：
- `meta`: 存档元信息（含 filename, parser_version）
- `sectors`: 提取的sector数据
- `isCompatible`: 版本兼容状态

#### Scenario: Store方法

**前提** Store已初始化

**当** 调用Store方法

**那么** 支持以下操作：
- `addArchive(archive)`: 添加存档（含版本检查）
- `selectArchive(guid, time)`: 选中存档
- `clearSelection()`: 清空选中
- `removeArchive(guid, time)`: 删除存档
- `clearAll()`: 清空所有存档
- `exportToJson(guid, time)`: 导出JSON
- `importFromJson(jsonData)`: 导入JSON（含校验）
- `checkVersionCompatibility(version)`: 版本兼容检查
- `setParsingState(parsing, progress, error)`: 设置解析状态

### Requirement: CLI Extraction Tool

提供命令行工具进行存档提取。

#### Scenario: 使用CLI提取存档

**前提** 用户已安装 Node.js 和项目依赖

**当** 用户执行 `npm exec tsx scripts/extract_save.tsx <input.xml> [output.json]`

**那么** 解析存档文件并生成 JSON

**并且** 显示解析进度和统计信息

**当** 用户添加 `--wasm` 参数

**那么** 使用 Rust WASM 解析器（更快）

#### Scenario: CLI输入输出格式

**前提** 用户执行 CLI 工具

**当** 输入文件为 `.xml` 或 `.xml.gz` 或 `.gz`

**那么** 自动检测并处理

**当** 未指定输出文件

**那么** 使用默认输出路径：输入文件名替换扩展名为 `.json`

#### Scenario: WASM解析器接口

**前提** 使用 Rust WASM 解析器

**当** 调用 `SaveParser` 类

**那么** 支持以下方法：
- `push_chunk(chunk: Uint8Array)`: 输入数据块
- `pump(max_events: number): boolean`: 处理事件
- `finish(filename: string): string`: 完成解析，返回JSON
- `progress_json(): string`: 获取进度信息
- `set_expected_total_bytes(total: number)`: 设置预期总字节数
#### Scenario: 空数组字段省略输出

**前提** 某个导出字段是数组类型

**当** 该字段结果为空数组

**那么** 省略该 key，不输出 `[]`

**并且** 适用于 sector 下的：
- `playerStations`
- `xenonStations`
- `khaakStations`
- `npcStations`
- `datavaults`
- `erlkingVaults`
- `abandonedShips`

**并且** 也适用于条目内部的：
- `modules`
- `wares`
