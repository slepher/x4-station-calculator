# design.md — blueprint-view

## 架构

### 三层结构

```
useGameDataStore（数据层）
    │ blueprints.json 加载 → blueprintsData computed
    │
    ▼
useBlueprintRecipePresenter（Presenter 层）
    │ 组装 UI 数据：导航树、过滤列表、搜索
    │ 管理 UI 状态：selectedClass、searchQuery
    │
    ▼
BlueprintRecipeWorkbench.vue（Vue 层）
    │ 左侧导航 + 右侧列表渲染
```

### 组件树

```
BlueprintProductionWorkbenchView.vue
    ├── ProductionSidebar（新增「蓝图配方」菜单）
    ├── BlueprintRecipeWorkbench.vue（新增）
    │       ├── 左侧：type/class 导航树
    │       └── 右侧：搜索框 + 蓝图条目列表
    ├── BlueprintContextToolbar（blueprint-recipe 模式下隐藏）
    ├── TerraformingWorkbench
    └── ResearchWorkbench
```

### Workbench 模式集成

```
activeViewStore.activeEmpireWorkbench
    ├── 'overview'       → 帝国总览
    ├── 'station'        → 空间站规划
    ├── 'terraforming'   → 地球化
    ├── 'research'       → 研究
    └── 'blueprint-recipe' → 蓝图配方（新增）
```

`useBlueprintProductionStore.resetWorkbenchType()`:
```typescript
case 'blueprint-recipe': return 'blueprint-recipe'
```

## 关键决策

### 1. Player-Owned 高亮：蓝图模式不实现

- 蓝图模式下不显示玩家已拥有标记
- 未来在实况界面开放此菜单时，通过 `player_blueprints: string[]` 数据实现高亮
- 当前设计不在 presenter/store 中预留 owned 标记字段，避免过度设计

### 2. 选中 class 状态管理

- 选中 `type` 和 `class` 的 UI 状态由 `useBlueprintRecipePresenter` 内部 `ref` 管理
- 不在 store 中持久化（页面切换后重置为默认状态）
- 默认选中第一个 type 的第一个 class

### 3. 数据来源：blueprints.json 一次性加载

- `blueprints.json` 在 `useGameData.ts` 中与其他 game data 文件一起加载
- 不在运行时按需加载或分页
- ~13,000 条数据全部加载到内存，前端做过滤和展示

### 4. 本地化名称解析

- 优先级：`nameId` i18n 解析 → 回退 `name` 字段
- `types` 和 `classes` 数组中的 `nameId` 同样按此优先级

### 5. 侧边栏菜单位置

- 在 `ProductionSidebar.vue` 的 `fixedItems` computed 中，硬编码插在 overview 之后、research 之前
- `showBlueprintRecipe` = `!hasSectors`（仅在蓝图模式显示）
- 不与 live/save-binding 模式耦合

### 6. 无 ContextToolbar

- `BlueprintContextToolbar` 的 `v-if` 已有 `mode !== 'terraforming' && mode !== 'research'` 条件
- 增加 `&& mode !== 'blueprint-recipe'`

### 7. 导航结构

```
左侧导航 (PageNav)
├── 生产模块 (type: module)
│   ├── production
│   ├── storage
│   ├── dockarea
│   └── ...
├── 飞船 (type: ship)
│   ├── ship_s
│   ├── ship_m
│   ├── ship_l
│   └── ship_xl
└── 装备 (type: equipment)
    ├── engine
    ├── shields
    ├── weapon
    ├── turret
    └── ...
```

### 8. 类型定义

#### 新增类型 (`src/types/x4.ts`)

```typescript
export interface X4Blueprint {
  id: string
  name: string
  nameId: string
  type: 'module' | 'ship' | 'equipment'
  class: string
  price?: number
  licence?: string
  factions?: string[]
  missiononly?: boolean
  noplayerblueprint?: boolean
}

export interface BlueprintTypeCategory {
  id: string
  name: string
  nameId: string
}

export interface BlueprintClassCategory {
  id: string
  name: string
  nameId: string
  type: string
}

export interface BlueprintsData {
  blueprints: X4Blueprint[]
  types: BlueprintTypeCategory[]
  classes: BlueprintClassCategory[]
}
```

#### 类型扩展

- `ProductionTabItem.type` 增加 `'blueprint-recipe'`
- `activeEmpireWorkbench` 增加 `'blueprint-recipe'`
- `SidebarPresenterStore.session.workbenchMode` 增加 `'blueprint-recipe'`
- `GameDataFiles` 增加 `blueprints: BlueprintsData`

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/x4.ts` | 修改 | 新增 X4Blueprint, BlueprintTypeCategory, BlueprintClassCategory, BlueprintsData |
| `src/types/production-ui.ts` | 修改 | type union 增加 'blueprint-recipe' |
| `src/store/useActiveViewStore.ts` | 修改 | activeEmpireWorkbench 增加 'blueprint-recipe' |
| `src/store/logic/useGameData.ts` | 修改 | GameDataFiles 增加 blueprints，加载 blueprints.json |
| `src/store/useGameDataStore.ts` | 修改 | 暴露 blueprintsData computed |
| `src/store/useBlueprintProductionStore.ts` | 修改 | 新增 selectBlueprintRecipe()，resolveWorkbenchType() 增加分支 |
| `src/components/empire/presenters/useProductionSidebarPresenter.ts` | 修改 | 新增 showBlueprintRecipe, selectBlueprintRecipe emit |
| `src/components/empire/ProductionSidebar.vue` | 修改 | 新增菜单项、图标、click 处理、props |
| `src/components/empire/BlueprintProductionWorkbenchView.vue` | 修改 | 新增 BlueprintRecipeWorkbench 路由、隐藏 ContextToolbar |
| `src/components/empire/presenters/useBlueprintRecipePresenter.ts` | **新建** | Presenter 层 |
| `src/components/empire/BlueprintRecipeWorkbench.vue` | **新建** | 蓝图配方页面组件 |
| `src/components/icons/blueprint.svg` | **新建** | 菜单图标 |
| `src/locales/zh-CN.json` | 修改 | blueprint_recipe, mission_only, noplayerblueprint etc. |
| `src/locales/en.json` | 修改 | 同上的英语键值 |
