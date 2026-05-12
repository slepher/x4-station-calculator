# Ship Build Time 设计文档

## 架构影响

本次变更涉及四层：

1. `scripts/x4_data_processor.py`
   - 为 ship/equipment/drone/consumable/missile 导出建造时间字段
   - 时间字段来源统一为 ware production 配方的 `time`

2. `logic`
   - 新增统一的蓝图建造分析模块
   - 输出同一份 `ShipBlueprintBuildAnalysis`

3. `store`
   - `useShipBuildStore` 接入统一分析结果并暴露给页面
   - 后续 `build-plan` 相关 store 直接复用相同 logic

4. `presenter` / `vue`
   - presenter 负责 tab 展示映射
   - `ShipBuildPanelMaterials` 负责 tab 切换与渲染

## 设计决策

### 1. 时间字段从 ware production 配方提取

**决策**：
ship/equipment/drone/consumable/missile 的建造时间统一来自 `wares` production 配方。

**理由**：
- 原始 XML 中，真实建造时间位于 ware 的 `<production time="...">`
- `equipment_macros.xml` 与 `ship_macros.xml` 中的时间字段是性能或行为时间，不是建造时间
- 当前脚本已经把 production 配方读入 `self.recipes`，只差把 `time` 暴露出去

**影响**：
- 数据导出层要新增时间字段
- 分析逻辑不需要做运行时猜测或推导

### 2. 抽象独立的蓝图建造分析 logic

**决策**：
新增可复用的 `ShipBlueprintBuildAnalysis` logic，而不是把时间视图继续写在 `ShipBuildPanelMaterials.vue` 中。

**理由**：
- 该分析不属于单一页面，而是飞船蓝图领域能力
- `build-plan` 之后也需要消费相同结果
- 避免在 store 或多个组件里重复维护材料/时间算法

**输入建议**：
- `ShipBlueprint`
- 当前 method
- 价格倍率
- `shipMap / equipmentMap / waresMap / consumablesMap / dronesMap / missilesMap`

**输出建议**：
- `methodOptions`
- `selectedMethod`
- `priceMultiplier`
- `summary`
- `shipGroup`
- `equipmentGroups`
- `storageGroups`

### 3. 每个 group 同时携带 cost 与 time

**决策**：
group 数据一次性返回材料、金额、时间，不按 tab 分拆不同数据树。

**理由**：
- `materials` 与 `time` 只是同一领域结果的不同观察方式
- 避免 time tab 再次遍历和重算
- 未来扩展到 `build-plan` 汇总时更容易继续复用

**建议字段**：
- `id`
- `name`
- `quantity`
- `items`
- `totalValue`
- `unitBuildTime`
- `totalBuildTime`

### 4. storage 条目参与时间分析

**决策**：
storage 组纳入时间视图，但条目时间固定为 `0`。

**理由**：
- 尽管 storage 容量不是可计时项，storage 面板中的实际条目仍需作为统一分析的独立条目存在
- 当前需求明确要求这些 storage 条目的时间值固定为 `0`
- 如果排除 storage，用户看到的条目结构会和材料视图不一致

**边界说明**：
- deployable / countermeasure / drone / missile 条目仍参与统一分析
- 不是 `shipBlueprint.storage` 容量字段本身
- 时间展示固定为 `0`

### 5. method 与 fallback 一致性

**决策**：
时间与材料共用完全一致的 method 选择与 fallback 规则。

**理由**：
- 生产配方中的 inputs 与 time 是同一条记录
- 如果材料用 `default`、时间却用当前 method，会产生不可解释的混合结果

**规则**：
- 当前 method 存在：材料与时间都使用当前 method
- 当前 method 缺失：材料与时间都回退到 `default`

### 6. Presenter 只做展示映射

**决策**：
Presenter 只负责把统一 analysis 映射为 `materials` / `time` tab 所需的展示结构。

**理由**：
- 仓库要求 `store -> presenter -> vue`
- 领域分析应留在 logic/store
- UI 标题、unit、displayValue 映射属于 presenter

