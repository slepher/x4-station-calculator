# user-save-map Change Request

## 目标

将 user-save 模块移植到 map 模块，实现存档兴趣点在地图上的可视化显示和交互导航。

## 已确认方案（审核重点）

### 入口位置

- 地图底部按钮组增加"存档"入口按钮，与"资源/空间站"并列
- 点击打开侧边栏，显示存档管理界面

### 层叠导航结构

采用**替换侧边栏内容**形式，配合面包屑导航：

| 层级 | 内容 | 面包屑显示 |
|------|------|-----------|
| L1 | 存档列表（含上传功能） | 存档 |
| L2 | 7个分类子菜单（仅导航入口） | 存档 → 存档名 |
| L3 | 坐标列表（按星区分组，带搜索） | 存档 → 存档名 → 分类名 |

### 7个分类子菜单

按 post-process 后的兴趣点分组展示：

| 序号 | 分类名 | 数据来源 | 筛选条件 |
|------|--------|----------|----------|
| 1 | 玩家空间站 | `playerStations` | 全部 |
| 2 | 势力空间站 | `npcStations` | 全部 |
| 3 | Xenon空间站 | `xenonStations` | 全部 |
| 4 | Khaak空间站 | `khaakStations` | 全部 |
| 5 | 弃船 | `abandonedShips` | 全部 |
| 6 | 日志数据仓库 | `datavaults` | 全部 |
| 7 | 妖王配件数据仓库 | `erlkingVaults` | 全部 |

**is_headquarter 判定规则**：
- 仅对玩家空间站（`owner === 'player'`）生效
- 判定条件（满足任一）：
  1. station 的 modules 中存在 `ref` 包含 `player_hq_` 字符串
  2. station 对象本身已有 `is_headquarter = true`（parser 阶段识别）
- 判定位置：`src/workers/saveParser.post.ts` 的 `enrichPlayerStation` 函数
- 注意：检查的是 **module 的 ref/macro**，而非 station 的 macro

### POI 显示控制（右上角折叠菜单）

- 位置：地图右上角，与左上角搜索框对称
- 样式：与左上角/左下角/右下角控件一致（黑色背景 + amber 边框 + 模糊）
- 默认状态：**折叠态**，仅显示触发按钮
- 展开后：显示 7 个分类 checkbox 列表
- 显示条件：仅当已选择存档时显示该控件
- checkbox 默认状态：**全不选**
- 不持久化：每次选择存档重置为默认状态
- 勾选后：对应类别的兴趣点显示在地图上

### 分类层导航

- 分类层仅作为导航入口，**不包含 checkbox**
- 分类层显示：分类名称 + 数量统计 + 右侧箭头按钮
- **进入详情只允许点击右侧箭头按钮**，整行不再作为进入详情的点击区
- 当用户通过右侧箭头进入某个类别的坐标列表时，即使该类别 checkbox 未勾选，地图也要**临时显示**该类别兴趣点，便于列表定位与核对
- 从坐标列表返回分类层后，如果该类别 checkbox 仍未勾选，临时显示状态消失，不得偷偷改写 checkbox 状态

### 地图兴趣点标记

- 初期使用**小圆点**图标（后续可替换为实际图标）
- 标记上方显示该实体的 `code` 字段
- 不同分类使用不同颜色区分

### 坐标列表层

- 按星区分组显示坐标点
- 提供搜索框，可筛选星区名称
- 点击坐标项 → 地图平移+缩放使兴趣点居中

### Tooltip交互

- 点击地图上兴趣点 → 显示 tooltip
- Tooltip 内容：分类名、owner、坐标、code 等

### 空间站命名与生产画像

- 对 `playerStations` 与 `npcStations` 在 post-process 阶段补充 `productionProfile` / `profileName`
- `xenonStations` 与 `khaakStations` 不计算 `productionProfile`
- `productionProfile` 规则：
  - 单一生产模块：写 `module_id`
  - 同一 `group` 的多种生产模块：写单个 `group id`
  - 落在同一优先级簇的多 `group`：按优先级落单个 `group id`
    - 技术簇优先级：`shiptech > hightech > refined`
    - 生活簇优先级：`pharmaceutical > agricultural > food > water`
  - 跨簇混合：写 `mixed`
- `energy` 不参与分组判断；若仅生产 `energycells`，仍按单一模块处理
- 地图 POI 列表与 tooltip 使用同一套 i18n 命名规则：
  - `tag="factory"`:
    - `module_id` → 游戏 module i18n
    - `group id` → 游戏 module_group i18n
    - `mixed` → 显示“综合体”
  - `tag!="factory"`：使用 tag 对应的界面 i18n
  - `khaakStation` 的 `tag="weaponplatform"` → 显示“武器平台”
- `is_headquarter=true` 时：
  - 玩家空间站名称直接显示“总部”
  - 所有空间站在列表中额外显示绿色“总部”药丸标签
  - 所有空间站在 tooltip 中额外显示一行“总部”

### UI风格

- 复用地图现有 amber/深色主题
- 侧边栏样式与 MapStationPanel 保持一致

## 边界

### In Scope

- 地图底部"存档"入口按钮
- 三层侧边栏导航（存档列表 → 分类子菜单 → 坐标列表）
- 右上角 POI 显示控制折叠菜单
- Checkbox 控制兴趣点显示
- 地图兴趣点标记（小圆点 + code 标签）
- 面包屑导航组件
- 坐标列表搜索筛选
- 点击坐标 focus 到兴趣点
- 兴趣点 tooltip

### Out of Scope

- Checkbox 状态持久化
- 实际兴趣点图标设计（初期用小圆点）
- 存档详情的其他功能（导出、删除在存档列表层处理）
- 原有 SaveImportView 界面的修改（保留原有视图作为独立入口）

## 验收标准（DoD）

1. 地图底部显示"存档"按钮，与"资源/空间站"按钮并列
2. 点击存档按钮，侧边栏显示存档上传区域和存档分组列表
3. 点击存档项，侧边栏切换为 7 个分类子菜单，面包屑显示"存档 → 存档名"
4. 选择存档后，地图右上角显示 POI 显示控制按钮
5. 点击右上角按钮展开，显示 7 个分类 checkbox 列表
6. 勾选 checkbox，对应类别的兴趣点显示在地图上
7. 取消勾选 checkbox，对应类别的兴趣点从地图上移除
8. 点击分类右侧箭头按钮，侧边栏切换为坐标列表（按星区分组），面包屑显示"存档 → 存档名 → 分类名"
9. 在 checkbox 未勾选的情况下，通过右侧箭头进入某分类详情时，地图仍临时显示该分类兴趣点；返回分类层后恢复为未显示
10. 坐标列表有搜索框，输入文字可筛选星区名称
11. 点击坐标项，地图平移+缩放使兴趣点居中显示
12. 每个兴趣点标记上方显示该实体的 `code` 字段
13. 点击地图上兴趣点，显示 tooltip（包含分类名、owner、坐标等基本信息）
14. 面包屑导航可点击返回上一层
15. 各分类使用不同颜色标记区分
16. 玩家/NPC 空间站在地图 POI 列表与 tooltip 中按 `productionProfile` 规则显示本地化命名
17. 玩家总部名称显示为"总部"，所有 `is_headquarter=true` 的空间站额外显示"总部"标签与 tooltip 行
18. UI 风格与地图现有 amber/深色主题一致，save 面板 scrollbar 与 resource 面板统一
19. 右上角控件样式与左上角/左下角/右下角控件对称一致

## 未决项

无
