# Building Material Progress

## 目标

在 `StationDashboard` 中新增建筑物资进度条面板，以类似 `stats-bar` 的卡片风格展示每个建材商品的堆叠进度条（存量段 + 在途段，上限为需求量），该面板在所有 view（materials/time/volume/workers）中固定显示，内容始终基于 building scope 的材料数据，仅对有 archiveStation 的 live station 生效。

## 已确认方案（审核重点）

### 1. 显示条件

1. 仅当 `useProductionDashboardPresenter` 提供的 `buildingScopeModules` 非空时启用。
2. `buildingScopeModules` 非空意味着当前 station 存在 archive 且有待建设模块（live 模式）或 planning 有待建设模块（planning + archive 模式）。
3. 面板在所有 view（materials/time/volume/workers）中固定显示，不随 `moduleScope` 或 `viewMode` 切换。

### 2. 数据来源

4. **需求量（required）**：基于 `buildingScopeModules` 调用 `analyzeStation()` 得到的 `summaryItems`，每条为某个 ware 的总需求数量。
5. **存量（cargo）**：来自 `buildingCargo`（即 `archiveStation.building.cargo`）。
6. **在途（reservation）**：来自 `buildingReservation`（即 `archiveStation.building.reservation`）。
7. `buildingScopeModules` 在 presenter 层已区分 live 与 planning 口径：
   - live：`archive.building.modules - buildingInProgress`
   - planning + archive：`effectiveTargetModules - archiveBuiltModules - buildingInProgress`
8. 展示的 ware 集合 = `buildingAnalysis.summaryItems` 中的 ware ∪ `buildingCargo` 中的 ware ∪ `buildingReservation` 中的 ware。
9. 过滤条件：该 ware 至少有 `required > 0` 或 `cargo > 0` 或 `reservation > 0`。

### 3. 进度条视觉

10. 每 ware 一条进度条，与 `StationAllocationRow` / `StationCargoOnlyRow` 相同的 `bar-shell` / `bar-text` 风格。
11. ware 名称与进度条在同一行显示。
12. 堆叠分段：存量段（emerald 绿）从 0 开始，在途段（amber 琥珀）紧接在存量段之后。
13. 总条宽 = 需求量（当 required == 0 时以 cargo + reservation 为 scale）。
14. 存量段宽度 = `cargo / scale * 100%`，在途段宽度 = `reservation / scale * 100%`，均不超过 scale 上限。
15. 缺口（gap）以 bar-shell 底色（深灰）自然呈现。
16. 数字显示在进度条内部（`bar-text` 居中），格式：
    - 有在途：`cargo+reservation / required`
    - 无在途：`cargo`

### 4. 面板样式

17. 面板容器参考 `stats-bar` 风格：`bg-slate-800/60 p-2 mx-2 mt-2 rounded border border-slate-700/50`。
18. 每条进度行使用 `flex items-center` 布局，ware 名称固定宽度约 7em，进度条 flex-1。

### 5. 影响范围

19. 不影响现有 `materials`/`volume` view 中的 `StationModuleDetail` 建筑仓库/在途/缺口条目（暂时保留不动）。
20. 不影响 `overview` / `transit` workbench。
21. 不影响 `BlueprintProductionWorkbenchView`。

### 6. 架构合规

22. `StationDashboard` 通过新增 `buildingScopeModules` prop 接收数据，不在组件内部自行查找 store。
23. presenter 层已计算 `buildingScopeModules`，`LiveProductionWorkbenchView` 仅需将该值透传给 `StationDashboard`。
24. 不新增 store 与 presenter 或 presenter 与 vue 之间的中间层。

## 边界

### In Scope

- `StationDashboard` 新增 `buildingScopeModules` prop 与 `buildingProgressItems` 计算逻辑
- 进度条面板模板与样式
- `LiveProductionWorkbenchView` station 模式下透传 `buildingScopeModules`
- 面板在所有 view 中固定显示
- live 与 planning 模式各自展示对应口径数据

### Out of Scope

- 修改现有 `StationModuleDetail` 建筑仓库/在途/缺口条目
- `overview` / `transit` workbench 改造
- `BlueprintProductionWorkbenchView` 改造
- 测试编写与执行

## 验收标准（DoD）

1. 存在 buildingScopeModules 时，StationDashboard 在所有 view 中显示建筑物资进度条面板。
2. 进度条面板以卡片风格展示，每行一个 ware，包含 ware 名称 + 一条堆叠进度条 + 数字。
3. 存量段为 emerald 绿，在途段为 amber 琥珀，缺口为深灰底色。
4. 有在途时数字格式为 `cargo+reservation / required`，无在途时仅为 `cargo`。
5. 数字显示在进度条内部居中。
6. live 模式和 planning 模式各自使用对应的 buildingScopeModules 数据。
7. 不存在 buildingScopeModules 时面板不渲染。
8. `overview` / `transit` workbench 不受影响。
9. `npm run build` 无编译错误。

## 未决项

无
