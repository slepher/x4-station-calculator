# X4 资源运行时逻辑结论

本文只保留“当前可以直接拿来推理/估算”的逻辑结论，不展开大段反编译细节。  
旧文档 [x4_resource_runtime_reverse_chain.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_runtime_reverse_chain.md) 保留不动，作为回测对照。

## 1. 证据强度约定

- `已确认`
  - 结论已经有直接代码证据支撑。
- `高可信`
  - 结论由多段代码与数据结构共同支持，但仍有一跳没有重新回钉。
- `阶段性模型`
  - 结论可用于当前分析或估算，但不是已经完全闭环的最终定理。

## 2. 当前最重要的总结构

### 2.1 `solid` 资源按 `field` 独立参与，再在更高层求和

结论：`已确认`

- `solid` 资源不是“先求一个 region 总密度，再按 field 拆账”。
- 正确方向是：

```text
每个 matching field
-> 接收 ware/yield payload
-> 计算自己的 field_weight
-> 接收 per_field_value 写回
-> 后续在 area/object 层继续用 field 自身参数求值
```

- 代码引用：
  - 旧链路文档中 `FUN_14073e110` 的 solid 分配段
  - 旧链路文档中 “Region 级 solid 分配主入口” 与 “solid 分配公式” 两节

### 2.2 `AsteroidField` 的 area 贡献是按单个 `64k area` 求值

结论：`已确认`

- `AsteroidField` 并没有绕开 `64k area`。
- 它在 `64k area` 粒度上，结合 noise、boundary/falloff、field 本地乘子来算单 area 贡献。

- 代码引用：
  - 旧链路文档中 `FUN_140e84c30` 小节
  - 旧链路文档中 “当前阶段可确认的 asteroid 贡献模型”
  - 旧链路文档中 “`FUN_140e84c30` 可以确认是 AsteroidField 的 area contribution 计算”

### 2.3 `region` 与 `field` 的 noise 关系是“默认值继承/本地覆盖”

结论：`已确认`

- 运行时每个 `AsteroidField` 只有一套最终已解析的 noise 参数。
- `region` 只提供默认值。
- `field` 如果写了自己的 `seed/noisescale/minnoisevalue/maxnoisevalue`，就覆盖 `region` 默认值。
- area contribution 读取的是 `field` 当前对象上的 resolved noise，不是 `region noise` 和 `field noise` 两套并行相乘。

- 代码引用：
  - 旧链路文档中 “关于 region noise 与 asteroid noise：代码确认是继承/覆盖”
  - 旧链路文档中 `FUN_1400b7620` 小节

## 3. 当前可直接使用的 per-field 结论

### 3.1 `MultiplierA`

结论：`高可信`

```text
MultiplierA
= (densityfactor * region.density * 0.01)
 * universeobjectdensities(class_id)
```

说明：

- `densityfactor` 是 field 自身属性。
- `region.density` 是上层传入的 base density。
- `class_id` 不是 ware，而是从 field 的 `ref` 对象解析出来的类别键。
- `universeobjectdensities` 是 gamestart Universe 级覆盖项；无用户自定义时，可按单位倍率看待。

- 代码引用：
  - `+0x1150` 初始化式：
    旧链路文档中 `FUN_140e842e0` 字段映射表
  - `MultiplierA = field_1150 * class_multiplier`：
    旧链路文档中 `FUN_140e80300` 小节

### 3.2 `MultiplierB`

结论：`已确认`

```text
MultiplierB
= universeyielddensities(ware)
 * regionyields[ware][yield_tag].resourcedensity
 * universeobjectyielddensities(ware)
```

说明：

- `ware` 与 `yield_tag` 共同决定 `regionyields` 字典项。
- 无自定义 gamestart 覆盖时，可收束成：

```text
MultiplierB
= regionyields[ware][yield_tag].resourcedensity
```

- 代码引用：
  - 旧链路文档中 `FUN_140e803e0` 小节
  - 旧链路文档中 “`MultiplierB` 现在可以收束成最终结论”

### 3.3 field 权重函数

结论：`已确认`

当 `FUN_14073e110` 在 region 分配阶段调用 `field->vfunc(+0xa0, 1)` 时：

```text
field_weight
= MultiplierA
 * MultiplierB
 * (F(maxnoisevalue) - F(minnoisevalue))
```

这里不带 `resourcepercentage`。

说明：

- 旧链路文档里有一处更早的表述把 `resourcepercentage` 写进了这条权重式。
- 该表述已被后面的重新反编译结论修正。

- 代码引用：
  - 旧表述：
    旧链路文档中 `FUN_140e85b80` 旧版描述段
  - 修正结论：
    旧链路文档中 “`FUN_140e85b80` 的一个关键点之前被写错了”

### 3.4 单个 `AsteroidField` 的单 area 贡献

结论：`已确认`

对单个 `AsteroidField`、单个 `64k area`，当前可用的逻辑式是：

```text
AsteroidContribution(area)
≈ NoiseIntegral(area)
 * FalloffWeight(area)
 * resourcepercentage
 * MultiplierA
 * MultiplierB
 * ClampFactor
```

说明：

- 这里的 `NoiseIntegral(area)` 使用的是 field resolved noise。
- `resourcepercentage` 参与 area contribution，但不参与 region 分配阶段的 `field_weight` 归一化。

- 代码引用：
  - 旧链路文档中 “当前阶段可确认的 asteroid 贡献模型”
  - 旧链路文档中 “`FUN_140e84c30` 可以确认是 AsteroidField 的 area contribution 计算”

## 4. 数据来源结论

### 4.1 `regionyields`

结论：`已确认`

- 逻辑键名：`regionyields`
- 可见静态文件：
  - [regionyields/final.xml](/home/slepher/project/x4-station-calculator/x4raw_assets/8.0-Diplomacy/libraries/regionyields/final.xml)
- 字典结构：

```xml
<regionyields>
  <resource ware="ice">
    <yield name="medium" resourcedensity="15" replenishtime="..." gatherspeedfactor="..."/>
  </resource>
</regionyields>
```

- 逻辑理解：

```text
regionyields[ware][yield_name] -> payload
```

- 代码引用：
  - 旧链路文档中 “`FUN_14073e110` 的 region 分配链可以确认”

### 4.2 Universe / gamestart 覆盖项

结论：`已确认`

- `universeobjectdensities`
  - 作用于 `class_id`
  - 进入 `MultiplierA`
- `universeyielddensities`
  - 作用于 `ware`
  - 进入 `MultiplierB`
- `universeobjectyielddensities`
  - 作用于 `ware`
  - 进入 `MultiplierB`

说明：

- 如果用户没有在 `gamestarts.xml` 中做自定义覆盖，当前可按单位乘子 `1` 处理。

## 5. 现在不能写成定论的部分

### 5.1 “solid 资源总量链已完全闭合”

结论：`不保留`

- 当前可以建立强约束的 per-field / per-area 逻辑。
- 但“从 region XML 一路无缺口推到游戏中最终精确总量”的完全闭环结论，旧链路文档已经明确不再保留。

- 代码引用：
  - 旧链路文档中 “下列说法本次不保留”

### 5.2 任何把 whole-region 先均匀化再按份额拆给 field 的公式

结论：`不成立`

- 这类公式违背了：
  - field resolved noise
  - field 独立权重
  - area contribution 逐 field 求值
  - 最后再汇总

因此，对类似 `p1_40km_ice_field` 的估算，必须从 per-field 出发，不能从单一 region 平均密度出发。
