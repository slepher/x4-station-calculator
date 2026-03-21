# X4 固体资源逻辑结论

本文单独整理固体资源部分。  
它与 [x4_resource_logic_conclusions.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_logic_conclusions.md) 并列，但只保留 solid 相关结论。  
代码逆向锚点见 [x4_resource_code_details.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_code_details.md)。  
旧长链文档 [x4_resource_runtime_reverse_chain.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_runtime_reverse_chain.md) 保留不动，作为回测对照。

## 1. 证据强度约定

- `已确认`
  - 有直接代码证据支撑。
- `高可信`
  - 多段代码和数据结构共同支持，但仍有一跳没有重新回钉。
- `阶段性模型`
  - 可用于当前推理和估算，但还不能写成最终定理。

## 2. 当前最重要的 solid 总结构

### 2.1 solid 是按 matching field 独立参与，再在更高层汇总

结论：`已确认`

- solid 不是“先求一个 region 总密度，再按比例拆给 field”。
- 当前保留的正确方向是：

```text
region yield payload
-> 找 matching solid field
-> 对每个 field 灌 payload
-> 对每个 field 取 field_weight
-> 算 per_field_value
-> 把 per_field_value 写回每个 field
-> 后续按 field 自身参数继续做 area / object 级求值
```

- 代码锚点：
  - 旧链路文档中 `FUN_14073e110` 的 solid 分配段
  - 旧链路文档中 “Region 级 solid 分配主入口”
  - 旧链路文档中 “solid 分配公式”

### 2.2 solid 的 area 贡献也是按 `64k area` 求值

结论：`已确认`

- `AsteroidField` 没有绕开 `64k area`。
- 当前最稳的理解仍然是：solid 与 gas 共享 `64k area` / boundary / falloff / noise 这一层基础框架，只是 solid 多了 field 自身乘子和后续实体化链。

- 代码锚点：
  - 旧链路文档中 `FUN_140e84c30` 小节
  - 旧链路文档中 “当前阶段可确认的 asteroid 贡献模型”

### 2.3 每个 solid field 只使用自己 resolved 后的一套 noise 参数

结论：`已确认`

- `region` noise 只提供默认值。
- `field` 写了自己的 `seed/noisescale/minnoisevalue/maxnoisevalue` 时，就覆盖 `region` 默认值。
- 最终 area contribution 只读当前 `AsteroidField` 上的 resolved noise。

- 代码锚点：
  - 旧链路文档中 “关于 region noise 与 asteroid noise：代码确认是继承/覆盖”
  - 旧链路文档中 `FUN_1400b7620` 小节
  - 旧链路文档中 `FUN_140e84c30` 小节

## 3. 当前可直接使用的 per-field 结论

### 3.1 `MultiplierA`

结论：`高可信`

```text
MultiplierA
= (densityfactor * region.density * 0.01)
 * universeobjectdensities(class_id)
```

说明：

- `densityfactor` 是 field 自身属性，不是 region 公共常量。
- `region.density` 是共享的 base density。
- `class_id` 是从 field 的 `ref` 解析出来的，不是 `ware`。
- `universeobjectdensities` 属于 gamestart Universe 级覆盖项；默认无自定义时，可按单位倍率看待。

- 代码锚点：
  - 旧链路文档中 `FUN_140e842e0` 字段映射表
  - 旧链路文档中 `FUN_140e80300` 小节

### 3.2 `MultiplierB`

结论：`已确认，但需要区分 groupref solid field 与无 groupref field`

```text
MultiplierB
= universeyielddensities(ware)
 * field.yield
 * universeobjectyielddensities(ware)
```

说明：

- `MultiplierB` 直接读的是 `field + 0x1118`，不是直接读 XML。
- 对带 `groupref` 的 solid field，`field + 0x1118` 的优先来源是 `regionobjectgroups/<group yield="...">`。
- 对当前 `yield` 仍为 `0` 的 field，`FUN_140e83f80` 才会把 `regionyields[ware][yield_tag].resourcedensity` 写进 `+0x1118`。
- 因此：
  - 带 `groupref` 的 asteroid/object field：

```text
MultiplierB
= universeyielddensities(ware)
 * regionobjectgroups[groupref].yield
 * universeobjectyielddensities(ware)
```

  - 无 `groupref` 或未预先填值的 field：

