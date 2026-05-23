# terraforming-shell Request

## 目标

在 `live-production` 的总览 (overview) tab 之后新增「地球化」tab，以独立的面板展示地球化相关功能——选取任务星区、浏览地球化项目任务列表、查看资源消耗。不改变现有 overview/transit/station 的 tab 行为。

## 已确认方案（审核重点）

### 入口与 Tab

- 地球化 tab **始终可见**，不需要 HQ station 存在作为前置条件。
- tab 位置：总览 → **地球化** → transit → station。
- tab 底色、交互、hover/active 状态与现有 tab 风格一致。
- tab 类型：`ProductionTabItem.type` 新增 `'terraforming'`。
- `workbenchMode` 新增 `'terraforming'`。
- tab 图标复用总览图标 (`playerhqIconUrl`)。
- 点击地球化 tab → `workbenchMode = 'terraforming'`，`activeStationId = null`。

### ContextToolbar（只读简化版地球化 Toolbar）

- 地球化 tab 激活时，toolbar 显示**只读简化版**。
- 内容从 **HQ station** (`tag === 'playerhq'`) 提取，只读显示：
  - Station 名称
  - Station code
  - 所属星区 (sector name + XYZ position popover)
  - 星区资源列表
  - 光照 / 泊位吞吐量 (sunlight / berth throughput)
- 不包括：mode toggle、race preference、workforce calc、show empire gaps、module scope cycler、import、编辑功能。

### 主内容区布局

- 3 列 grid，比例 3 : 5 : 4（与 station mode 完全一致，复用 `.main-layout`，不抖动）。
- **左列 (col-span-3)**：选取地球化任务星区/星球
- **中列 (col-span-5)**：地球化任务列表（依赖树、可用/阻塞项目）
- **右列 (col-span-4)**：地球化资源消耗汇总

### 数据层

- 独立 presenter：`src/components/empire/presenters/useTerraformingPresenter.ts`
  - 严格遵循 `store -> presenter -> vue` 三层。
  - presenter 负责面向 UI 组装数据。
  - vue 组件不直接访问 store。
- store 层 (`useLiveProductionStore`) 新增地球化相关状态：`selectedClusterId`, `terraformingState` (currentStats, completedProjects)。
- 已有 `src/store/logic/terraformingTaskResolver.ts` 作为核心推理引擎，直接复用：
  - `loadTerraformingData(version)`, `resolveAvailableTasks()`, `printTaskTree()`
- 地球化数据来源：`terraforming.json`（已由 `terraforming-data` change 生成），通过 `import.meta.glob` 按游戏版本加载。
- 版本获取：复用 gameDataStore 的 `folderName`（如 `9.0-Empire-beta`）。

## 边界

### In Scope

- Tab 栏新增「地球化」tab
- ContextToolbar 新增只读简化版 HQ station 工具栏
- 解析地球化 JSON 数据并加载到 store 的地球化状态
- 地球化任务星区选择面板
- 地球化任务列表面板
- 地球化资源消耗面板
- 新增 `useTerraformingPresenter`
- 地球化 tab 切换逻辑（不影响现有 overview/transit/station tab）
- `npm run build` 无编译错误

### Out of Scope

- 地球化项目的执行/完成/状态持久化（本 change 仅展示，不可操作）
- 地球化完成后的 effects 应用与 stats 动态刷新（后续 change）
- HQ station 进入地球化星区后的自动识别（后续 change）
- 测试编写
- 修改已有 `station`/`transit`/`overview` 核心逻辑

## 验收标准 (DoD)

1. 地球化 tab 出现在 tab 栏中，位于「总览」之后
2. 点击地球化 tab 后，toolbar 显示 HQ station 的只读信息
3. 主内容区显示为 3 列布局 (3:5:4)
4. 左列显示可用的地球化星区/星球列表
5. 中列显示选中星区的地球化任务列表（依赖树）
6. 右列显示地球化资源消耗数据
7. 从 overview/station/transit 切换到地球化 tab 再切回，状态不丢失
8. `npm run build` 无编译错误

## 未决项

- 地球化任务星区选择面板的具体 UI（下拉/列表/卡片）
- 地球化任务列表的渲染方式（分组折叠/树/表）
- 地球化资源消耗的具体汇总方式（按 ware 聚合/按任务分组/按 delivery）
- 地球化状态的持久化与 HQ station 绑定逻辑
- 与其他 tab（station/transit）的切换动画/过渡
