# build-plan-storage 需求

## 目标

将建造目标（buildGoals）持久化到 localStorage，以"方案"为保存单元，替代当前静态"建造规划"标题为可编辑的方案名，并将 logic-flow 菜单和建材产线 checkbox 移到计算按钮上方同一行。

## 已确认方案（审核重点）

### 数据模型

```typescript
interface SavedBuildPlanGoalsState {
  version: number
  activeId: string | null
  list: BuildPlanGoalSnapshot[]
}

interface BuildPlanGoalSnapshot {
  id: string              // crypto.randomUUID()
  name: string            // useTitleEditor 编辑
  buildGoals: BuildGoal[] // 仅用户手动添加的 production-rate / build-module
  logicFlowPlanId: string | null  // 关联的逻辑产线方案 id，加载时若不存在则 fallback 到 undefined
  lastUpdated: number
}
```

- `version` 初始为 `1`，对应 `CURRENT_BUILD_PLAN_GOALS_VERSION`
- 持久化对象**仅包含 `buildGoals`**，不含 `buildFlowMode` / `previewResult` / `computeResult` 等计算结果

### 存储位置

- 独立 localStorage key，通过 `gameData.getStorageKey('build_plan_goals')` 区分游戏版本
- `getStorageKey` 的 module 参数需新增 `'build_plan_goals'` 选项
- 管理逻辑放在 `useBuildPlanStore` 内（新增 `savedPlans` ref 及 save/load 方法）

### 保存行为

- **自动保存**：以下时机均自动保存当前方案到 localStorage
  - `buildGoals` 变更（增/删/改参数）
  - 方案名编辑确认（`useTitleEditor.confirmEditing`）
  - 切换逻辑产线方案时自动更新 `logicFlowPlanId` 并保存
- **首次添加目标**：无 `activeId` 时自动创建默认方案并激活
  - 默认命名 "建造规划 N"，N = `savedPlans.list.length + 1`
  - 无方案时标题显示 `getDefaultName()` = "建造规划"
- **无存量迁移**：当前 `buildGoals` 本就不持久化，刷新即丢失

### 方案管理

- **新建**：菜单列表顶部 "新建" 项，点击立即创建空方案并切换（默认命名 "建造规划 N"，N = `list.length + 1`）
- **切换**：直接加载方案的 `buildGoals` + 尝试还原 `logicFlowPlanId`，无确认弹窗
- **删除**：列表中每项有 x 按钮，点击直接删除；若删除当前激活方案则切换到列表中下一个，若无则 `activeId = null`
- **排序**：按创建顺序（列表顺序），"新建"始终在顶部
- **高亮**：当前 `activeId` 对应项高亮，"新建"不高亮
- **id 生成**：`crypto.randomUUID()`

### logicFlowPlanId 联动

- 切换逻辑产线方案时，自动更新当前建造目标方案的 `logicFlowPlanId` 并保存
- 加载建造目标方案时，尝试还原关联的逻辑产线方案；若 id 不存在则 fallback（不加载任何逻辑产线方案）

### UI 布局变更

#### Panel-header

- **左侧**：方案名标题（`useTitleEditor` 编辑，无方案时回退显示 `getDefaultName()` = "建造规划"）
- **右侧**：方案菜单按钮（复用当前 logic-flow 菜单的按钮+浮动下拉形态）
  - 菜单列表第一项为 "新建"
  - 每个方案项右侧有 x 删除按钮
  - 当前 `activeId` 对应项高亮

#### Panel-content

计算按钮上方新增一行：

```
[建材产线 checkbox 靠左] ·········· [logic-flow 菜单按钮靠右]
[              计算 按钮              ]
```

- checkbox 靠左对齐，logic-flow 菜单靠右对齐
- logic-flow 菜单保持原 UI 形态（按钮显示当前逻辑产线方案名 + 浮动下拉列表）

### buildFlowMode

- 不持久化，切换建造目标方案时保持当前值不变

### useTitleEditor 配置

```typescript
const titleConfig = computed(() => ({
  getName: () => buildPlanStore.activePlanName,
  setName: (name: string) => { buildPlanStore.activePlanName = name },
  getDefaultName: () => t('build_plan.title')  // "建造规划"
}))
```

- `setName` 内部触发自动保存

### 方案作用域

- 全局：所有 station 共享同一套保存的方案列表

## 边界

### In Scope

- `SavedBuildPlanGoalsState` 数据模型与 localStorage 持久化
- `useBuildPlanStore` 新增 `savedPlans`、save/load/CRUD 方法
- `getStorageKey` 新增 `'build_plan_goals'` 支持
- `CURRENT_BUILD_PLAN_GOALS_VERSION` 版本常量
- Panel-header 标题改为 `useTitleEditor` 可编辑
- Panel-header 右侧方案菜单（新建/切换/删除/高亮）
- Panel-content 内 logic-flow 菜单 + 建材产线 checkbox 移到计算按钮上方同一行
- logicFlowPlanId 联动逻辑（切换逻辑产线时更新、加载方案时还原）
- 首次添加目标自动创建方案
- i18n key

### Out of Scope

- 持久化 `buildFlowMode`
- 持久化计算结果（previewResult / computeResult / schemeGroups）
- 存量数据迁移
- 修改 build-flow 数据模型或推导逻辑
- 编写测试代码
- E2E 测试

## 验收标准（DoD）

1. `useBuildPlanStore.savedPlans` 正确持久化到 localStorage（key 区分游戏版本）
2. 首次添加目标时自动创建默认方案并激活
3. `buildGoals` 变更（增/删/改）后自动保存当前方案
4. 方案名编辑确认后自动保存
5. 切换逻辑产线方案时 `logicFlowPlanId` 自动更新并保存
6. 加载建造目标方案时正确还原 `buildGoals`，并尝试还原关联的逻辑产线方案（id 不存在时 fallback）
7. Panel-header 左侧标题可通过 `useTitleEditor` 编辑方案名
8. Panel-header 右侧方案菜单：新建、切换、删除（x 按钮）、高亮当前项
9. 删除当前激活方案后自动切换到下一个，无则 `activeId = null`
10. Panel-content 内：建材产线 checkbox 靠左 + logic-flow 菜单靠右，位于计算按钮上方同一行
11. `buildFlowMode` 在切换方案时保持不变
12. `npm run build` 通过

## 未决项

无
