# Ship Build Time Specification

## Purpose

为飞船蓝图提供统一的建造材料/资金/时间分析能力，并在 `ship-build` 的建造材料面板中增加时间视图，使 `ship-build` 与后续 `build-plan` 可以复用同一套蓝图建造分析逻辑。

## ADDED Requirements

### Requirement: Ship Blueprint Build Time Data Source

飞船蓝图相关建造时间 MUST 从 `wares` 生产配方获取，而不是从 ship 或 equipment macro 的性能时间字段推导。

#### Scenario: Ship Build Time Uses Ware Production Time

**前提**：
- 存在一个 ship ware
- 该 ware 在原始 `wares` 数据中包含 `<production time="...">`

**当**：
- 系统构建 ship build 数据

**那么**：
- 飞船本体建造时间 MUST 使用对应 production 配方的 `time`
- 系统 MUST NOT 使用 `ship_macros.xml` 中的 travel、boost、oxygen 等时间字段替代建造时间

#### Scenario: Equipment Build Time Uses Ware Production Time

**前提**：
- 存在一个 equipment ware
- 该 ware 在原始 `wares` 数据中包含 `<production time="...">`

**当**：
- 系统构建 equipment 数据

**那么**：
- 装备建造时间 MUST 使用对应 production 配方的 `time`
- 系统 MUST NOT 使用 `equipment_macros.xml` 中的 `boost.duration`、`reload.time`、`travel.charge` 等性能字段替代建造时间

#### Scenario: Storage Item Build Time Uses Ware Production Time

**前提**：
- blueprint storage 中存在 deployable、countermeasure、drone 或 missile 条目
- 对应 ware 包含 production 配方

**当**：
- 系统计算 storage 分组建造时间

**那么**：
- 每个 storage 条目的建造时间 MUST 使用其 ware production time
- storage 容量配置本身 MUST NOT 被视为一个独立可计时建造项

### Requirement: Unified Ship Blueprint Build Analysis Logic

系统 MUST 提供独立于页面组件的统一蓝图建造分析逻辑。

#### Scenario: Logic Accepts Raw Blueprint And Game Data

**前提**：
- 调用方持有 `ShipBlueprint`
- 调用方持有 ship/equipment/ware/consumable/drone/missile 等基础数据字典

**当**：
- 调用统一 build analysis logic

**那么**：
- logic SHALL 能直接基于这些原始数据返回分析结果
- logic MUST NOT 依赖 `ShipBuildPanelMaterials.vue` 的局部状态
- logic MUST 可被多个 store 复用

#### Scenario: Analysis Returns Summary And Group Data

**前提**：
- 存在一个有效的 ship blueprint

**当**：
- 统一 build analysis 完成计算

**那么**：
- 返回结果 MUST 包含：
  - 汇总材料
  - 总资金
  - 总建造时间
  - `shipGroup`
  - `equipmentGroups`
  - `storageGroups`
- 每个 group MUST 同时包含材料、金额、时间相关字段

### Requirement: Method Consistency Between Cost And Time

时间与材料 MUST 使用同一个 method 解析规则。

#### Scenario: Selected Method Drives Both Cost And Time

**前提**：
- 用户已选择某个 `materialMethod`
- 某条目在该 method 下存在 production 配方

**当**：
- 系统计算该条目的材料与时间

**那么**：
- 材料成本 MUST 取自该 method 的 production inputs
- 建造时间 MUST 取自该 method 的 production time
- 两者 MUST 来自同一条配方

#### Scenario: Missing Method Falls Back To Default

**前提**：
- 当前条目不存在用户选中的 method
- 条目存在 `default` production 配方

**当**：
- 系统计算该条目的材料与时间

**那么**：
- 材料与时间 MUST 一起回退到 `default`
- 系统 MUST NOT 仅回退材料或仅回退时间

### Requirement: Reusable Store-Level Build Analysis

`useShipBuildStore` MUST 暴露当前蓝图的统一建造分析结果。

