# Request: 多空间站帝国规划模式

## 概述

将现有的 X4: Foundations 空间站规划器界面从"单空间站模式"扩展为"多空间站 Tab页模式"，实现一个高度紧凑、上下文敏感的动态工具栏。

## 业务背景

当前应用仅支持单个空间站的规划，用户无法同时管理多个空间站组成的帝国网络。实际游戏场景中，玩家通常需要规划多个协同工作的空间站（如能源站、食品厂、船厂等），这些空间站之间存在资源流动和工人供给关系。

## 核心需求

### 1. 布局架构变更

```
┌─────────────────────────────────────────────────────────────┐
│  顶栏: 保存/加载/分享 (保持不变)                              │
├─────────────────────────────────────────────────────────────┤
│  标签栏: [📊 帝国总览] [🏭 食品厂] [⚡ 能源阵列] [+]          │
├─────────────────────────────────────────────────────────────┤
│  动态工具栏: 根据选中Tab显示不同内容 (核心任务)               │
├─────────────────────────────────────────────────────────────┤
│  内容区域: 总览视图 OR 分站三列布局                           │
└─────────────────────────────────────────────────────────────┘
```

### 2. 数据模型迁移 (V1 → V2)

#### V1 结构 (现有)
```typescript
// localStorage key: 'x4_station_data'
{
  version: 1,
  activeId: string | null,
  list: StationPlan[]
}
```

#### V2 结构 (目标)
```typescript
// localStorage key: 'x4_empire_data'
{
  version: 2,
  activeEmpireId: string | null,
  activeStationId: string | null,
  empires: EmpirePlan[]
}

interface EmpirePlan {
  id: string
  name: string                    // 方案总名称 (如 "X4 巨型复合体 v1")
  stations: StationPlan[]         // 所有分站
}

interface StationPlan {
  id: string
  name: string                    // 分站名称
  type: 'industrial' | 'supply' | 'transit' | 'shipyard'
  modules: SavedModule[]
  settings: StationSettings
  lockedWares?: string[]
  warePriority?: Record<string, number>
  lastUpdated: number
}
```

#### 迁移策略
- 检测 `version` 字段
- V1 数据自动包装为包含单个工业站的 V2 帝国方案
- 保持向后兼容，用户数据不丢失

### 3. 分站类型定义

| 类型 | 创建方式 | 计算逻辑 |
|------|---------|---------|
| **industrial (工业站)** | 默认类型，标签栏 [+] 按钮 | 现有逻辑，`calculateAutoFill` 生成工业区和补给区 |
| **supply (补给站)** | 帝国总览菜单"新建补给站" | 根据帝国所有工业站的工人需求总和生成补给模块，无工业区 |
| **transit (中转站)** | 自动判断（待添加） | 预留类型，逻辑待定义 |
| **shipyard (船厂)** | 自动判断（待添加） | 预留类型，逻辑待定义 |

### 4. 标签栏 功能

- **固定标签**: 第一个标签永远是 `[📊 帝国总览]`
- **动态标签**: 后续跟随用户创建的各个分站
- **[+] 按钮**: 新建工业站（默认类型）
- **分站菜单**: 
  - 重命名
  - 复制分站
  - 导入蓝图
  - 删除分站 (最后一项)

### 5. 动态工具栏

工具栏高度固定 `56px`，内容根据当前 Tab 动态变化。

#### 场景 1: 选中 [📊 帝国总览]

```
┌─────────────────────────────────────────────────────────────┐
│  [方案总名称输入框 - 大号无边框]                              │
└─────────────────────────────────────────────────────────────┘
```

- 一个大号、无边框的输入框，用于修改整个规划文件的名称
- 右侧留空或放置全局导出按钮