```text
MultiplierB
= universeyielddensities(ware)
 * regionyields[ware][yield_tag].resourcedensity
 * universeobjectyielddensities(ware)
```

- 代码锚点：
  - 旧链路文档中 `FUN_140e803e0` 小节
  - 代码细节文档中 `FUN_140e950a0`
  - 代码细节文档中 `FUN_140e84940`
  - 代码细节文档中 `FUN_140e83f80`

### 3.3 region 分配阶段的 field 权重

结论：`已确认`

当 `FUN_14073e110` 调 `field->vfunc(+0xa0, 1)` 时，当前保留的权重式是：

```text
field_weight
= MultiplierA
 * MultiplierB
 * (F(maxnoisevalue) - F(minnoisevalue))
```

这里不带 `resourcepercentage`。

说明：

- `resourcepercentage` 只在 `param_2 == 0` 的另一条分支中进入 `gate`。
- `FUN_14073e110` 调的是 `field->vfunc(+0xa0, 1)`，所以 region 分配归一化权重不包含 `resourcepercentage`。

- 代码锚点：
  - 旧链路文档中 “`FUN_140e85b80` 的一个关键点之前被写错了”
  - 旧链路文档中旧版 `FUN_140e85b80` 描述段

### 3.4 单个 `AsteroidField` 的单 area 贡献

结论：`已确认`

当前可用逻辑式：

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

- 这里的 `NoiseIntegral(area)` 用的是 field resolved noise。
- `resourcepercentage` 参与 area contribution。
- 但它不参与 region 分配阶段的 `field_weight` 归一化。

- 代码锚点：
  - 旧链路文档中 “当前阶段可确认的 asteroid 贡献模型”
  - 旧链路文档中 “`FUN_140e84c30` 可以确认是 AsteroidField 的 area contribution 计算”

## 4. 当前可确认的数据来源

### 4.1 `regionyields`

结论：`已确认`

- 逻辑键名：`regionyields`
- 可见静态文件：
  - [regionyields/final.xml](/home/slepher/project/x4-station-calculator/x4raw_assets/8.0-Diplomacy/libraries/regionyields/final.xml)
- 逻辑结构：

```text
regionyields[ware][yield_name] -> payload
```

对 solid 当前最关键的是：

- `resourcedensity`
  - 对没有预置 `group yield` 的 field，会写入 `field + 0x1118`
  - 对带 `groupref` 的 asteroid field，它仍参与 region 分配链，但通常不会覆盖已由 group 设置好的 `+0x1118`
- `replenishtime`
  - 已确认会被读入 payload，但当前不写成这条“初始总量/当前 amount”链中的核心主项
- `gatherspeedfactor`
  - 同样已读入，但当前不写成这条主链的核心主项

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

- 若用户未在 `gamestarts.xml` 中自定义这些项，当前按单位乘子 `1` 处理。

### 4.3 `regionobjectgroups`

结论：`已确认`

- 逻辑键名：`regionobjectgroups`
- 可见静态文件：
  - [regionobjectgroups/final.xml](/home/slepher/project/x4-station-calculator/x4raw_assets/8.0-Diplomacy/libraries/regionobjectgroups/final.xml)
- 逻辑结构：

```text
regionobjectgroups[group_name] -> { resource, yield, yieldvariation, entries... }
```

对带 `groupref` 的 solid field，当前最关键的是：

- `group.resource`
  - 通过 `FUN_140e84940` 写入 `field + 0x1110`
- `group.yield`
  - 通过 `FUN_140e84940` 写入 `field + 0x1118`
  - 会直接进入 `MultiplierB`
- `group.yieldvariation`
  - 通过 `FUN_140e84940` 写入 `field + 0x1194`
  - 会直接进入 per-object amount 生成器

这意味着对 `p1_40km_ice_field` 这类 `groupref="asteroid_ice_l/m/s/xs"` 的 solid field：

- `400 / 200 / 100 / 10` 才是 `MultiplierB` 使用的主 `yield`
- 不是 `ice.medium` 对应的 `resourcedensity = 15`

## 5. 对估算的直接约束

### 5.1 不能先把整个 region 均匀化，再按 densityfactor 事后拆份额

