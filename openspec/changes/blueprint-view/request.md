# request.md — blueprint-view

## 目标

在蓝图产能界面的侧边栏中，于「研究」菜单之上新增「蓝图配方」菜单，点击后展示一个蓝图目录页面。该页面以左侧按 class 分类导航 + 右侧蓝图列表的方式，展示 `blueprints.json` 中所有非 `noblueprint` 的蓝图条目，供用户查阅游戏内所有可获取的蓝图信息。页面无 ContextToolbar。

## 已确认方案（审核重点）

### 1. 侧边栏菜单

- 在 `blueprint` 模式下，侧边栏 `fixedItems` 新增 `{ id: 'blueprint-recipe', type: 'blueprint-recipe', name: '蓝图配方' }`
- 位置：Overview 之下、Research（研究）之上
- 新图标 `blueprint.svg`
- 仅在蓝图模式（`!hasSectors`）下显示，实况（live/save-binding）模式暂不显示

### 2. 蓝图配方页面

#### 2.1 布局

- **无 ContextToolbar**（与 terraforming / research 模式一致）
- **左侧导航**：按 `type`（module / ship / equipment）→ `class` 两级树形结构
  - `type` 和 `class` 的显示名从 `blueprints.json` 中的 `types` / `classes` 数组获取，通过 `nameId` 走 i18n 本地化
  - type 分组可折叠展开
- **右侧内容**：选中 class 后展示该 class 下的所有蓝图条目

#### 2.2 数据来源

- `blueprints.json` 文件，通过 `useGameData.ts` 的 `loadJsonFromBundle` 加载
- 蓝图条目字段：`id`, `name`, `nameId`, `type`, `class`, `price`, `licence`, `factions`, `missiononly`, `noplayerblueprint`

#### 2.3 每条蓝图显示内容

| 信息 | 说明 |
|------|------|
| 本地化名称 | 通过 `nameId` + i18n 获取 |
| id | 原始 ID |
| class | 所属子类 |
| price | 价格（缺失不显示） |
| licence | 所需执照（缺失不显示） |
| factions | 所属阵营标签（缺失不显示） |
| 特殊标记 | `missiononly: true` 和 `noplayerblueprint: true` 分别显示 badge |

#### 2.4 搜索过滤

- 搜索框，按名称、id、阵营名称过滤
- 左侧导航联动：当前选中 class 被过滤时，标记为空状态

#### 2.5 玩家已拥有蓝图

- **蓝图模式不显示**玩家已拥有标记
- 未来在实况（live）界面开放此菜单时，通过 `player_blueprints: string[]` 数据做 owned 高亮

### 3. 架构

- 严格遵循 `store → presenter → vue` 三层结构
- 新增 `useBlueprintRecipePresenter` 面向 UI 组装数据
- 蓝图数据通过 `useGameDataStore` 加载和暴露
- 侧边栏的 `showBlueprintRecipe` 逻辑在 `useProductionSidebarPresenter` 中控制

### 4. workbench 模式

- 新增 `'blueprint-recipe'` 作为 `activeEmpireWorkbench` 的有效值
- `resolveWorkbenchType()` 映射 `'blueprint-recipe'`
- 与 terraforming / research 同级处理

### 5. 蓝图数据多 faction 修复

- 原 `build.py` 使用 `elem.find("owner")` 仅取第一个 owner，导致多 faction 蓝图丢失 faction
- 改为 `elem.findall("owner")` 收集全部 owner，每条蓝图正确列出所有所属派系

### 6. 布局调整

- 名称 + 价格同排（价格靠右）
- factions + licences 独立区域，每个派系显示其专属 licence 名称
- 隐藏原始 ID，仅显示本地化名称
- `noplayerblueprint: true` 的蓝图默认不显示

## 边界

### In Scope

- 蓝图产能界面侧边栏新增「蓝图配方」菜单
- 蓝图配方页面：左侧 type/class 导航 + 中间 filter 面板 + 右侧蓝图列表
- Filter 面板：Faction 多选 + Licence 多选（全选/取消），切换 class 时不重置值
- Faction 与 Licence 过滤为 AND 关系，Faction 组内为 OR
- 蓝图列表：名称+价格同行，factions+licences 独立区域
- licence 名称优先取 faction 专属 nameId，无匹配时不显示
- `noplayerblueprint` 蓝图默认隐藏
- `ownerless` 蓝图不被 faction 过滤拦截
- `blueprints.json` 在 `useGameData` 中加载
- 蓝图数据多 faction 修复：`findall("owner")` 替代 `find("owner")`
- factions.json 含 per-faction `licences` 数组（由 faction-runner 提供）
- 新图标 SVG + i18n 键值（含 `licence.` Vue i18n 命名空间）

### Out of Scope

- 实况（live）界面的蓝图配方菜单（未来计划）
- 玩家已拥有蓝图高亮（实况模式专属，未来实现）
- 蓝图导入到空间站计划
- 测试代码

## 验收标准（DoD）

1. `npm run build` 成功
2. 蓝图产能界面侧边栏显示「蓝图配方」菜单，位于「研究」之上
3. 点击进入蓝图配方页面，无 ContextToolbar
4. 左侧按 module/ship/equipment → class 两级导航，初始全部展开
5. 中间 Filter 面板：Faction + Licence 多选过滤，全选/取消
6. 右侧展示选中 class 的蓝图列表，无 class 时列表为空
7. 每条蓝图显示本地化名称+价格同行，faction+licence 成对显示
8. licence 仅在有 faction 匹配时显示，无匹配时不显示
9. 只在蓝图模式显示，实况模式不显示

## 未决项

无
