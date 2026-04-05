# Save POI Map Integration Specification

## Purpose

将存档解析数据中的兴趣点（空间站、保险箱、弃船等）集成到星区地图中，实现可视化显示和交互导航。

---

## ADDED Requirements

### Requirement: Save Archive Map Entry Button

地图底部按钮组新增存档入口，提供存档管理的快捷访问。

#### Scenario: 用户打开存档侧边栏

**前提** 用户已进入地图视图（MapWorkbenchView）
**当** 用户点击底部按钮组的"存档"按钮
**那么** 存档侧边栏打开，显示存档上传区域和存档列表
**并且** 其他已打开的侧边栏（资源/空间站）自动关闭

---

### Requirement: Save Archive Sidebar Navigation Layers

存档侧边栏采用三层导航结构，配合面包屑导航显示当前位置。

#### Scenario: 用户浏览存档列表（L1层）

**前提** 存档侧边栏已打开
**当** 用户查看存档列表
**那么** 显示按玩家分组的存档列表
**并且** 面包屑显示"存档"
**并且** 顶部显示上传区域（支持拖放/点击上传）

#### Scenario: 用户选择存档进入分类层（L2层）

**前提** 存档列表中至少有一个存档
**当** 用户点击某个存档项
**那么** 侧边栏内容切换为 7 个分类子菜单
**并且** 面包屑显示"存档 → 存档名"
**并且** 每个分类显示 checkbox 和数量统计

#### Scenario: 用户进入坐标列表层（L3层）

**前提** 用户已在分类子菜单层（L2）
**当** 用户点击某个分类右侧的箭头按钮
**那么** 侧边栏内容切换为坐标列表
**并且** 面包屑显示"存档 → 存档名 → 分类名"
**并且** 坐标按星区分组显示
**并且** 顶部提供搜索框

#### Scenario: 用户通过面包屑返回上一层

**前提** 用户在 L2 或 L3 层
**当** 用户点击面包屑中的"存档"或"存档名"
**那么** 侧边栏内容切换到对应层级

---

### Requirement: Save POI Category Classification

存档中的兴趣点按 7 个分类展示，每个分类独立控制显示状态。

#### Scenario: 用户查看分类子菜单

**前提** 用户已进入某个存档的分类层（L2）
**当** 用户查看分类列表
**那么** 显示以下 7 个分类：
- 用户空间站（`playerStations`，无过滤）
- NPC空间站（`npcStations`，无过滤）
- XEN空间站（`xenonStations`，无过滤）
- KHA空间站（`khaakStations`，无过滤）
- 弃船（`abandonedShips`）
- 保险箱（`datavaults`）
- 妖王保险箱（`erlkingVaults`）
**并且** 每个分类显示 checkbox 和对应实体数量

#### Scenario: 分类整行不进入详情

**前提** 用户在分类层（L2）
**当** 用户点击某个分类项的文本区域或空白区域
**那么** 不进入坐标列表层
**并且** 不改变该分类 checkbox 状态

#### Scenario: 只有右侧箭头进入详情

**前提** 用户在分类层（L2）
**当** 用户点击某个分类右侧的箭头按钮
**那么** 进入该分类的坐标列表层（L3）
**并且** 不自动改写该分类 checkbox 状态

#### Scenario: 用户勾选分类checkbox

**前提** 用户在分类层（L2）
**当** 用户勾选某个分类的 checkbox
**那么** 该分类的所有兴趣点显示在地图上
**并且** 使用对应分类的颜色标记

#### Scenario: 用户取消勾选分类checkbox

**前提** 某分类已勾选，兴趣点已显示在地图上
**当** 用户取消勾选该分类的 checkbox
**那么** 该分类的所有兴趣点从地图上移除

#### Scenario: 分类数量统计不再受小条件站点过滤影响

**前提** 用户在分类层（L2）
**当** 分类列表渲染数量
**那么** 统计基于完整 POI 数据
**并且** 不存在“剔除小条件站点”用户开关