#### Scenario: Ship Build Store Exposes Current Blueprint Analysis

**前提**：
- store 中存在活动 blueprint

**当**：
- 页面或其他调用方读取 store build analysis

**那么**：
- 可获得当前 blueprint 的统一建造分析结果
- 调用方无需自行再次拼装 ship / equipment / storage 的材料或时间

#### Scenario: Other Stores Can Reuse Same Logic

**前提**：
- 其他 store（例如 `build-plan`）需要蓝图材料/时间分析

**当**：
- 该 store 调用统一 build analysis logic

**那么**：
- 该 store SHALL 复用同一逻辑模块
- 系统 MUST NOT 在其他 store 中复制一套独立算法

### Requirement: Ship Build Materials Panel Time View

建造材料面板 MUST 支持时间视图，并与材料视图共享同一份分析结果。

#### Scenario: Panel Provides Materials And Time Tabs

**前提**：
- 用户进入 ship-build 工作台
- 材料面板成功获取统一 build analysis

**当**：
- 面板渲染视图切换控件

**那么**：
- 面板 MUST 至少提供 `materials` 与 `time` 两个 tab
- tab 切换 MUST 仅切换展示结构，不重新定义领域数据来源

#### Scenario: Time Tab Shows Summary And Group Time

**前提**：
- 用户切换到 `time` tab

**当**：
- 面板渲染时间视图

**那么**：
- MUST 显示总建造时间
- MUST 复用当前材料面板的平铺条目顺序与折叠结构
- MUST 显示船体条目建造时间
- MUST 显示装备聚合条目建造时间
- MUST 显示 storage 聚合条目建造时间（若存在相关条目）

#### Scenario: Time Tab Does Not Introduce Sectioned Group Areas

**前提**：
- 当前材料面板采用总计后接多个平铺聚合条目的展示方式

**当**：
- 面板渲染 `time` tab

**那么**：
- 系统 MUST NOT 额外引入“船体区”、“装备区”或“storage 区”的分区标题结构
- 系统 MUST 继续以平铺条目方式展示时间明细

#### Scenario: Flat Entries Use Stable Aggregation Keys

**前提**：
- 面板需要渲染 `time` tab 条目

**当**：
- 系统聚合条目

**那么**：
- 船体条目 MUST 以 `shipId` 作为唯一键聚合
- 装备条目 MUST 以 `equipmentId` 作为唯一键聚合
- storage 条目 MUST 以 `type prefix + item id` 作为唯一键聚合

#### Scenario: Expanded Time Entry Shows Build Time Item Only

**前提**：
- 用户展开 `time` tab 中的某个平铺条目

**当**：
- 面板渲染展开内容

**那么**：
- 展开内容 MUST 显示该条目的 `build time` 明细项
- 展开内容 MUST NOT 继续显示材料列表

#### Scenario: Materials Tab Keeps Existing Material Behavior

**前提**：
- 用户停留在 `materials` tab

**当**：
- 面板渲染材料视图

**那么**：
- 现有材料汇总与分组明细行为 MUST 保持可用
- 引入时间视图 MUST NOT 破坏当前材料视图

### Requirement: Presenter And Vue Responsibility Split

Presenter 与 Vue 层 MUST 仅承担展示相关职责。

#### Scenario: Presenter Maps Domain Analysis To Tab View Model

**前提**：
- store 已提供统一 build analysis

**当**：
- presenter 生成材料或时间 tab 的展示数据

**那么**：
- presenter MAY 组装 title、unit、displayValue、明细行展示结构
- presenter MUST NOT 重新实现领域层的材料/时间计算

#### Scenario: Vue Only Switches Tabs And Renders

**前提**：
- 组件已拿到 presenter 输出

**当**：
- 用户切换 tab 或展开分组

**那么**：
- Vue 组件 SHALL 只负责交互与渲染
- Vue MUST NOT 在组件内部重新构建 ship / equipment / storage 的材料或时间分析
