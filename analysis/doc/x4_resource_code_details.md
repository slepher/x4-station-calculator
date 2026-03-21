# X4 资源运行时代码细节锚点

本文只保留便于回到 Ghidra 复核的逆向锚点：函数地址、虚表槽位、关键偏移、属性 id、字符串/逻辑节点名。  
逻辑结论见 [x4_resource_logic_conclusions.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_logic_conclusions.md)。  
旧文档 [x4_resource_runtime_reverse_chain.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_runtime_reverse_chain.md) 保留不动，作为回测对照。

## 1. 关键函数与职责

- `FUN_14073e110`
  - region 级 solid 分配主入口
  - 作用：
    - 找 matching field
    - `vfunc(+0x20)` 灌 payload
    - `vfunc(+0xa0, 1)` 累加权重
    - `vfunc(+0x28, per_field_value)` 写回
  - 对照：
    旧链路文档中 “Region 级 solid 分配主入口：`FUN_14073e110`”

- `FUN_140e842e0`
  - `AsteroidField` 初始化函数
  - 关键：初始化 `+0x1118`、`+0x1150`、`+0x1158`、`+0x1190`
  - 对照：
    旧链路文档中 `FUN_140e842e0` 小节

- `FUN_140e950a0`
  - `RegionObjectGroupXML` 解析器
  - 关键：解析 `resource`、`yield`、`yieldvariation`
  - 对照：
    当前文档中 `RegionObjectGroupXML` 小节

- `FUN_140e84940`
  - `field->vfunc(+0x18, group)`
  - 关键：把 `group.resource / group.yield / group.yieldvariation` 写入 field
  - 对照：
    当前文档中 “groupref 写回链”

- `FUN_140e80300`
  - `AsteroidField::vtable[55]`
  - 虚槽：`+0x1b8`
  - 当前语义：`MultiplierA`
  - 对照：
    旧链路文档中 `FUN_140e80300` 小节

- `FUN_140e803e0`
  - `AsteroidField::vtable[19]`
  - 虚槽：`+0x98`
  - 当前语义：`MultiplierB`
  - 对照：
    旧链路文档中 `FUN_140e803e0` 小节

- `FUN_140e85b80`
  - `AsteroidField::vfunc(+0xa0, ...)`
  - 当前语义：region 分配阶段使用的 field 权重函数
  - 对照：
    旧链路文档中 “`FUN_140e85b80` 的一个关键点之前被写错了”

- `FUN_140e84c30`
  - `AsteroidField` 单 area contribution 函数
  - 当前工程里可直接反编译到的 area contribution 入口
  - 对照：
    旧链路文档中 “`FUN_140e84c30` 可以确认是 AsteroidField 的 area contribution 计算”

- `FUN_140e83f80`
  - `AsteroidField::vfunc(+0x20)`
  - 接收 region-yield payload
  - 关键写回：
    - `param_2[2] -> field + 0x1118`（当前 yield 仍为 0 时）
    - `param_2[0] -> field + 0x111c`
    - `param_2[1] -> field + 0x1120`
  - 对照：
    旧链路文档中 “`FUN_14073e110` 的 region 分配链可以确认”

- `FUN_140e84990`
  - `AsteroidField::vfunc(+0x28, per_field_value_int)`
  - 关键写回：
    - `+0x1190 = resourcepercentage`
    - `+0x1118 = yield`
  - 对照：
    旧链路文档中 `FUN_140e84990` 小节

- `FUN_1400b7620`
  - noise window / occupancy 权重函数
  - 对照：
    旧链路文档中 `FUN_1400b7620` 小节

- `FUN_14073f750`
  - boundary / falloff 对 `64k area` 的几何权重函数
  - 对照：
    旧链路文档中 `FUN_14073f750` 小节

## 2. `AsteroidField` 关键偏移

这些偏移当前都已经在旧链路文档里有过直接对应。

- `+0x1110`
  - `ware_key`
  - `FUN_140e803e0` 用它查两张 Universe 级按-ware 表

- `+0x1118`
  - `yield`
  - 初始化来源之一：`FUN_140108c70(param_3, 0x96, 0)`
  - `groupref` 写回来源：`FUN_140e84940 <- RegionObjectGroup + 0x28`
  - `regionyields` payload 来源：`FUN_140e83f80`，但仅当当前 `yield == 0`
  - 会被 `FUN_140e84990` 再次改写

- `+0x1150`
  - 初始化式：

```text
FUN_140108c70(param_3, 0x19, 1.0f) * param_6 * 0.01
```

  - 当前语义：`densityfactor * region.density * 0.01`

