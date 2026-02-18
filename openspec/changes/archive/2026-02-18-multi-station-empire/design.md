## Context

当前应用采用单空间站架构，`useStationStore` 管理单个空间站的完整状态（模块、设置、方案）。用户无法同时管理多个空间站组成的帝国网络。

现有数据存储结构：
- localStorage key: `x4_station_data`
- 结构: `{ version: 1, activeId: string | null, list: StationPlan[] }`

需要扩展为多空间站架构，同时保持向后兼容。

## Goals / Non-Goals

**Goals:**
- 实现多空间站 Tab 页切换模式
- 实现动态工具栏，根据选中 Tab 显示不同内容
- 实现 V1 → V2 数据迁移，保持向后兼容
- 实现补给站类型，根据帝国总工人需求生成补给模块
- 站内补给开关控制 `calculateAutoFill` 是否生成补给区

**Non-Goals:**
- 中转站、船厂类型的完整实现（预留类型，逻辑待后续迭代）
- 星区矿物限制功能（仅显示/编辑，不影响计算）
- 帝国总览详细视图（仅显示 "Coming Soon" 占位符）
- 修改 `calculateAutoFill` 核心计算逻辑

## Decisions

### D1: Store 组合模式

**决策**: 采用 Store 组合模式，新增 `useEmpireStore` 管理帝国级状态，保留 `useStationStore` 作为单站逻辑。

**理由**:
- 最小化改动，保持现有计算逻辑不变
- 职责分离清晰：Empire 管理多站切换，Station 管理单站计算
- 便于后续扩展（如跨站资源流动分析）

**替代方案**: 扩展现有 `useStationStore` 为多站模式
- 缺点: 改动范围大，风险高，计算逻辑需要大量重构

### D2: 数据迁移策略

**决策**: 检测 localStorage 中的 `version` 字段，V1 数据自动包装为 V2 帝国方案。

**迁移逻辑**:
```typescript
// V1 → V2 迁移
function migrateFromV1(v1Data: V1Data): V2Data {
  return {
    version: 2,
    activeStationId: v1Data.activeId,
    empire: {
      id: crypto.randomUUID(),
      name: 'Migrated Empire',
      stations: v1Data.list.map(plan => ({
        ...plan,
        type: 'industrial' as const
      }))
    }
  }
}
```

**理由**: 保持向后兼容，用户数据不丢失。

### D3: 补给站计算逻辑

**决策**: 补给站根据帝国所有工业站的工人需求总和生成补给模块。

**实现**:
- 补给站不运行 `calculateAutoFill` 的工业区逻辑
- 补给站仅生成补给模块（医疗、食品等）
- 补给模块数量 = 帝国总工人需求 / 模块容量

**理由**: 符合游戏实际场景，补给站为整个帝国服务。

### D4: 站内补给开关

**决策**: `settings.supplyWorkforceBonus` 控制工业站是否在站内生成补给区。

**逻辑**:
- `supplyWorkforceBonus = true`: 工业站运行 `calculateAutoFill` 时生成补给区
- `supplyWorkforceBonus = false`: 工业站不生成补给区，补给从外部输入（如独立补给站）

**理由**: 支持两种补给模式：站内自给 vs 独立补给站。

### D5: 标签栏组件设计

**决策**: 标签栏作为独立组件 `StationTabBar.vue`，包含标签切换和右键菜单功能。

**当前实现**:
```
src/components/StationTabBar.vue  # 单一组件，包含所有功能
```

**功能**:
- 固定"帝国总览"标签
- 动态分站标签列表
- [+] 新建工业站按钮
- 右键菜单（重命名、复制、导入、删除）
- 删除确认对话框

**规划中的模块化结构**:
```
StationTabBar/
├── StationTabBar.vue          # 主组件
├── StationTab.vue             # 单个标签组件
├── StationContextMenu.vue     # 右键菜单组件
└── types.ts                   # 类型定义
```