## 数据流

### 数据导出流

```text
x4raw_assets/libraries/wares/final.xml
  -> scripts/x4_data_processor.py build_database()
  -> self.recipes[wareId][method] = { time, amount, inputs }
  -> ship/equipment/drone/consumable/missile 导出时补入 build time
  -> 前端 JSON
```

### 页面读取流

```text
ShipBlueprint + game data
  -> ship blueprint build analysis logic
  -> useShipBuildStore 暴露 analysis
  -> presenter 根据 tab 映射显示结构
  -> ShipBuildPanelMaterials 渲染
```

### 时间 tab 渲染流

```text
用户切换到 time tab
  -> 组件读取 presenter.timeView
  -> 渲染总时间
  -> 按当前材料面板的平铺聚合条目顺序渲染时间
  -> 每个条目展开后显示 build time
```

## 文件修改清单

### 数据导出层

- `scripts/x4_data_processor.py`
  - 为 ship/equipment/drone/consumable/missile 导出 build time 相关字段

### 类型层

- `src/types/x4.ts`
  - 为相关 ship-build 实体补充 build time 字段
  - 新增统一分析结果类型

### 逻辑层

- 新增 ship blueprint build analysis 逻辑模块
  - 位置待实现时确定
  - 负责 ship/equipment/storage 统一分析

### Store 层

- `src/store/useShipBuildStore.ts`
  - 接入统一 analysis
  - 暴露当前 blueprint 分析结果

### Presenter / 组件层

- ship-build presenter
  - 新增材料/时间 tab 映射

- `src/components/ship-build/ShipBuildPanelMaterials.vue`
  - 删除组件内重复分析
  - 增加 time tab
  - 读取 presenter 输出渲染

## 显示规划

### 1. 复用当前平铺结构

`time` tab 不引入新的“船体区 / 装备区 / storage 区”分区结构，而是严格复用当前材料面板的平铺条目结构：

1. 总计行
2. 船体条目
3. 装备聚合条目
4. storage 聚合条目

### 2. 条目聚合键

- 船体：按 `shipId` 聚合
- 装备：按 `equipmentId` 聚合
- storage：
  - `deployable:<id>`
  - `countermeasure:<id>`
  - `drone:<id>`
  - `missile:<id>`

这样可以保持与当前材料面板一致的唯一键模型，避免在 `time` tab 中再构造另一套展示体系。

### 3. 条目内容

- 总计行：显示 `totalBuildTime`，不显示按材料汇总明细
- 平铺条目主行：右侧主值从 `Cr` 切换为该条目 `totalBuildTime`
- 平铺条目展开内容：只显示该条目的 `build time` 明细项，不再显示材料列表

## 风险与注意事项

1. **字段命名一致性**
   - 模块现有字段为 `buildTime`
   - ship-build 相关实体建议保持相同命名风格，避免混入 `duration`

2. **旧材料面板迁移**
   - 当前组件内已有大量 computed
   - 迁移时要防止材料 tab 行为回退
   - 时间 tab 必须复用现有平铺结构，不能重构成新的分区布局

3. **缺失配方的兜底**
   - 部分条目可能缺少当前 method
   - 必须统一回退 `default`
   - 若连 `default` 也缺失，则时间为 `0`，并保持条目可计算
   - storage 条目即使存在 build time 数据，当前需求下也仍显示为 `0`

4. **build-plan 复用约束**
   - 本次不实现 build-plan UI
   - 但逻辑接口设计必须允许 build-plan store 直接调用

5. **避免组件重算**
   - 新方案下 Vue 不应继续保留 ship/equipment/storage 的领域级 computed 分析

## 结论

本次变更的本质不是单纯新增一个 UI tab，而是把飞船蓝图的建造分析补齐为统一领域能力。时间视图只是该能力在 `ship-build` 材料面板中的第一个直接消费者，后续 `build-plan` 也必须建立在同一套分析之上。