- `+0x1158`
  - `ref`
  - `FUN_140e80300` 用它解出 `class_id`

- `+0x1190`
  - `resourcepercentage`
  - 初始化式：

```text
FUN_140106340(param_3, 0x67, 100) * 0.01
```

- `+0x10d4`
  - `noisescale`

- `+0x10e0`
  - `minnoisevalue`

- `+0x10e4`
  - `maxnoisevalue`

- `+0x1194`
  - `yieldvariation`
  - region 定义初始化来源：`FUN_140e842e0 <- attr 0x97`
  - groupref 写回来源：`FUN_140e84940 <- RegionObjectGroup + 0x2c`

- 旧链路文档对照：
  - 旧链路文档中 `FUN_140e842e0` 字段映射表
  - 旧链路文档中 `FUN_1400b7620` 小节

## 3. 属性 id 与 `RegionXML` 注册表

- `FUN_140eb41d0`
  - 初始化 `"RegionXML"`
  - 静态表：`DAT_142675a58`

- 已直接对出的关键 attr id：
  - `0x19 -> densityfactor`
  - `0x61 -> ref`
  - `0x67 -> resourcepercentage`
  - `0x2b -> groupref`

- 旧链路文档对照：
  - 旧链路文档中 “`RegionXML` 静态注册表已直接对出关键 attr id”

## 4. `MultiplierA` 的锚点

- 函数：
  - `FUN_140e80300`
- 虚槽：
  - `AsteroidField::vtable[55]`
  - `+0x1b8`
- 读取：
  - `*(float *)(param_1 + 0x1150)`
  - `*(longlong *)(param_1 + 0x1158)`
- 行为：
  - 通过 `+0x1158` 对应对象解析 `class_id`
  - 去 `DAT_143df3f88 + 0xf0/+0xf8` 查 `class_multiplier`
  - 返回：

```text
field_1150 * class_multiplier
```

- 逻辑节点名：
  - `universeobjectdensities(class_id)`

- 旧链路文档对照：
  - 旧链路文档中 `FUN_140e80300` 小节

## 5. `MultiplierB` 的锚点

- 函数：
  - `FUN_140e803e0`
- 虚槽：
  - `AsteroidField::vtable[19]`
  - `+0x98`
- 读取：
  - `*(ulonglong *)(param_1 + 0x1110)`
  - `*(float *)(param_1 + 0x1118)`
- 查表：
  - `DAT_143df3f88 + 0x130/+0x138`
    - `universeyielddensities`
  - `DAT_143df3f88 + 0x170/+0x178`
    - `universeobjectyielddensities`
- 返回：

```text
lookup(universeyielddensities, ware_key)
 * field_1118
 * lookup(universeobjectyielddensities, ware_key)
```

- 对 `field_1118` 的当前优先级：
  - 带 `groupref` 的 solid field：
    - 先由 `FUN_140e84940` 从 `RegionObjectGroup + 0x28` 写入
  - 否则：
    - 可由 `FUN_140e83f80` 从 `regionyields payload[2]` 写入
  - 之后：
    - `FUN_140e84990` 会按 `per_field_value` 再改写

- 旧链路文档对照：
  - 旧链路文档中 `FUN_140e803e0` 小节
  - 旧链路文档中 “`MultiplierB` 现在可以收束成最终结论”

## 5.1 `RegionObjectGroupXML` 与 `groupref` 写回链

- `FUN_140e950a0`
  - 解析 `RegionObjectGroupXML`
  - 关键字段：

```text
param_1 + 0x20 = group.resource
param_1 + 0x28 = group.yield
param_1 + 0x2c = group.yieldvariation
```

  - 直接反编译片段：

```text
FUN_140108c70(param_2, 8, ...)  -> *(float *)(param_1 + 0x28)
FUN_140108c70(param_2, 9, ...)  -> *(float *)(param_1 + 0x2c)
```

- `FUN_140e81ff0`
  - 解析 `groupref(attr 0x2b)`
  - 找到对应 `RegionObjectGroup`
  - 对每个生成出的 field 调：

```text
field->vfunc(+0x18, group)
```

- `FUN_140e84940`
  - 该 setter 当前已可直接反编译到：

```text
if field.ware == 0:
  field.ware = group.resource

if field.yield < epsilon:
  field.yield = group.yield
  field.yieldvariation = group.yieldvariation
  field.resourcepercentage = 0
```

  - 关键偏移：