结论：`已确认`

这类估算不成立，因为它违背了：

- field resolved noise
- field 自己的 `MultiplierA`
- field 自己的 `MultiplierB`
- field 自己的 `group yield`
- field 自己的 noise window
- area contribution 逐 field 求值，最后再求和

因此对类似 `p1_40km_ice_field` 的估算，正确方向必须是：

```text
每个 field 单独算自己的 area / total contribution
-> 最后相加
```

而不是：

```text
先求一个 region 平均密度
-> 再按 field 比例拆账
```

### 5.2 即便多个 field 共享同一组 noise 参数，也仍然要视为逐 field 求值

结论：`已确认`

- 有些具体 region 中，多个 `AsteroidField` 确实可能恰好写了相同的 `seed/noisescale/minnoisevalue/maxnoisevalue`。
- 这只意味着“数值上可能化简”，不意味着运行时逻辑退化成单一 region noise。
- 逻辑顺序仍然是：

```text
field_1 resolved noise
field_2 resolved noise
field_3 resolved noise
...
```

然后逐 field 进入公式。

### 5.3 用于存档 `max` 的工程估算模型

结论：`阶段性模型`

如果目标是估算存档里的 whole-region `max`，而不是逐 `64k area` 精确复现 runtime，那么当前可用的工程模型是：

```text
EstimatedTotal
≈ Volume
 * AvgFalloff
 * AvgNoise
 * region.density
 * 0.01
 * Σ(densityfactor_i * group_yield_i)
```

这个模型明确只声明为“估算值”，不声明为精确 runtime 公式。

适用前提：

- solid field 带 `groupref`
- 多个 field 的 noise 参数相同或近似相同
- `class_multiplier` 与 Universe 覆盖项暂按公共常量处理
- 目标是拟合存档总量，而不是重建逐 area 分配过程

对 `Cluster_03_Sector001_macro / p1_40km_ice_field`：

- `Volume ≈ 9817.48`
- `AvgFalloff ≈ 0.5664`
- `AvgNoise ≈ 0.25`
- `region.density = 1.5`
- `Σ(densityfactor_i * group_yield_i)`
  - `= 3*400 + 18*200 + 24*100 + 30*10`
  - `= 7500`

先算分配阶段缩放：

```text
sum_weights
= AvgNoise * region.density * 0.01 * Σ(densityfactor_i * group_yield_i)
= 0.25 * 1.5 * 0.01 * 7500
= 28.125

per_field_value
= resourcedensity / sum_weights
= 15 / 28.125
= 0.533333...
```

因此若按当前保留的 writeback 链继续落到 contribution，总量估算不能漏掉这一步缩放：

```text
EstimatedTotal
≈ 9817.48 * 0.5664 * 0.25 * 1.5 * 0.01 * 7500 * 0.533333...
≈ 83409
```

当前这组估算与存档样本 `188184` 偏差约 `20%`，可作为工程估算参考。

说明：

- 这条模型的关键变化是：field 间主权重按 `densityfactor * group_yield`
- 它用于“估算存档值”，不是替代代码级 per-field / per-area 逻辑

### 5.4 关于 `sum_weights`：当前复核结论

结论：`已确认：代码中没有看到它被直接约掉`

当前重新复核后，可以明确区分两条链：

1. region 分配阶段：

```text
field_weight_i
= MultiplierA_i
 * MultiplierB_i(before writeback)
 * noise_window_i

sum_weights = Σ field_weight_i
p = T / sum_weights
```

2. area contribution 阶段：

```text
AsteroidContribution_i(area)
≈ MultiplierA_i
 * MultiplierB_i(after writeback)
 * resourcepercentage_i
 * local_noise_i(area)
 * falloff_i(area)
 * clamp_i(area)
```

关键点：

- `sum_weights` 只出现在分配阶段，由 `FUN_14073e110` 计算并作为 `per_field_value` 的分母。
- `FUN_140e84990` 不会把 `sum_weights` 原样保存到某个字段里；它只把 `p = T / sum_weights` 折进：
  - `field + 0x1118 = yield`
  - `field + 0x1190 = resourcepercentage`
- `FUN_140e84c30` 后续读取的是写回后的 field 状态，不会再次直接读取 `sum_weights`。

因此：

