# user-save-binding-station Toolbar

## 背景

当前 `StationToolbar` 的 `新建 / 保存 / 另存为 / 载入` 已统一走 `useToolbarWorkflowController`，但 `blueprint-production` 与 `live-production` 仍被折叠为同一个 `station` storeType。

这与现状主路径不一致：

- `BlueprintProductionWorkbenchView` 使用 `useBlueprintProductionStore`
- `LiveProductionWorkbenchView` 使用 `useLiveProductionStore`

因此 toolbar 的动作边界与当前工作台的数据边界不一致，尤其会造成以下问题：

- toolbar 行为继续依赖旧的统一 facade 语义，而不是当前 active view 对应的入口 store
- `LoadPlanModal` 同时暴露 empire/binding 两类加载对象，和当前视图上下文不匹配
- `Live` 视图下仍保留 `新建 / 另存为`，但 binding 并不适合通过 toolbar 创建空对象或复制对象

## 目标

将 `StationToolbar` 的主动作改为严格按 `activeView` 路由，并把 `Load` UI 拆成与视图一一对应的单责弹窗。

目标行为：

- `blueprint-production`
  - `新建` -> blueprint store
  - `保存` -> blueprint store
  - `另存为` -> blueprint store
  - `载入` -> 仅显示 blueprint plan
- `live-production`
  - `保存` -> live store
  - `载入` -> 仅显示 live binding
  - `新建` 禁用
  - `另存为` 禁用
- `flow`
  - 保持现有 logic-flow 行为
- `ship-build`
  - 保持现有 ship-build 行为

## 设计

### 1. ToolbarStoreType 按 active view 显式拆分

`useToolbarWorkflowController` 不再使用泛化的 `station` 类型，而是改为：

```ts
type ToolbarStoreType =
  | 'blueprint-production'
  | 'live-production'
  | 'logicFlow'
  | 'ship-build'
```

`StationToolbar` 中的 `activeToolbarStoreType` 映射规则：

- `ship-build` -> `ship-build`
- `flow` -> `logicFlow`
- `live-production` -> `live-production`
- 其余 production 视图 -> `blueprint-production`

这样 toolbar 的动作分发边界与当前 workbench 的入口 store 保持一致。

### 2. New / Save / Save As 路由规则

#### blueprint-production

- `isDirtyFor` -> `useBlueprintProductionStore.isDirty`
- `isEmptyForSave` -> `useBlueprintProductionStore.isEmptyForSave()`
- `requiresSaveAsOnSaveFor` -> `useBlueprintProductionStore.requiresSaveAsOnSave()`
- `SAVE` -> `useBlueprintProductionStore.saveEmpire()`
- `SAVE_AS` -> `useBlueprintProductionStore.saveEmpireAs(name)`
- `NEW` -> 重置当前 blueprint draft（可先复用 `createEmpire('')`，或再封装明确方法）

#### live-production

- `isDirtyFor` -> `useLiveProductionStore.isDirty`
- `isEmptyForSave` -> `useLiveProductionStore.isEmptyForSave()`
- `requiresSaveAsOnSaveFor` -> `false`
- `SAVE` -> `useLiveProductionStore.saveBinding()`
- `SAVE_AS` -> 不支持
- `NEW` -> 不支持

这里的关键原则是：`Live` 视图的 toolbar 只承担“保存当前 binding draft / 切换已存在 binding”，不承担“创建新 binding / 复制 binding”。

### 3. Live 页面禁用规则

`live-production` 下：

- `toolbar-new-btn` disabled
- `toolbar-save-as-btn` disabled

禁用需要同时落在两层：

1. `StationToolbar` UI 层，根据 `activeToolbarStoreType === 'live-production'` 直接禁用按钮
2. `useToolbarWorkflowController` 行为层，再次拒绝 `NEW / SAVE_AS`

这样即使后续有其他入口复用 controller，也不会误放开不支持的动作。

### 4. Load 弹窗拆分

当前 `LoadPlanModal` 同时显示：

- empire plans
- binding plans

这与当前 `blueprint-production` / `live-production` 两个独立入口不一致。改为拆分成两个单责弹窗：

#### `LoadBlueprintPlanModal`

仅服务 `blueprint-production`：

- 数据源：`savedEmpires.list`
- 点击加载：`blueprintStore.loadEmpire(empireId)`
- 不显示 empire/binding tab

#### `LoadLivePlanModal`

仅服务 `live-production`：

- 数据源：`savedBindings.list`
- 点击加载：`liveStore.openBinding(gameGuid)`，并保持 `activeView` 在 `live-production`
- 不显示 empire/binding tab

`StationToolbar.handleLoad()` 改为：

- `ship-build` -> `LoadShipBlueprintModal`
- `flow` -> `LoadFlowPlanModal`
- `live-production` -> `LoadLivePlanModal`
- `blueprint-production` -> `LoadBlueprintPlanModal`

### 5. SmartSaveDialog 适配

`SmartSaveDialog` 当前仍使用旧的 `station` 语义读取 production 名称。改造后应只接收并理解：

- `blueprint-production`
- `logicFlow`
- `ship-build`

`live-production` 不会进入 SmartSaveDialog，因为：

- `SAVE` 不需要另存流程
- `NEW / SAVE_AS` 已禁用

因此 dialog 内部对于 production 的默认名、当前方案名、是否是新方案等判断，应切换到 `useBlueprintProductionStore`，不要继续依赖旧的统一 production facade。

### 6. Import 相关的确认流程

`ImportPlanModal` 当前使用 `toolbarWorkflow.shouldConfirmBeforeImport('station')` 和 `runImportAction({ storeType: 'station' })`。

改造后应按入口分流：

- blueprint workbench -> `blueprint-production`
- live workbench -> `live-production`

语义保持不变：

- 当前入口 dirty 时，导入前先给出“保存并导入 / 丢弃并导入”
- 但保存动作必须落到当前入口对应的 store

## 预期收益

- toolbar 动作与 active view 对应的数据源完全一致
- blueprint/live 不再共享含糊的 `station` 语义
- `Load` 行为与当前页面上下文对齐，避免跨语义选择
- `Live` 视图的按钮能力边界更清晰，减少误操作
- 后续可以继续收缩旧的统一 facade，而不是继续给它堆分支

## 非目标

本次调整不改变以下行为：

- `logic-flow` 的保存/加载语义
- `ship-build` 的保存/加载语义
- 顶部 view switch 的结构
- binding 的创建来源；binding 仍应来自 save / draft 打开流程，而不是 toolbar 直接创建