```text
group + 0x20 -> field + 0x1110
group + 0x28 -> field + 0x1118
group + 0x2c -> field + 0x1194
```

## 6. region 分配链的锚点

- 主入口：
  - `FUN_14073e110`

- 当前保留的执行顺序：

```text
1. 找 matching solid field
2. 对每个 field 调 vfunc(+0x20)
3. 对每个 field 调 vfunc(+0xa0, 1) 累加权重
4. per_field_value = global_multiplier_for_ware * resourcedensity / sum(field_weights)
5. 对每个 field 调 vfunc(+0x28, per_field_value)
```

- 关键补充：
  - `vfunc(+0x20)` 的 `FUN_140e83f80` 只有在 `field + 0x1118 == 0` 时才会把 `regionyields payload[2]` 写进 `yield`
  - 因此对带 `groupref` 的 solid asteroid field，`regionobjectgroups.group.yield` 会优先占据 `+0x1118`

- 其中：
  - `global_multiplier_for_ware`
    - 查 `DAT_143df3f88 + 0x130`
    - 默认 `1.0`
  - `resourcedensity`
    - 来自 `FUN_140ed8dc0 payload + 0x30`

- 旧链路文档对照：
  - 旧链路文档中 `FUN_14073e110` 的 solid 分配段
  - 旧链路文档中 “solid 分配公式”

## 7. `field->vfunc(+0xa0, 1)` 的修正点

- 函数：
  - `FUN_140e85b80`

- 当前重新核实后的式子：

```text
return MultiplierA * MultiplierB * gate * (F(maxnoisevalue) - F(minnoisevalue))
```

- 关键分支：
  - `param_2 == 0`
    - `gate = field.resourcepercentage`
  - `param_2 != 0`
    - `gate = 1.0`

- 对 `FUN_14073e110` 的含义：
  - 它调用的是 `field->vfunc(+0xa0, 1)`
  - 所以 region 分配阶段的权重不包含 `resourcepercentage`

- 旧链路文档对照：
  - 修正结论：
    旧链路文档中 “`FUN_140e85b80` 的一个关键点之前被写错了”
  - 被修正的旧表述：
    旧链路文档中旧版 `FUN_140e85b80` 描述段

## 8. noise 与 `64k area` 的锚点

- `FUN_14073f750`
  - 将查询位置映射到 `64k` 网格
  - 出现 `1 / 64000 = 1.5625e-05`
  - 构造局部 query box
  - 结合 boundary/profile 计算几何权重

- `FUN_1400b7620`
  - 使用：
    - `+0x10d4 = noisescale`
    - `+0x10e0 = minnoisevalue`
    - `+0x10e4 = maxnoisevalue`
  - 对当前局部坐标/`64k area` 取 noise 值
  - 做 window 裁剪与软过渡

## 8.1 boundary RTTI / COL / vfptr 映射

这一层已经可以从 RTTI `type descriptor` 顺着 `CompleteObjectLocator (COL)` 闭合到具体 `vfptr`。

已确认的 `type descriptor`：

- `Boundary`
  - `0x1432f2a70`
- `SplineTubeBoundary`
  - `0x1432f2a98`
- `CylinderBoundary`
  - `0x1432f2ac8`
- `BoxBoundary`
  - `0x1432f46f0`
- `SphereBoundary`
  - `0x1432f4718`

当前可直接闭合到的 `COL -> vfptr`：

- `CylinderBoundary`
  - `COL(offset=0)`: `0x142db9920`
  - `vfptr`: `0x142bde490`
  - 已确认槽位：
    - `+0x00 -> 0x1400c58f0`
    - `+0x08 -> 0x14031ba80`
    - `+0x10 -> 0x14011b510`
  - `COL(offset=8)`: `0x142db98d0`
  - `vfptr`: `0x142bde570`
  - 已确认槽位：
    - `+0x00 -> 0x1406680cc`
    - `+0x08 -> 0x14093d7a0`
    - `+0x10 -> 0x14093d860`