**理由**: 当前单一组件实现满足功能需求，后续可根据复杂度增长进行模块化重构。

## Risks / Trade-offs

### R1: 数据迁移失败风险
- **风险**: V1 数据结构复杂或损坏，迁移失败
- **缓解**: 迁移前备份原始数据，失败时回退并提示用户

### R2: Store 状态同步复杂度
- **风险**: Empire Store 和 Station Store 状态同步问题
- **缓解**: 使用 computed 属性派生状态，避免双向绑定

### R3: 组件复用兼容性
- **风险**: 现有三列布局组件绑定到全局 Store
- **缓解**: 通过 props 传入当前分站数据，或使用 provide/inject

## ADDED Decisions

### D6: activeStationId 持久化策略

**背景**: 用户切换 tab 时，当前选中的空间站需要实时跟踪，即便没有保存。刷新页面后应尽可能恢复到之前的 tab。

**决策**: 使用 sessionStorage 实时跟踪当前 tab，localStorage 只在保存时更新。

**数据结构**:
```typescript
interface SavedEmpiresState {
  version: number
  activeId: string | null           // 当前激活的帝国 ID
  activeStationId: string | null    // 上次保存时的空间站 ID（localStorage）
  list: EmpirePlan[]
}

// sessionStorage 键
const SESSION_ACTIVE_STATION_KEY = 'x4_active_station_id'

// 内存中的实时状态
const activeEmpire = ref<EmpirePlan | null>(null)
const activeStationId = ref<string | null>(null)  // 当前选中的空间站（实时）
```

**持久化策略**:

| 存储位置 | 内容 | 更新时机 |
|---------|------|---------|
| `sessionStorage` | 当前 `activeStationId` | 切换 tab 时实时更新 |
| `localStorage` | 保存时的 `activeStationId` | 用户点击保存时 |

**恢复逻辑**:
```typescript
function loadData(data: SavedEmpiresState) {
  savedEmpires.value = data
  if (data.activeId) {
    const empire = data.list.find(e => e.id === data.activeId)
    if (empire) {
      activeEmpire.value = JSON.parse(JSON.stringify(empire))
      
      // 优先从 sessionStorage 恢复当前 tab
      const sessionTabId = sessionStorage.getItem(SESSION_ACTIVE_STATION_KEY)
      if (sessionTabId && empire.stations.find(s => s.id === sessionTabId)) {
        activeStationId.value = sessionTabId
      } 
      // 回退到 localStorage 中保存的 tab
      else if (data.activeStationId && empire.stations.find(s => s.id === data.activeStationId)) {
        activeStationId.value = data.activeStationId
      } 
      // 最后回退到第一个空间站
      else {
        activeStationId.value = empire.stations[0]?.id || null
      }
    }
  }
  takeSnapshot()
}

function selectStation(stationId: string | null) {
  activeStationId.value = stationId
  // 实时持久化到 sessionStorage
  if (stationId) {
    sessionStorage.setItem(SESSION_ACTIVE_STATION_KEY, stationId)
  } else {
    sessionStorage.removeItem(SESSION_ACTIVE_STATION_KEY)
  }
}
```

**场景分析**:

| 场景 | 行为 |
|------|------|
| 用户切换 tab（未保存） | `activeStationId` 实时更新 → `sessionStorage` 更新 |
| 用户保存帝国 | `savedEmpires.activeStationId` = `activeStationId` → `localStorage` 更新 |
| 刷新页面 | 优先从 `sessionStorage` 恢复 → 回退到 `localStorage` |
| 载入界面载入同一帝国 | 清除 `sessionStorage`，使用 `localStorage` 中的值 |
| 载入界面载入不同帝国 | 清除 `sessionStorage`，使用新帝国的第一个空间站 |
| 关闭浏览器后重新打开 | `sessionStorage` 清空，使用 `localStorage` |