#### Scenario: checkbox默认状态

**前提** 用户刚进入某个存档的分类层
**当** 分类列表加载完成
**那么** 所有 checkbox 默认为未勾选状态
**并且** 地图上不显示任何存档兴趣点

#### Scenario: 未勾选类别进入详情时临时显示兴趣点

**前提** 用户在分类层（L2），某分类 checkbox 未勾选
**当** 用户点击该分类右侧箭头进入坐标列表层（L3）
**那么** 地图临时显示该分类的兴趣点
**并且** 该分类 checkbox 仍保持未勾选状态

#### Scenario: 返回分类层后移除临时显示

**前提** 用户通过右侧箭头进入了某个未勾选类别的坐标列表层（L3），地图正在临时显示该类别兴趣点
**当** 用户通过面包屑返回分类层（L2）
**那么** 该类别兴趣点从地图上移除
**并且** checkbox 状态保持未勾选

---

### Requirement: Save POI Coordinate List Display

坐标列表按星区分组，提供搜索筛选功能。

#### Scenario: 用户查看坐标列表

**前提** 用户已进入某个分类的坐标列表层（L3）
**当** 坐标列表加载完成
**那么** 坐标按星区名称分组显示
**并且** 每个坐标项显示 `code` 和坐标值
**并且** 顶部显示搜索框

#### Scenario: 坐标列表显示完整空间站集合

**前提** 用户进入任意空间站分类的坐标列表层（L3）
**当** 列表渲染完成
**那么** 显示该分类全部空间站
**并且** 不因历史“小条件站点”选项而过滤

#### Scenario: 用户搜索星区

**前提** 用户在坐标列表层（L3）
**当** 用户在搜索框输入星区名称关键词
**那么** 坐标列表仅显示匹配星区的分组
**并且** 其他星区分组被隐藏

#### Scenario: 用户清空搜索

**前提** 搜索框已有内容，列表已筛选
**当** 用户清空搜索框内容
**那么** 坐标列表恢复显示所有星区分组

---

### Requirement: Save POI Map Markers

存档兴趣点在地图上使用 SVG 图标显示，上方显示 code 标签。

#### Scenario: 兴趣点标记渲染

**前提** 用户勾选了某个分类的 checkbox
**当** 地图渲染兴趣点标记
**那么** 每个兴趣点显示对应的 SVG 图标
**并且** 图标上方显示该实体的 `code` 字段
**并且** 不同分类使用不同颜色

#### Scenario: 空间站图标规则

**当** 地图渲染空间站兴趣点
**那么** 图标选择遵循以下规则：

**用户空间站（playerStation）**：
- `is_headquarter === true` → 使用 `playerhq.svg`
- 否则使用 `<tag>.svg`（如 `shipyard.svg`, `wharf.svg`, `factory.svg` 等）

**NPC空间站（npcStation）**：
- `is_headquarter === true` → 使用 `<tag>_headquarter.svg`
- 否则使用 `<tag>.svg`

**XEN空间站（xenonStation）**：
- `is_headquarter === true` → 使用 `<tag>_headquarter.svg`
- 否则使用 `<tag>.svg`

**KHA空间站（khaakStation）**：
- 使用 `<tag>.svg`（如 `hive.svg`, `nest.svg`, `weaponplatform.svg`）

**非空间站类别（abandonedShip/datavault/erlkingVault）**：
- 弃船（abandonedShip）使用飞船类型图标（根据 class + purpose）
- 保险箱/妖王保险箱使用小圆点标记

#### Scenario: Abandoned Ship Icon Selection

**当** 地图渲染弃船兴趣点
**那么** 图标选择遵循以下规则：

**数据准备**：
- 存档中的 `ship.macro` 匹配 `ships.json` 中的 `macro` 字段
- 从匹配的 ship 数据获取 `id` (shipId) 和 `purposePrimary` (purpose)
- 无法匹配的弃船在 postProcessor 中过滤掉