#### 场景 2: 选中任意分站 (单行紧凑布局)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [导入] [分站名称] [类型徽章] [x N] │ [💎 矿物] [☀️ 日光] │ [种族] [工人] [补给] │
└───────────────────────────────────────────────────────────────────────────────┘
```

**第一组：身份定义**
- **[图标按钮] 导入**: 点击弹出模态框
- **[输入框] 分站名称**: 无边框背景，加粗字体
- **[徽章] 类型**: 仅显示图标+简写 (`🏭 工业`, `📦 补给`)
- **[组合输入] 数量**: 显示为 `x N` 的小胶囊样式，设置建造数量倍率

**第二组：环境参数**
- **[徽章+气泡] 星区矿物**: 默认显示 `[💎 3]`，悬停/点击弹出多选菜单
  - 数据来源: `useGameDataStore` 中 tier=0 的矿物列表
  - 当前阶段: 仅显示/编辑，不影响计算
- **[输入框] 日光强度**: 显示为 `☀️ [ 100 ] %`

**第三组：技术与运营**
- **[下拉菜单] 偏好种族**: Argon/Terran/Teladi 等
- **[按钮开关] 工人运算**: 
  - 映射字段: `settings.considerWorkforceForAutoFill`
  - ON: 计算居住需求和产出加成，按钮变绿
  - OFF: 不计算，按钮变灰
- **[按钮开关] 站内补给**:
  - 映射字段: `settings.internalSupply`
  - ON: `calculateAutoFill` 时生成补给区
  - OFF: 补给从外部输入

### 6. 内容区域

#### 总览视图
- 显示 "Coming Soon" 占位符
- 后续迭代可扩展为帝国资源汇总

#### 分站视图
- 复用现有的三列布局组件
- 数据源绑定到**当前选中的 Station 对象**
- 组件: `StationPlanningPanel`, `StationWareFlowsDashboard`, `StationDashboard`

### 7. Store 重构方案

采用 **Store 组合模式**:

```typescript
// 新增: useEmpireStore.ts
export const useEmpireStore = defineStore('empire', () => {
  const version = ref(2)
  const activeStationId = ref<string | null>(null)
  const empire = ref<EmpirePlan>({
    id: '',
    name: '',
    stations: []
  })
  
  // 计算属性: 当前选中的分站
  const activeStation = computed(() => 
    empire.value.stations.find(s => s.id === activeStationId.value)
  )
  
  // 计算属性: 帝国总工人需求 (用于补给站)
  const totalWorkforceNeeded = computed(() => 
    empire.value.stations
      .filter(s => s.type === 'industrial')
      .reduce((sum, s) => sum + calculateWorkforceNeeded(s), 0)
  )
  
  // 迁移逻辑
  function migrateFromV1(v1Data: any) { ... }
})

// 保留: useStationStore.ts
// 但改为接收外部数据源，不再管理持久化
```

## 技术约束

1. **向后兼容**: V1 用户数据必须能自动迁移到 V2
2. **最小改动**: 保持现有计算逻辑不变
3. **组件复用**: 分站视图复用现有三列布局组件
4. **响应式设计**: 工具栏控件需适配不同屏幕宽度

## 验收标准

1. 用户可以创建、切换、删除多个分站
2. 标签栏正确显示所有分站
3. 工具栏根据选中 Tab 动态切换内容
4. V1 数据能正确迁移到 V2
5. 分站视图数据绑定正确
6. 总览视图显示 "Coming Soon" 占位符

## 风险与依赖

- **风险**: 数据迁移逻辑复杂，需充分测试
- **依赖**: 现有 `calculateAutoFill` 逻辑需适配多站场景
- **预留**: 中转站、船厂类型逻辑待后续迭代

## ADDED Requirements

### 8. activeStationId 持久化策略

#### 需求背景

用户切换 tab 时，当前选中的空间站需要实时跟踪，即便没有保存。刷新页面后应尽可能恢复到之前的 tab。

#### 核心需求

1. **实时跟踪**: 用户切换 tab 时，`activeStationId` 实时更新
2. **刷新恢复**: 刷新页面后，恢复到之前选中的 tab
3. **会话隔离**: 关闭浏览器后重新打开，恢复到最后保存的状态

#### 技术方案

**双层存储策略**:

| 存储位置 | 内容 | 更新时机 | 生命周期 |
|---------|------|---------|---------|
| `sessionStorage` | 当前 `activeStationId` | 切换 tab 时实时更新 | 会话期间（刷新不丢失，关闭浏览器清空） |
| `localStorage` | 保存时的 `activeStationId` | 用户点击保存时 | 永久 |

**恢复优先级**:
1. 优先从 `sessionStorage` 恢复（刷新场景）
2. 回退到 `localStorage`（关闭浏览器后重新打开）
3. 最后回退到第一个空间站

#### 场景分析

| 场景 | 行为 |
|------|------|
| 用户切换 tab（未保存） | `activeStationId` 实时更新 → `sessionStorage` 更新 |
| 用户保存帝国 | `savedEmpires.activeStationId` = `activeStationId` → `localStorage` 更新 |
| 刷新页面 | 优先从 `sessionStorage` 恢复 → 回退到 `localStorage` |
| 载入界面载入同一帝国 | 清除 `sessionStorage`，使用 `localStorage` 中的值 |
| 载入界面载入不同帝国 | 清除 `sessionStorage`，使用新帝国的第一个空间站 |
| 关闭浏览器后重新打开 | `sessionStorage` 清空，使用 `localStorage` |

#### 验收标准

1. 切换 tab 后刷新页面，停留在之前选中的 tab
2. 切换 tab 后保存，刷新页面，停留在选中的 tab
3. 切换 tab 后不保存，关闭浏览器重新打开，停留在保存时的 tab
4. 载入不同帝国后，停留在新帝国的第一个空间站

### 9. ContextToolbar UI 统一化

#### 需求背景

ContextToolbar 中的输入控件样式不统一，需要使用统一的 X4 风格组件。同时 StationPlanningPanel 中存在冗余的控件，需要清理。

#### 核心需求

**1. 光照输入框 UI 替换**
- **源**: `StationPlanningPanel.vue` 中的 `X4NumberInput` 组件
- **目标**: `ContextToolbar.vue` 中的光照输入框（`sunlight-wrapper`）
- **效果**: 使用统一的 X4 风格数字输入框

**2. 种族偏好下拉框 UI 替换**
- **源**: `StationPlanningPanel.vue` 中自动工业区的下拉框样式
- **目标**: `ContextToolbar.vue` 中的种族偏好下拉框
- **效果**: 统一下拉框样式

**3. 数量输入框 UI 替换**
- **源**: `X4NumberInput` 组件
- **目标**: `ContextToolbar.vue` 中的数量输入框（`count-pill`）
- **效果**: 使用 X4 风格数字输入框，去除前缀 "x"

**4. 去除 StationPlanningPanel 标题行**
- 删除整个 `header-row` div
- 包括：模块列表标题、光照输入框、分割线
- 效果：面板直接从搜索框开始

**5. 去除自动工业区冗余控件**
- 删除自动工业区标题旁边的：
  - checkbox（工人计算开关）
  - 种族偏好标签 + 下拉框
- 效果：只保留 "自动工业区" 标题

#### 视觉效果对比

**修改前**:
```
ContextToolbar:
  [名称] [类型] [数量 x[1]] | [资源] [光照 ☀️ 100%] | [工人] [补给] [种族下拉]
                              ↑ count-pill           ↑ sunlight-wrapper