**理由**: 
- `sessionStorage` 在会话期间保持，刷新不丢失，关闭浏览器后清空
- `localStorage` 作为持久化备份，保存时更新
- 实时跟踪用户操作，刷新后恢复到之前的 tab
- 关闭浏览器后重新打开，恢复到最后保存的状态

### D7: ContextToolbar UI 统一化

**背景**: ContextToolbar 中的输入控件样式不统一，需要使用统一的 X4 风格组件。同时 StationPlanningPanel 中存在冗余的控件，需要清理。

**决策**: 统一使用 `X4NumberInput` 组件，清理冗余 UI。

**修改内容**:

| 组件 | 修改项 | 说明 |
|------|--------|------|
| `ContextToolbar.vue` | 光照输入框 | 用 `X4NumberInput` 替换 `sunlight-wrapper` |
| `ContextToolbar.vue` | 数量输入框 | 用 `X4NumberInput` 替换 `count-pill` |
| `ContextToolbar.vue` | 种族下拉框 | 用 `StationPlanningPanel` 的下拉框样式 |
| `StationPlanningPanel.vue` | 删除 `header-row` | 去除标题行和分割线 |
| `StationPlanningPanel.vue` | 删除自动工业区控件 | 去除 checkbox 和种族下拉 |

**理由**:
- 统一 UI 风格，提升用户体验
- 减少重复控件，降低维护成本
- 光照和数量控件已在 ContextToolbar 中，无需在面板中重复

### D8: 开关数据源修正

**背景**: 原有设计中"站内补给"和"补给区自动工人"绑定到同一个字段 `supplyWorkforceBonus`，导致功能混淆。

**决策**: 明确区分两个独立的开关功能，移除冗余字段。

**修改内容**:

| 开关 | 数据源 | 功能 |
|------|--------|------|
| 站内补给 | `internalSupply` | 控制是否生成补给区 |
| 工人运算 | `considerWorkforceForAutoFill` | 统一控制工业区和补给区的工人计算 |

**移除内容**:
- `supplyWorkforceBonus` 字段（类型定义、Store 默认值）
- 自动补给区标题旁的 checkbox

**理由**:
- 补给区现在与主站"一体化"，工人效率统一计算
- `considerWorkforceForAutoFill` 已能控制所有工人运算，无需额外开关
- 简化用户界面，减少混淆

### D9: 输入控件高度统一

**背景**: ContextToolbar 中各输入控件高度不一致，导致视觉不齐。

**决策**: 所有输入控件统一到 `h-6` (24px) 高度。

**修改内容**:
- `ghost-input`: `h-7` → `h-6`
- `ghost-select`: `h-7` → `h-6`
- 星区资源框: `h-7` → `h-6`
- 工人运算/站内补给按钮: `h-9` → `h-6`

**理由**: 统一视觉高度，提升界面整洁度

### D10: i18n 国际化

**背景**: ContextToolbar 和 StationTabBar 中存在硬编码中文文字。

**决策**: 所有文字替换为 i18n 翻译键。

**新增翻译键**:
- `toolbar.*`: 工具栏相关文字
- `empire.*`: 帝国管理相关文字
- `ui.cancel`, `ui.delete`: 通用操作文字

**理由**: 支持多语言，符合项目国际化标准

## Migration Plan

### 阶段 1: 数据层重构
1. 新增类型定义 (`EmpirePlan`, `StationType`)
2. 创建 `useEmpireStore.ts`
3. 实现 V1 → V2 迁移逻辑
4. 更新 localStorage 读写

### 阶段 2: UI 层重构
1. 创建 `StationTabBar.vue`
2. 创建 `ContextToolbar.vue`
3. 重构 `StationWorkbench.vue` 架构
4. 更新 `StationToolbar.vue` 为动态模式

### 阶段 3: 功能完善
1. 实现分站 CRUD 操作
2. 实现补给站计算逻辑
3. 添加 i18n 翻译键

### 回滚策略
- 保留 V1 数据读取能力
- 提供"导出为 V1 格式"功能（如需回退）