**图标选择**：
- 根据 `class` + `purpose` 选择图标：`ship_{size}_{purpose}_01.svg`
- 示例：`ship_s` + `fight` → `ship_s_fight_01.svg`
- 示例：`ship_xl` + `build` → `ship_xl_build_01.svg`

**支持的组合**：
| class | purpose | 图标 |
|-------|---------|------|
| ship_l | fight | ship_l_fight_01.svg |
| ship_l | mine | ship_l_mine_01.svg |
| ship_l | trade | ship_l_trade_01.svg |
| ship_l | dismantling | ship_l_dismantling_01.svg |
| ship_m | fight | ship_m_fight_01.svg |
| ship_m | mine | ship_m_mine_01.svg |
| ship_m | trade | ship_m_trade_01.svg |
| ship_m | salvage | ship_m_salvage_01.svg |
| ship_s | fight | ship_s_fight_01.svg |
| ship_s | mine | ship_s_mine_01.svg |
| ship_s | trade | ship_s_trade_01.svg |
| ship_xl | build | ship_xl_build_01.svg |
| ship_xl | fight | ship_xl_fight_01.svg |
| ship_xl | auxiliary | ship_xl_auxiliary_01.svg |

#### Scenario: 分类颜色区分

**当** 不同分类的兴趣点同时显示在地图上
**那么** 使用以下颜色区分：
- 用户空间站：amber-400
- NPC空间站：amber-200/60
- XEN空间站：red-400
- KHA空间站：purple-500
- 弃船：purple-400
- 保险箱：cyan-400
- 妖王保险箱：emerald-400

---

### Requirement: Faction Color Dyeing

存档中的星区和空间站根据阵营颜色进行染色显示。

#### Scenario: 星区阵营染色

**前提** 用户已选择存档并勾选了某个分类
**当** 存档中星区的 `owner` 字段存在
**那么** 星区使用对应阵营的颜色渲染
**并且** 颜色从 `factions.json` 的 `color` 字段获取

#### Scenario: Cluster 阵营颜色计算

**当** 计算整个 cluster 的颜色
**那么** 若 cluster 内所有 sector 的 owner 相同，使用该阵营颜色
**并且** 若 owner 不完全相同，使用 `ownerless` 颜色

#### Scenario: 空间站图标阵营染色

**前提** 空间站有 `owner` 字段
**当** 渲染空间站图标
**那么** 使用 SVG `feColorMatrix` filter 将图标染色为阵营颜色
**并且** 白色图标会被转换为对应的阵营颜色

#### Scenario: 高亮状态保持阵营颜色

**前提** 用户点击定位空间站使其高亮
**当** 空间站处于 `.focused` 状态
**那么** 阵营颜色保持不变
**并且** 额外显示 drop-shadow 高亮效果

---

### Requirement: Sector Tooltip Owner i18n

星区 tooltip 中的 owner 显示使用阵营的本地化名称。

#### Scenario: Tooltip 显示阵营名称

**当** tooltip 显示星区 owner
**那么** 使用阵营的 `nameId` 进行 i18n 翻译
**并且** 若存档中存在 owner override，优先使用 override 的 owner

#### Scenario: ownerless 显示

**当** 星区无 owner 或 owner 为 ownerless
**那么** 显示 `map.owner_ownerless` 翻译文本

---

### Requirement: Save POI Focus Navigation

点击坐标项可定位到对应的兴趣点。

#### Scenario: 用户点击坐标项定位

**前提** 用户在坐标列表层（L3），对应类别兴趣点已显示在地图上
**当** 用户点击某个坐标项
**那么** 地图平移并缩放
**并且** 对应的兴趣点居中显示在视口内

---

### Requirement: Save POI Tooltip Interaction

点击地图上的兴趣点标记显示 tooltip。

#### Scenario: 用户点击兴趣点标记

