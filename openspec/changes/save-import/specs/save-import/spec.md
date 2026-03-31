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

**那么** 启动流式解析（SAX Worker）

**并且** 显示解析进度状态

**当** 解析完成

**那么** 存档数据添加到对应guid分组

**并且** 存档列表更新显示

#### Scenario: 上传已提取JSON文件

**前提** 用户已切换到存档同步视图

**当** 用户拖拽或选择 `.json` 文件上传（符合导出格式）

**那么** 直接加载JSON数据（跳过解析步骤）

**并且** 校验 `meta.version` 是否匹配当前游戏版本

**当** 版本匹配

**那么** 存档数据添加到对应guid分组

**并且** 存档列表更新显示

**当** 版本不匹配

**那么** 显示警告提示："存档版本不匹配，当前数据版本为X.X"

**并且** 用户可选择取消加载或继续加载（标记为不兼容）

### Requirement: Version Validation

存档版本必须与当前游戏数据版本匹配。

#### Scenario: 版本匹配校验

**前提** 存档包含 `version` 字段（如 `800`）

**当** 解析存档时

**那么** 校验 `version` 是否匹配 `useGameDataStore.currentVersion`

**并且** 版本映射规则：`800` → `8.0`

**当** 版本匹配

**那么** 正常加载存档

**当** 版本不匹配

**那么** 显示警告，禁止自动加载或标记为不兼容

**并且** 存档项显示版本不匹配标识

### Requirement: Save Archive Grouping

存档按guid分组，按time降序排列。

#### Scenario: 存档分组显示

**前提** 存档已解析完成

**当** 存档列表渲染

**那么** 按 `game.guid` 分组显示

**并且** 分组标题使用 `player.name` 命名

**并且** 组内存档按 `game.time` 降序排列（最新的在前）

**并且** 每个存档项显示时间信息

#### Scenario: 同guid同seed存档处理

**前提** 上传的存档 `guid` 和 `seed` 与已有存档相同

**当** 解析完成

**那么** 视为同一存档的更新

**并且** 替换旧数据（保留最新的 `time` 记录）

### Requirement: Save Data Extraction

从存档XML提取指定对象。

#### Scenario: 提取所有空间站

**前提** 存档解析开始

**当** 解析 `<component class="station">`

**那么** 提取以下字段：
- `code`: 存档唯一ID
- `macro`: 模板宏名
- `owner`: 所属faction
- `x, y, z`: 坐标（累加层级offset）
- `is_wreck`: 是否残骸
- `is_headquarter`: 是否HQ

**并且** 不限制owner（提取所有空间站）

#### Scenario: 提取Datavault

**前提** 存档解析开始

**当** 解析 `<component class="datavault">`

**那么** 提取以下字段：
- `code`
- `macro`
- `owner`
- `x, y, z`
- `has_blueprints`
- `has_wares`
- `has_signalleak`

#### Scenario: 提取Erlking Vault

**前提** 存档解析开始

**当** 解析 `<component macro>` 包含 `erlking_vault`

**那么** 提取以下字段：
- `code`
- `macro`
- `owner`
- `x, y, z`
- `has_blueprints`
- `has_wares`
- `has_signalleak`

**并且** 作为单独类型（不与datavault合并）

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

**并且** 文件名建议：`{playerName}_{guid}_{seed}.json`

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

存档解析使用SAX流式解析避免阻塞UI。

#### Scenario: 流式解析大文件

**前提** 上传存档文件大小超过100MB

**当** 解析开始

**那么** 使用Web Worker执行SAX解析

**并且** 主线程不阻塞

**并且** 显示解析进度（如 "Processing X MB..."）

**当** 解析完成

**那么** Worker返回解析结果

**并且** 更新存档列表

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

**并且** 不持久化（仅内存存储）

#### Scenario: 存档分组数据结构

**前提** ArchiveGroup 定义

**当** 存档分组

**那么** 包含以下字段：
- `guid`: 存档归属
- `playerName`: 分组命名
- `saves`: SaveArchive[]（按time降序）

**并且** SaveArchive 包含：
- `meta`: 存档元信息
- `sectors`: 提取的sector数据
- `isCompatible`: 版本兼容状态