- 若在强简化的工程模型里出现“某些项约掉”，那是模型化简的代数结果。
- 但从代码执行顺序看，当前没有证据说明存在一条“后续函数把 `sum_weights` 显式消除”的链。

当前最稳的理解是：

```text
sum_weights
-> 先决定归一化因子 p
-> p 再通过 yield/resourcepercentage 影响后续 contribution
```

而不是：

```text
sum_weights
-> 在后续代码里被直接抵消掉
```

### 5.5 宏观期望总量的收束式

结论：`高可信（仅在强简化模型下保留）`

当前可以把 solid 的整片矿区“宏观期望总量”收束成：

```text
Total ≈ Volume * AvgFalloff * resourcedensity
```

这条式子成立时，`AvgNoise` 不应再额外乘一次；否则会对 noise 做重复计数。

这里要明确区分两层：

- 代码执行顺序上，`sum_weights` 并没有在后续函数里被“显式读出后再约掉”
- 但在强简化的工程模型里，`sum_weights` 可以通过 `per_field_value -> writeback -> contribution` 这条链，作为代数中间项被吸收

成立前提：

- 已确认两阶段共享同一组核心乘子：

```text
分配阶段主干
= MultiplierA_i
 * MultiplierB_i(before writeback)
 * noise_window_i

落地阶段主干
≈ MultiplierA_i
 * MultiplierB_i(after writeback)
 * local_noise_i
```

- 另需额外假设：宏观平均下，局部 `local_noise` 的空间积分可近似回到对应的 `noise_window`：

```text
(1 / Volume) * ∫ local_noise_i dV ≈ noise_window_i
```

- `boundary/falloff` 可独立平均化为 `AvgFalloff`
- `clamp` 不引入额外失真，或已被平均项吸收
- `per_field_value` 经过 writeback 后，只是在 `resourcepercentage` 与 `yield` 之间转移线性缩放，不破坏两者乘积

关键原因：

1. 分配阶段：

```text
per_field_value = resourcedensity / sum_weights
```

2. 写回后，后续 contribution 真正吃的是：

```text
effective_product = yield * resourcepercentage
```

3. 对 `per_field_value <= 1`：

```text
effective_product = original_yield * per_field_value
```

4. 对 `per_field_value > 1`：

```text
resourcepercentage = 1
yield = original_yield * per_field_value
effective_product = original_yield * per_field_value
```

5. 对 `per_field_value < resourcepercentage_floor`：

```text
resourcepercentage = resourcepercentage_floor
yield = original_yield * (per_field_value / resourcepercentage_floor)
effective_product = original_yield * per_field_value
```

因此在宏观积分下，分子中的：

```text
Σ(MultiplierA_i * MultiplierB_i * local_noise_i)
```

在平均化前提下可以回到：

```text
Σ(MultiplierA_i * MultiplierB_i * noise_window_i)
= sum_weights
```

最终收束为：

```text
Total ≈ Volume * AvgFalloff * resourcedensity
```

说明：

- 这是“宏观期望总量”的结论，不是单个 `64k area` 或单次实例化的严格值
- 当前不要把它扩写成无条件定理
- 当前已确认的 writeback 分支都保持等比例缩放：
  - `per_field_value <= 1`
  - `per_field_value > 1`
  - `per_field_value < resourcepercentage_floor`
- 这些分支改变的是矿区形态，不改变宏观总量
- 当前真正需要保守处理的，只剩 `clamp / falloff / noise` 存在强耦合且不能被平均化吸收的情况

## 6. 当前不要写成定论的部分

### 6.1 “solid 资源总量链已完全闭合”

结论：`不保留`

- 当前已经能给出强约束的 per-field / per-area 主链。
- 但“从 region XML 一路无缺口推到游戏中最终精确总量”的完全闭环表述，当前不保留。

### 6.2 任何把 `resourcedensity` 直接当作 whole-region 基础单位体积量的写法

结论：`不成立`

- `resourcedensity` 是 `MultiplierB` 的核心幅值来源之一。
- 但对 solid 而言，它必须放回 per-field 乘子链和 area 贡献链中理解。
- 不能脱离 `densityfactor`、field noise、field 权重和后续写回逻辑，直接把它提升成 whole-region 的最终基础密度。