**前提** 兴趣点已显示在地图上
**当** 用户点击某个兴趣点标记
**那么** 显示 tooltip，包含以下信息：
- 分类名
- owner（如有）
- code
- 坐标值
**并且** tooltip 样式与地图现有 tooltip 一致

#### Scenario: 空间站 tooltip 显示统一本地化命名

**前提** 用户点击 player/npc/xenon/khaak 空间站兴趣点
**当** tooltip 显示副标题
**那么** player/npc 空间站按统一站点命名规则显示本地化名称
**并且** xenon/khaak 空间站使用相同命名入口，但不依赖 `productionProfile`

#### Scenario: 玩家总部名称优先显示总部

**前提** `playerStation.is_headquarter = true`
**当** 列表项或 tooltip 解析空间站主名称
**那么** 主名称显示“总部”

#### Scenario: 所有总部空间站显示总部标签

**前提** 任意空间站满足 `is_headquarter = true`
**当** 列表项和 tooltip 渲染
**那么** 列表中显示绿色“总部”药丸标签
**并且** tooltip 中额外显示一行“总部”

---

### Requirement: Save Station Production Profile Naming

玩家与 NPC 空间站的工厂命名基于生产画像生成，用于地图 POI 列表和 tooltip。

#### Scenario: 单一生产模块使用模块本地化名称

**前提** 空间站 `tag = "factory"` 且 `productionProfile` 为单个 `module_id`
**当** 解析站点名称
**那么** 使用对应游戏 module 的 i18n 名称

#### Scenario: 单一生产组使用模块组本地化名称

**前提** 空间站 `tag = "factory"` 且 `productionProfile` 为单个 `group id`
**当** 解析站点名称
**那么** 使用对应游戏 module_group 的 i18n 名称

#### Scenario: 同簇多组按优先级落单个 group id

**前提** 玩家或 NPC 工厂空间站的生产模块分布在同一优先级簇内
**当** post-process 计算 `productionProfile`
**那么** 结果为单个优先级最高的 `group id`
**并且** 不得保留整条优先级链字符串

#### Scenario: mixed 使用综合体文案

**前提** 空间站 `tag = "factory"` 且 `productionProfile = "mixed"`
**当** 解析站点名称
**那么** 显示“综合体”对应的界面 i18n

#### Scenario: xenon 与 khaak 不生成 productionProfile

**前提** 空间站类别为 `xenonStation` 或 `khaakStation`
**当** post-process 处理站点
**那么** 不生成 `productionProfile`
**并且** 命名解析仍通过统一站点 i18n 入口进行

#### Scenario: khaak weaponplatform 使用武器平台文案

**前提** `khaakStation.tag = "weaponplatform"`
**当** 解析站点名称
**那么** 使用“武器平台”对应的界面 i18n

#### Scenario: Abandoned Ship Tooltip Ship Name

**前提** 用户点击弃船兴趣点标记
**当** 弃船有对应的 shipId
**那么** tooltip 显示 i18n 化的飞船名称
**并且** 使用 ship 的 nameId 进行翻译
**并且** 若 nameId 无翻译，使用 ship.name
**并且** 若无法找到 ship 数据，显示 shipId

---

### Requirement: Save Archive Upload in Sidebar

存档侧边栏保留上传功能。

#### Scenario: 用户在侧边栏上传存档

**前提** 存档侧边栏已打开（L1层）
**当** 用户拖放或点击选择存档文件
**那么** 存档开始解析
**并且** 解析完成后添加到存档列表
**并且** 显示解析进度/错误信息

---

### Requirement: Save Sidebar UI Theme Consistency

存档侧边栏样式与地图现有风格一致。

#### Scenario: UI风格一致性

**当** 存档侧边栏渲染
**那么** 使用以下样式：
- 背景：bg-black/80, border-amber-300/35
- 标题：text-amber-50, font-semibold
- 面包屑：text-amber-200/80
- checkbox：accent-amber-400
- 列表项：bg-black/45, border-amber-300/15
- 搜索框：bg-black/60, border-amber-300/30