- `SplineTubeBoundary`
  - `COL(offset=8)`: `0x142db98f8`
  - `vfptr`: `0x142bde550`
  - 已确认槽位：
    - `+0x00 -> 0x140668108`
    - `+0x08 -> 0x14093e9a0`
    - `+0x10 -> 0x14093e9f0`
  - `COL(offset=0)`: `0x142db98a8`
  - `vfptr`: `0x142bde590`
  - 已确认主表槽位：
    - `+0x00 -> 0x140582d60`
    - `+0x08 -> 0x140169370`
    - `+0x10 -> 0x14011b510`
    - `+0x18 -> 0x1403526a0`
    - `+0x20 -> 0x1403526a0`
    - `+0x28 -> 0x14093e440`
    - `+0x30 -> 0x14093eaa0`
    - `+0x38 -> 0x14093eb60`
    - `+0x40 -> 0x14093ed00`
    - `+0x48 -> 0x14009d970`
    - `+0x50 -> 0x14093ed10`
    - `+0x58 -> 0x14093ed40`
    - `+0x60 -> 0x14009d970`
    - `+0x68 -> 0x14093ed70`
    - `+0x70 -> 0x14093ee10`
    - `+0x78 -> 0x14093efc0`

- `SphereBoundary`
  - `COL(offset=8)`: `0x142dc1cd0`
  - `vfptr`: `0x142c09a80`
  - 已确认槽位：
    - `+0x00 -> 0x140799814`
    - `+0x08 -> 0x14093d000`
    - `+0x10 -> 0x14093d030`
  - `COL(offset=0)`: `0x142dc1ca8`
  - `vfptr`: `0x142c09b40`
  - 已确认主表槽位：
    - `+0x00 -> 0x1400b6f60`
    - `+0x08 -> 0x1400b6b40`
    - `+0x10 -> 0x14011b510`
    - `+0x18 -> 0x14066e490`
    - `+0x20 -> 0x14066e490`
    - `+0x28 -> 0x14093ccf0`
    - `+0x30 -> 0x14093d070`
    - `+0x38 -> 0x14093d0c0`
    - `+0x40 -> 0x14093d160`
    - `+0x48 -> 0x1400b5060`
    - `+0x50 -> 0x14009afe0`
    - `+0x58 -> 0x140582cd0`
    - `+0x60 -> 0x14009d970`
    - `+0x68 -> 0x14093d1a0`
    - `+0x70 -> 0x14093d1d0`
    - `+0x78 -> 0x14093d250`

- `BoxBoundary`
  - `COL(offset=8)`: `0x142dc1c80`
  - `vfptr`: `0x142c09be0`
  - 已确认槽位：
    - `+0x00 -> 0x1407995d0`
    - `+0x08 -> 0x14093c5a0`
    - `+0x10 -> 0x14093c620`
  - `COL(offset=0)`: `0x142dc1d00`
  - 当前还没有拿到指向其 `vfptr` 的直接 xref，不能继续把主表槽位写死。

注意：

- 这里的 `COL(offset=0)` / `COL(offset=8)` 对应的是不同子对象视角下的 vfptr。
- 真正被 `FUN_14093bd40 / FUN_14093bf90 / FUN_14093c2c0` 消费的是对象虚表上更深的槽位：
  - `+0x48`
  - `+0x58`
  - `+0x60`
  - `+0x70`
  - `+0x78`
- 当前已经能把 `SphereBoundary` 与 `SplineTubeBoundary` 的这些槽位完整列出；
  `CylinderBoundary` 与 `BoxBoundary` 还只拿到了短表，需要继续沿数据结构追主表。

## 8.2 碰撞 / 几何权重调用链的性质

当前逆向证据支持把这一层定性为：**内部流程中的 boundary/profile 计算链**，不是一个对外导出的独立碰撞 API。

直接证据：

- 导出表中只看到镜像起始附近的少量导出符号，当前这条链上的关键函数都不在导出表里：
  - `FUN_140e83ff0`
  - `FUN_14073f6a0`
  - `FUN_14073f750`
  - `FUN_14093bd40`
  - `FUN_14093bf90`
  - `FUN_14093c2c0`
- `FUN_14073f6a0` 的静态 caller：
  - `FUN_140e83ff0`
  - `FUN_1403868c0`
- `FUN_14073f750` 的静态 caller：
  - `FUN_14073fee0`
  - `FUN_140e80390`
  - `FUN_140e84c30`
  - `FUN_14075c250`
  - `FUN_140e84170`
- `FUN_140e83ff0` 当前没有静态 caller xref，更像是通过对象虚表或更高层分发进入，而不是普通全局导出函数。

聚合器函数本身也说明这不是“单个 shape 自己暴露一个碰撞接口”，而是：

- `FUN_14093bd40(...)`
  - 遍历子对象数组
  - 调子对象虚表：
    - `+0x48`
    - `+0x58`
    - `+0x60`
    - `+0x70`
  - 然后把返回结果乘/补集聚合
- `FUN_14093bf90(...)`
  - 结构与 `FUN_14093bd40(...)` 同形
  - 只是内部用的采样/插值函数不同
