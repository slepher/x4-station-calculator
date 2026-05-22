# Building Material Progress Specification

## Purpose

定义 `StationDashboard` 中建筑物资进度条面板的行为：系统 SHALL 在有 building scope 模块时，在所有 view 中以堆叠进度条方式展示每个建材的存量、在途与需求量，并且 live 与 planning 模式各自使用对应口径数据。

## ADDED Requirements

### Requirement: Building Progress Panel Renders When Building Scope Modules Exist

系统 SHALL 在 `buildingScopeModules` 非空时渲染建筑物资进度条面板。

#### Scenario: Progress panel appears when building scope modules exist

- **前提** 当前 workbench 为 station
- **并且** 当前 station 存在 building scope 模块
- **当** `StationDashboard` 接收 `buildingScopeModules` prop
- **那么** 建筑物资进度条面板在所有 view 中可见

#### Scenario: Progress panel hidden when no building scope modules

- **前提** 当前 workbench 为 station
- **并且** `buildingScopeModules` 为空数组
- **当** `StationDashboard` 渲染
- **那么** 建筑物资进度条面板不渲染

### Requirement: Progress Panel Always Visible Across All Views

建筑物资进度条面板 SHALL 在 StationDashboard 的所有 view（materials/time/volume/workers）中固定显示，且 MUST NOT 随 `viewMode` 切换而隐藏。

#### Scenario: Panel visible in materials view

- **前提** 当前存在 building scope 模块
- **当** 用户切换到 `materials` view
- **那么** 建筑物资进度条面板仍然显示

#### Scenario: Panel visible in workers view

- **前提** 当前存在 building scope 模块
- **当** 用户切换到 `workers` view
- **那么** 建筑物资进度条面板仍然显示

### Requirement: Each Ware Displays A Single Stacked Progress Bar

每个建材商品 SHALL 以单条堆叠进度条展示，包含存量段（emerald 绿）和在途段（amber 琥珀），缺口以底色呈现。ware 名称 SHALL 与进度条在同一行显示。

#### Scenario: Stacked bars show cargo then transit

- **前提** ware `A` 的 `cargo=300`, `reservation=200`, `required=1000`
- **当** 面板渲染该 ware
- **那么** 存量段从 0 开始占条宽的 30%
- **并且** 在途段紧接在存量段之后占条宽的 20%
- **并且** 剩余 50% 为底色（缺口）
- **并且** ware 名称与进度条在同一行

### Requirement: Progress Bar Uses Required As Scale Max

总条宽 SHALL 以需求量 `required` 为 100% 尺度。当 `required == 0` 时 SHALL 以 `cargo + reservation` 为尺度。

#### Scenario: Required is used as scale

- **前提** ware 的 `required=1000`, `cargo=300`, `reservation=200`
- **当** 计算进度条宽度
- **那么** 存量段宽度 = 30%，在途段宽度 = 20%

#### Scenario: Scale falls back to cargo plus reservation when required is zero

- **前提** ware 的 `required=0`, `cargo=50`, `reservation=0`
- **当** 计算进度条宽度
- **那么** scale 为 50，存量段宽度为 100%

### Requirement: Progress Text Shows Cargo Plus Transit Separated By Plus Sign

数字 SHALL 显示在进度条内部居中。当存在在途时，格式为 `cargo+reservation / required`。当不存在在途时，格式仅为 `cargo`。

#### Scenario: Text shows cargo plus transit over required when transit exists

- **前提** ware 的 `cargo=300`, `reservation=200`, `required=1000`
- **当** 面板渲染该 ware
- **那么** 进度条内显示 `300+200 / 1000`

#### Scenario: Text shows only cargo when no transit

- **前提** ware 的 `cargo=300`, `reservation=0`, `required=1000`
- **当** 面板渲染该 ware
- **那么** 进度条内显示 `300`

### Requirement: Live And Planning Modes Use Respective Data

live 模式与 planning 模式 SHALL 各自使用对应口径的 `buildingScopeModules` 数据来计算需求量，而 `buildingCargo` 与 `buildingReservation` 均来自 archive 数据。

#### Scenario: Live mode uses archive building modules

- **前提** 当前 `visualMode = live`
- **并且** archive 中存在 `building.modules`
- **当** 计算建筑物资进度数据
- **那么** `required` 来自 `building.modules - buildingInProgress` 的建材分析结果

#### Scenario: Planning mode uses effective target minus built

- **前提** 当前 `visualMode = planning`
- **并且** 当前 station 存在 archiveStation
- **当** 计算建筑物资进度数据
- **那么** `required` 来自 `effectiveTargetModules - archiveBuiltModules - buildingInProgress` 的建材分析结果

### Requirement: Panel Does Not Affect Overview Or Transit Workbench

本次 change SHALL NOT 改变 `overview` 或 `transit` workbench 的 StationDashboard 行为。

#### Scenario: Overview workbench unchanged

- **前提** 当前 workbench 为 `overview`
- **当** 查看右侧 dashboard
- **那么** 不显示建筑物资进度条面板

#### Scenario: Transit workbench unchanged

- **前提** 当前 workbench 为 `transit`
- **当** 查看右侧 dashboard
- **那么** 不显示建筑物资进度条面板
