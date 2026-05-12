# ship-build-time 变更请求

## 目标

为 `ship-build` 的“建造材料”面板增加时间视图，并将飞船蓝图的建造材料/资金/时间分析下沉为可复用的领域逻辑，供 `ship-build` 与后续 `build-plan` 共同使用。

本次变更同时补齐 ship/equipment/drone/consumable/missile 的建造时间数据链路：时间来源统一取自原始 `wares` XML 的 `<production time="...">`，与材料 method 使用同一条生产配方。

## 已确认方案（审核重点）

### 1. 建造时间数据来源

- 飞船、装备、无人机、消耗品、导弹的建造时间不从 `ship_macros.xml` 或 `equipment_macros.xml` 的性能字段获取。
- 统一从原始 `wares` 数据的 `<production time="...">` 获取。
- ship/equipment/drone/consumable/missile 的 `cost` 与 `time` 必须来自同一个 method 对应的 production 配方，禁止跨 method 混用。

### 2. storage 范围解释

- `shipBlueprint.storage` 作为容量配置本身没有独立建造时间。
- storage 面板中展示的条目，即 `deployables / countermeasure / drones / missiles`，在统一分析中仍然作为独立条目保留，保证材料/金额结构完整。
- 但这些 storage 条目的 `build time` 现阶段按需求固定为 `0`。
- 因此时间视图必须覆盖这些 storage 条目，但展示值为 `0`，而不是将 storage 组整体排除在外。

### 3. 统一蓝图建造分析逻辑

- 现有 `ShipBuildPanelMaterials.vue` 中的材料分析不再继续停留在组件内部。
- 新增独立 `logic` 模块，输入 `ShipBlueprint`、game data 字典、method、价格倍率等参数，输出统一的 `ShipBlueprintBuildAnalysis`。
- 该分析结果至少包含：
  - 汇总材料
  - 总资金
  - 总建造时间
  - `shipGroup`
  - `equipmentGroups`
  - `storageGroups`
- 每个 group 同时提供材料、资金、时间字段，避免 UI 针对不同 tab 再次重算。

### 4. Store 与复用边界

- `useShipBuildStore` 负责暴露当前活动蓝图的建造分析结果。
- 未来 `build-plan` 相关 store 必须复用同一个 `logic` 模块，不允许再复制一套材料/时间算法。
- `store` 输出的是领域分析结果，不是页面专属展示结构。

### 5. 材料面板时间视图

- `ShipBuildPanelMaterials` 新增与 `StationDashboard` 类似的 tab 切换，但底层读取同一份蓝图建造分析。
- 面板至少包含两个 tab：
  - `materials`
  - `time`
- `materials` tab 展示现有材料/金额逻辑。
- `time` tab 展示：
  - 总建造时间
  - 复用当前材料面板的平铺条目结构
  - 船体条目时间
  - 装备聚合条目时间
  - storage 条目聚合时间
  - 各条目展开后的单项 `build time`

### 6. method 规则

- 时间分析沿用当前材料 method 选择，不新增独立时间 method。
- 若某条目不存在当前选中 method，则时间与材料都按相同 fallback 规则回退到 `default`。
- 禁止出现材料按一个 method、时间按另一个 method 的不一致结果。

### 7. Presenter / Vue 分工

- `logic` / `store` 提供统一领域分析。
- `presenter` 只负责将领域分析映射成 tab 所需展示模型，例如 title、unit、displayValue、行级展示结构。
- Vue 组件只负责 tab 切换、传入 presenter 结果并渲染。

### 8. 数据导出链路

- `scripts/x4_data_processor.py` 当前已读取 `production.time` 到内部 `recipes`，但 ship/equipment/drone/consumable/missile 的 JSON 导出尚未暴露该字段。
- 本次需要补齐导出链路，使前端可直接消费建造时间数据。
- 站模块现有 `buildTime` 实现方式可作为命名和结构参考，但 ship-build 相关类型应按自身实体结构扩展，不强行复用模块类型。

## 边界

### In Scope

- 为 ship/equipment/drone/consumable/missile 建立建造时间数据链路
- 新增可复用的蓝图建造分析 `logic` 模块
- `useShipBuildStore` 接入统一分析结果
- `ShipBuildPanelMaterials` 增加时间视图
- storage 条目保留在时间视图分析中，但其时间值固定为 `0`
- 为未来 `build-plan` 复用预留统一分析接口

### Out of Scope

- 新增 volume、workers 或其他额外视图
- 修改 ship-build 装备选择逻辑
- 新增测试代码或执行测试
- 调整非材料面板的 ship-build UI 结构
- 实现 `build-plan` 页面本身的时间展示

## 验收标准（DoD）

1. ship-build 相关实体的建造时间可从原始 `wares production.time` 正确导出到前端数据结构。
2. 飞船蓝图存在统一的 build analysis，能同时产出材料、金额、时间，不需要组件自行重算。
3. `useShipBuildStore` 可暴露当前蓝图的统一建造分析结果。
4. `ShipBuildPanelMaterials` 至少支持 `materials` 与 `time` 两个 tab，并基于同一份分析结果切换显示。
5. 时间 tab 中总时间与平铺聚合条目的时间值可正确展示，且结构与当前材料面板一致。
6. storage 条目（deployables / countermeasure / drones / missiles）在时间视图中保留，但当前需求下其 build time 固定为 `0`。
7. 材料与时间对同一条目使用相同 method 与相同 fallback 规则。
8. 统一分析 `logic` 可被其他 store 以蓝图原始数据调用，不依赖 `ShipBuildPanelMaterials.vue` 的内部状态。
9. 现有 `materials` tab 行为不因时间视图引入而退化。

## 未决项

无