- `FUN_14093c2c0(...)`
  - 遍历子对象数组
  - 直接累加子对象虚表 `+0x78`

因此当前最稳的调用链理解是：

```text
ResourceField / Nebula runtime
-> FUN_140e83ff0 / FUN_140e84170 / FUN_140e84c30
-> FUN_14073f6a0 / FUN_14073f750
-> FUN_14093bd40 / FUN_14093bf90 / FUN_14093c2c0
-> Boundary 子类虚表槽位 (+0x48 / +0x58 / +0x60 / +0x70 / +0x78)
```

结论：

- `碰撞/命中检查` 更像资源系统内部的 query-volume / profile 求值步骤。
- `Boundary` 各 shape 的具体几何逻辑主要藏在虚表槽位后面。
- 当前没有证据表明这一层是单独导出给外部模块调用的公共 API。

## 8.3 `SphereBoundary` / `SplineTubeBoundary` 槽位语义

这一步只记录当前已经能从反编译直接读出来的槽位语义，不把未证实部分写死。

### `SphereBoundary`

- `+0x58 -> FUN_140582cd0`

```c
*param_2 = 0;
param_2[1] = 1.0;
```

可直接确认它返回固定区间 `[0, 1]`。

- `+0x70 -> FUN_14093d1d0`

核心逻辑：

```text
d = distance(query_center.xyz, sphere_center.xyz)
lower = max((d - query_radius) / sphere_radius, 0)
upper = min((d + query_radius) / sphere_radius, 1)
return [lower, upper]
```

可确认这是一个**球半径归一化区间**计算。

- `+0x78 -> FUN_14093d250`

```text
return radius^3 * 4.188790...
```

其中常量 `0x40860a92` 即 `4.188790... = 4/3 * π`。

因此可直接确认：

```text
SphereBoundary +0x78 = sphere volume = 4/3 * π * r^3
```

### `SplineTubeBoundary`

- `+0x58 -> FUN_14093ed40`

```text
delegate to spline_subobject.vfunc(+0x70)
with (param_4 + tube_radius)
```

可直接确认这是一个**带 tube 半径扩张的委托包装器**，不是最终几何公式本体。

这里的 `param_1 + 0x10` 不是另一个 `BoundaryList`，而是 `Math::CompositeSpline<3>` 子对象。
因此：

```text
SplineTube +0x58
= 先在 spline 参数空间上求“受 query_radius + tube_radius 影响的参数区间”
```

也就是：先求“这次 query 可能影响 spline 的哪一段参数范围”。

- `+0x70 -> FUN_14093ee10`

当前可直接确认的行为：

- 先通过自身 `+0x58` 取得 spline 参数区间
- 再调用 `CompositeSpline::sample(t)` 对中心线做采样
- 之后把采样点与 query 中心的距离折算成：

```text
lower = max((d - query_radius) / tube_radius, 0)
upper = min((d + query_radius) / tube_radius, 1)
```

也就是：**沿 spline 中心线取样后，对 tube 半径做归一化区间计算**。

这里仍有一个未完全钉死的点：

- 反编译里两次 sample 都围绕 `+0x58` 返回的参数区间展开
- 但参数区间内部究竟如何挑样、是否总是双端点，都还值得继续追

所以当前最稳口径是：它是 spline-tube 的半径归一化区间计算函数，但内部参数区间细节还值得继续追。

- `+0x68 -> FUN_14093ed70`

核心逻辑：

```text
t = spline_subobject.vfunc(+0x40)(query_center, ...)
closest = CompositeSpline::sample(t)
d = distance(query_center, closest)
return d / tube_radius
```

也就是：**query 点到 spline 中心线最近点的归一化径向距离。**

- `+0x60 -> FUN_14009d970`
- `+0x48 -> FUN_14009d970`

这两个槽位当前都落在同一个共享函数上，暂未继续细拆；在当前资源权重链里，真正有价值的是：

- `+0x58`：参数区间
- `+0x68`：最近中心线距离
- `+0x70`：tube 半径归一化区间
- `+0x78`：tube 体积

- `+0x78 -> FUN_14093efc0`

```text
return spline_length * 3.1415927... * tube_radius^2
```

其中常量 `0x40490fdb` 即 `π`。

因此可直接确认：

```text
SplineTubeBoundary +0x78 = tube volume = π * r^2 * length
```

### `SplineTubeBoundary` 的整体理解

当前最稳的结构是：

```text
SplineTubeBoundary
= CompositeSpline<3> 中心线
 + tube_radius
 + 若干采样得到的 CylinderBoundary 子对象
 + 一个外包 BoxBoundary
```