StationPlanningPanel:
  ┌─────────────────────────────────────┐
  │ 模块列表           光照 [X4Number] │  ← header-row
  ├─────────────────────────────────────┤  ← 分割线
  │ [搜索框]                            │
  │ ...模块列表...                      │
  │                                     │
  │ 自动工业区  [✓工人] [种族下拉]      │  ← 冗余控件
  │ ...自动模块...                      │
  └─────────────────────────────────────┘
```

**修改后**:
```
ContextToolbar:
  [名称] [类型] [数量 X4Number] | [资源] [光照 X4Number] | [工人] [补给] [种族下拉-新样式]
                              ↑ 统一样式              ↑ 统一样式

StationPlanningPanel:
  ┌─────────────────────────────────────┐
  │ [搜索框]                            │  ← 直接从搜索框开始
  │ ...模块列表...                      │
  │                                     │
  │ 自动工业区                          │  ← 只保留标题
  │ ...自动模块...                      │
  └─────────────────────────────────────┘
```

#### 验收标准

1. ContextToolbar 中光照、数量输入框使用 X4NumberInput 样式
2. ContextToolbar 中种族下拉框样式统一
3. StationPlanningPanel 无标题行和分割线
4. StationPlanningPanel 自动工业区无冗余控件
5. 所有输入控件高度统一到 24px (h-6)
6. 工人运算和站内补给开关标签移到按钮外部
7. ContextToolbar 和 StationTabBar 完成 i18n 国际化

### 10. 开关数据源修正

#### 需求背景

原有设计中"站内补给"和"补给区自动工人"绑定到同一个字段，导致功能混淆。需要明确区分两个独立的开关功能。

#### 核心需求

**1. 站内补给开关**
- **数据源**: `settings.internalSupply`
- **功能**: 控制 `calculateAutoFill` 是否生成补给区
- **ON**: 生成补给区模块
- **OFF**: 补给从外部输入

**2. 工人运算开关**
- **数据源**: `settings.considerWorkforceForAutoFill`
- **功能**: 统一控制工业区和补给区的工人需求计算
- **ON**: 工业区和补给区都计算工人需求，享受效率加成
- **OFF**: 所有模块按基础产能计算

**3. 移除 supplyWorkforceBonus 字段**
- 该字段功能已被 `considerWorkforceForAutoFill` 统一替代
- 移除自动补给区标题旁的 checkbox

#### 验收标准

1. 站内补给开关绑定到 `internalSupply`
2. 工人运算开关统一控制工业区和补给区
3. `supplyWorkforceBonus` 字段已从类型定义和 Store 中移除
4. 自动补给区无独立的工人开关 checkbox