其中：

- `FUN_14093e5c0(...)`
  - 会沿 spline 参数空间步进采样
  - 生成一串 `CylinderBoundary`
  - 放进内部列表
  - 同时根据所有采样点与 `tube_radius` 生成一个外包 `BoxBoundary`
- `FUN_14093b5a0(...)`
  - 会把这些子对象的 bounds / profile 汇总到 `BoundaryList`

因此 `SplineTubeBoundary` 不是“单公式 shape”，而是：

```text
中心线几何
-> 参数区间
-> 最近点采样
-> 管半径归一化
-> 内部 cylinder 近似 + box 外包
```

这也解释了为什么它和 simple `CylinderBoundary` 不同：

- simple cylinder：直接由一根轴线 + 半径定义
- splinetube：先有 spline 中心线，再在 runtime 派生出一组近似 cylinder 与外包 box

## 8.4 `CylinderBoundary` 槽位语义与 `64k query box` 权重

这一层已经可以直接把 `CylinderBoundary` 的关键槽位收成公式。

### `CylinderBoundary` 主表关键槽位

由 `vfptr = 0x142bde490` 可直接读出：

- `+0x58 -> FUN_14093dd10`
- `+0x70 -> FUN_14093de40`
- `+0x78 -> FUN_14093e1a0`

对当前资源系统，最重要的结论是：

- `+0x58`：轴向区间
- `+0x70`：径向区间
- `+0x78`：体积

### 运行时几何参数

`CylinderBoundary` 运行时存的是：

- `P0 = (x0, y0, z0, w0)`，位于 `+0x10 .. +0x1c`
- `P1 = (x1, y1, z1, w1)`，位于 `+0x20 .. +0x2c`
- `R`，位于 `+0x30`

定义：

```text
V = P1 - P0
L = |V|
```

这里的轴线不要求与世界 `Y` 轴对齐；所有投影都相对 `P0 -> P1` 这条实际轴线进行。

### `+0x58 -> FUN_14093dd10`：轴向区间

核心公式：

```text
t = dot(Q - P0, V) / dot(V, V)
delta = query_radius / |V|

lower = max(t - delta, 0)
upper = min(t + delta, 1)
```

返回：

```text
[lower, upper]
```

也就是：**把当前 `64k query box` 在圆柱轴线方向上的覆盖范围归一化到 `[0, 1]`。**

### `+0x70 -> FUN_14093de40`：径向区间

先求 query 中心到圆柱轴线的最近点：

```text
t = dot(Q - P0, V) / dot(V, V)
closest = P0 + t * V
d = distance(Q, closest)
```

再求半径方向归一化区间：

```text
lower = max((d - query_radius) / R, 0)
upper = min((d + query_radius) / R, 1)
```

返回：

```text
[lower, upper]
```

也就是：**把当前 `64k query box` 相对圆柱半径的覆盖范围归一化到 `[0, 1]`。**

### `+0x78 -> FUN_14093e1a0`：圆柱体积

公式：

```text
Volume = |V| * π * R^2
```

其中常量 `0x40490fdb` 即 `π`。

因此可直接确认：

```text
CylinderBoundary +0x78 = cylinder volume = length * π * r^2
```

### `64k area` 的权重口径

当前逆向更支持下面这条理解：

- 系统把每个 `64k area` 当成一个 `query box`
- `CylinderBoundary` 直接对这个 box 计算：
  - 轴向区间
  - 径向区间
- 再由上层 profile evaluator 把区间映射成连续权重

因此当前**没有**看到“把一个 `64k area` 再细分成很多小块体素逐块积分”的证据。

更准确的表达是：

```text
area_weight
= EvalA(axial_interval(query_box, cylinder))
 * EvalB(radial_interval(query_box, cylinder))
```

再乘进上层：

```text
area_value
= MultiplierA * MultiplierB * local_noise * resourcepercentage * falloff * clamp
```

其中 `falloff` 就来自这条 query-box 级的 boundary/profile 权重链。

### 边缘效应

因此：

- area 靠近圆柱端面：
  - `axial_interval` 变窄
  - `axial_weight` 下降
- area 靠近圆柱侧壁：
  - `radial_interval` 变窄
  - `radial_weight` 下降

结论：

- 不是只看 area 中心点
- 也不是把 `64k area` 再切碎
- 而是对整个 `64k query box` 算一个连续的 box-level 权重

## 8.5 区间 evaluator：`FUN_1414ed700` / `FUN_1414ed970`

`FUN_14093bd40 / FUN_14093bf90` 并不直接把区间 `[lower, upper]` 当权重使用，而是会把区间送进 evaluator：

- `FUN_1414ed700`
- `FUN_1414ed970`

### `FUN_1414ed700`

当前可直接确认：

- 输入：
  - 一组 profile control points
  - 一个区间 `[lower, upper]`
- 输出：
  - 区间上的**最大 profile 值**

它的行为大致是：

```text
EvalMax([a, b])
= 在 profile 折线与区间 [a, b] 上取最大值
```

细节上：

- 如果区间退化或几乎无宽度，走 `FUN_1414ed640(...)`
- 否则会遍历折线控制点
- 同时检查：
  - 区间端点值
  - 区间内部穿过的节点值
  - 端点所在折线段的线性插值值
- 最后返回区间上的最大值

因此：

```text
FUN_1414ed700 = profile over interval 的 max-evaluator
```

### `FUN_1414ed970`

当前可直接确认：

- 输入：
  - 一组 profile control points
  - 一个区间 `[lower, upper]`
- 输出：
  - 区间上的**平均 profile 值**

它的行为大致是：

```text
EvalAvg([a, b])
= (1 / (b - a)) * ∫ profile(x) dx, x ∈ [a, b]
```

细节上：

- 仍然会按折线 profile 分段
- 对每个落入 `[a, b]` 的片段做梯形积分
- 最后除以区间宽度，得到平均值

因此：

```text
FUN_1414ed970 = profile over interval 的 average-evaluator
```

### 聚合器与 evaluator 的关系

因此：

- `FUN_14093bd40(...)`
  - 用 `FUN_1414ed700(...)`
  - 更像区间上的 **max-profile 聚合**
- `FUN_14093bf90(...)`
  - 用 `FUN_1414ed970(...)`
  - 更像区间上的 **avg-profile 聚合**

写成简式：

```text
w_i(max-chain) = EvalMax(interval58_i) * EvalMax(interval70_i)
w_i(avg-chain) = EvalAvg(interval58_i) * EvalAvg(interval70_i)
```

再由上层做：

```text
Π(include_i: w_i) * Π(exclude_j: (1 - w_j))
```

### `FUN_14073f750` 在 gas 路径里采用的是 `EvalAvg`

对 gas 路径，`FUN_14073f750` 已可直接确认：

- 最终调用的是 `FUN_14093bf90(...)`
- 也就是 **avg-chain**
- 而不是 `FUN_14093bd40(...)` 的 max-chain

因此 gas 的 boundary/profile 权重应写成：

```text
w_i(gas)
= EvalAvg(interval58_i) * EvalAvg(interval70_i)
```

这里的 `EvalAvg` 对应 `FUN_1414ed970(...)`。

### `64k query box` 的 runtime 半径常量

在 `FUN_14073f750(...)` 内部：

- `DAT_1477709a4` 被初始化为 `DAT_142d8098c`
- `DAT_142d8098c = 55425.625`
- broadphase 检查使用 `DAT_1477709a4 * DAT_142d80234`
- 其中 `DAT_142d80234 = 1.5`

因此 gas query 的关键常量可直接写成：

```text
query_radius = 55425.625
broadphase_radius = 55425.625 * 1.5 = 83138.4375
```

`55425.625` 正好对应边长 `64000` query box 的外接球半径。

### `SplineTubeBoundary` 的 raw spline 语义闭合

对 `Cluster_713_Sector001_macro / region_cluster_713_sector_001_nebula_2` 这个样例，已可把
`regions.json.boundary.spline` 的语义收成：

- 每个控制点的 `(tx, ty, tz)` 是切线方向
- `outlength` / `inlength` 是 Bezier handle 长度
- 每一段 spline 是标准 cubic Bezier：

```text
P0
C0 = P0 + dir0 * outlength0
C1 = P1 - dir1 * inlength1
P1
```

对这个样例：

- raw spline 共有 3 个控制点
- 实际构成 2 段 cubic Bezier
- 每段采样 16 个等步进子段
- 得到 33 个 sampled points / 32 个 sampled segments

并且这条 Bezier 重建与 `regions.json._sampled_spline` 可逐点精确对齐。

因此当前最稳的 shape-only 闭合是：

```text
raw spline control points
-> cubic Bezier handles
-> 33 sampled points / 32 sampled segments
-> runtime splinetube replay
```

## 8.6 `SphereBoundary` / `BoxBoundary` 同层公式补齐

### `SphereBoundary`

#### `+0x60 -> FUN_14093d070`

```text
if query_radius < sphere_radius and distance(center, query) <= sphere_radius - query_radius:
    return 1
else:
    return 0
```

也就是：**query box 完全落在 sphere 内部时的布尔 gate。**

#### `+0x68 -> FUN_14093d160`

```text
d = distance(query_center, sphere_center)
return max(d - sphere_radius, 0)
```

也就是：**query 中心到 sphere 外表面的外部距离。**

#### `+0x70 -> FUN_14093d1d0`

```text
lower = max((d - query_radius) / R, 0)
upper = min((d + query_radius) / R, 1)
```

这是 sphere 的**半径归一化区间**。

#### `+0x78 -> FUN_14093d250`

```text
Volume = 4/3 * π * R^3
```

### `BoxBoundary`

#### `+0x08 -> FUN_14093c5a0`

当前可直接确认：

- 把 query 点减去 box 中心
- 投影到 box 的 3 个局部轴
- 做：

```text
abs(projected_coord_axis) <= extent_axis
```

全部满足则返回真。

这说明：

- `BoxBoundary` 的 runtime extent 是 **half-extent / 半长**
- 不是全长

#### `+0x10 -> FUN_14093c620`

与 `FUN_14093c5a0` 同形，但阈值变成：

```text
abs(projected_coord_axis) <= extent_axis + query_radius
```

也就是：**对 box 做 Minkowski 扩张后的命中 gate。**

### 形状层总结

当前已确认的 shape 关键公式可以收成：

- `CylinderBoundary`
  - 轴向区间：`+0x58`
  - 径向区间：`+0x70`
  - 体积：`+0x78`
- `SphereBoundary`
  - 内含 gate：`+0x60`
  - 外部距离：`+0x68`
  - 半径区间：`+0x70`
  - 体积：`+0x78`
- `BoxBoundary`
  - 半长内含 gate：`+0x08`
  - 半长 + query_radius 扩张 gate：`+0x10`

## 9. `FUN_140e84c30` 主乘法链复核

- 这轮重新拉了汇编与 raw pcode，当前可直接确认：

```text
clamp = min(FUN_14093c2c0(field+0x2b0) * DAT_142d7fb4c, DAT_14329cc48)
falloff = FUN_14073f750(...)
local_noise = FUN_1414f4840(field + 0xd4)
MultiplierA = vfunc(+0x1b8)
resourcepercentage = *(float *)(field + 0x1190)
MultiplierB = vfunc(+0x98)

area_value
= MultiplierB
 * MultiplierA
 * local_noise
 * resourcepercentage
 * falloff
 * clamp
```

- 关键排除项：
  - 没看到 `MultiplierA` 被平方
  - 没看到 `MultiplierB` 之外的额外 Universe/group 公共倍率
  - 没看到 `sum_weights` 在这里被重新读取或显式抵消

- 证据锚点：
  - `140e84da9 .. 140e84db5`
    - `MultiplierA * local_noise * resourcepercentage * falloff * clamp`
  - `140e84dbf .. 140e84dce`
    - 调 `vfunc(+0x98)` 取 `MultiplierB`
    - 再乘前面的累计乘积

- `FUN_140e84c30`
  - 只读取当前对象上的 resolved noise
  - 这也是“field 覆盖 region noise”的代码锚点

- 旧链路文档对照：
  - 旧链路文档中 `FUN_14073f750` 小节
  - 旧链路文档中 `FUN_1400b7620` 小节
  - 旧链路文档中 “关于 region noise 与 asteroid noise：代码确认是继承/覆盖”

## 9. 数据文件与逻辑节点名

- `regionyields`
  - 文件：
    [regionyields/final.xml](/home/slepher/project/x4-station-calculator/x4raw_assets/8.0-Diplomacy/libraries/regionyields/final.xml)
  - 结构：

```xml
<regionyields>
  <resource ware="ice">
    <yield name="medium" resourcedensity="15" ... />
  </resource>
</regionyields>
```

- `region_definitions`
  - 文件：
    [region_definitions/final.xml](/home/slepher/project/x4-station-calculator/x4raw_assets/8.0-Diplomacy/libraries/region_definitions/final.xml)
  - 作用：
    - 定义 region
    - 在 `<resources>` 中引用 `ware + yield`

- gamestart / Universe 逻辑节点名：
  - `universeobjectdensities`
  - `universeyielddensities`
  - `universeobjectyielddensities`

这些名字当前可作为回到 Ghidra 或 XSD 继续追查的稳定搜索锚点。
