# X4 资源运行态逆向链条总结

## 目标

当前目标不是继续理解 XML 语义，而是回答这两个问题：

1. 游戏运行时如何把资源相关 XML/导入节点变成可查询的内存结构。
2. 查询 `yield` / `mineables` / `max` 时，最终是从哪里取值。

本文基于对 `X4.exe` 的 Ghidra 静态逆向结果整理当前链条，并明确哪些部分已经确认，哪些仍待继续下钻。

---

## 一、当前已确认的总链条

### 1. 参数装载层

- `RegionYieldsList_LoadFromXml` (`FUN_140e94470`)
  - 从 `regionyields.xml` 读取 `resource -> yield` 定义。
  - 为每个 `ware` 建立按 `yield name` 索引的定义表。
- `RegionYieldDef_FromXml` (`FUN_140e94280`)
  - 解析单个 `yield` 节点。
  - 已确认字段：
    - `yield_name_id`
    - `rgb_packed`
    - `value_a`
    - `value_b`
  - `value_a/value_b` 的确切语义还未最终钉死，但它们来自 `yield` 节点的两个 float 属性。

### 2. Universe 参数导入层

- `FUN_1408a6300`（可视为 `UniverseClass::Import` 主导入函数的一部分）
  - 已确认导入三张 Universe 级按 `ware` 索引的参数表：
    - `universe + 0x130` = `universe_yield_density_by_ware`
    - `universe + 0x170` = `universe_object_yield_density_by_ware`
    - `universe + 0x1b0` = `universe_yield_replenish_time_by_ware`
  - 这些表从导入节点中读取 float 参数并存入树/映射结构。

### 3. Resource node tree 构建层

- 在 `FUN_1408a6300` 的 `iVar5 == 0xa4` 分支中，确认了资源 key tree 的构建：
  - `universe + 0x3e0` / `+0x400` / `+0x408` 维护一棵按 key 索引的树。
  - 每个 key 节点：
    - `node + 0x20` = key
    - `node + 0x28` = `ResourceNodePayload*`
  - 若节点尚无 payload：
    - `FUN_1400b4b30()` 分配空对象
    - `CopyResourceNodePayload(local_158, ppppppuVar8)` 用导入节点初始化 payload
    - 将结果挂到 `node + 0x28`

### 4. 主运行态资源对象初始化层

- `InitMainResourceRuntimeObject` (`FUN_140689450`)
  - 这是当前已发现的主运行态资源对象初始化函数。
  - 作用：
    - 从 `src_node` 的 typed children 中读取配置
    - 写入主对象若干固定偏移字段
    - 调 `InitResourcePayloadFromTypedChildren(runtime_obj + 0x500, src_node)`
  - 当前已确认的关键偏移：
    - `runtime_obj + 0x4f0`
    - `runtime_obj + 0x500`
    - `runtime_obj + 0x5f4`
    - `runtime_obj + 0x600`
    - `runtime_obj + 0x608`
  - 其中 `+0x500` 最关键，因为它是后续 payload graph 的入口。

### 5. Payload graph 构建层

- `InitResourcePayloadFromTypedChildren` (`FUN_140344500`)
  - 从 typed child 节点中抽取并初始化 payload graph。
  - 已确认行为：
    - 从某类 child 读取一个 float，写到 `param_1 + 0x20`
    - 从特定 typed child 构建两个子 payload：
      - `param_1 + 0xb0`
      - `param_1 + 0xb8`
    - 构建方式：
      - `obj = FUN_1400b4b30()`
      - `CopyResourceNodePayload(obj, child)`

- `CopyResourceNodePayload` (`FUN_140315510`)
  - 当前判断更像“复制/克隆 payload 节点”而不是直接做最终值计算。
  - 它会：
    - 拷贝基础头字段
    - 初始化两个内嵌子容器
    - 调：
      - `FUN_140446240(param_1, param_2)`
      - `FUN_140446150(param_1, param_2)`

- `FUN_140446240`
  - 复制 `param_2 + 0x18` 开始的 `5*qword` 数组容器。
- `FUN_140446150`
  - 复制 `param_2 + 0xc8` 开始的对象指针数组/容器。
  - 每个元素会再次通过 `CopyResourceNodePayload` 复制。

---

## 二、查询链条

### 1. 空间定位

- `ResourceOctree_SelectNodeForPosition` (`FUN_140773a10`)
  - 根据输入位置，选择资源 octree 的子节点/命中节点。
  - 这不是算资源值，而是位置到 node 的映射。

### 2. 资源位置查询

- `Sector_QueryResourcePositionsWithMinYield` (`FUN_14075b6f0`)
  - 构造：
    - `ResourceAreaNodeFilterByMinYield`
    - `ResourceNodeGetResourcePositionsCallback`
  - 在 sector 的资源 octree 上跑查询。

- `ResourceAreaNodeFilterByMinYield_Matches` (`FUN_14075d620`)
  - 按 key 列表遍历候选对象。
  - 调 `FUN_1407603f0(...)` 获取某个 key 下的值。
  - 和 `param_1 + 0x38` 的阈值比较，决定节点是否命中。

### 3. 最高 yield 查询

- `Sector_QueryHighestYieldForYieldName` (`FUN_140bbaa90`)
  - 构造：
    - `ResourceNodeGetHighestYieldCallback`
    - `ResourceAreaNodeFilterByYieldName`
  - 在 octree 中寻找最高 yield。

- `ResourceNodeGetHighestYieldCallback` 虚函数实现 (`FUN_14075dad0`)
  - 对每个命中节点：
    - `best_value_a = max(best_value_a, FUN_1407603f0(...))`
    - `best_value_b = max(best_value_b, FUN_140760320(...))`
  - 说明真正的节点数值来自这两个函数。

### 4. Mineables 导出

- `FUN_1407605d0`
  - 遍历 node tree 中的每个 key 节点。
  - 对每个 key 的对象链表调用运行态对象虚函数，导出 `(key, value)` 到输出容器。

- `FUN_1407604c0`
  - 类似 `FUN_1407605d0` 的简化版。
  - 直接调用较浅层的对象虚函数并导出 `(key, value)`。

---

## 三、当前已确认的数据结构

### 1. RegionYieldDef（已临时命名）

来自 `RegionYieldDef_FromXml`：

```cpp
struct RegionYieldDef {
  uint64_t yield_name_id;  // +0x00
  uint32_t rgb_packed;     // +0x08
  float value_a;           // +0x0c
  float value_b;           // +0x10
};
```

说明：

- `yield_name_id` 已确认来自 XML `yield` 节点的名称属性。
- `rgb_packed` 来自 resource 层的 RGB/effect 信息。
- `value_a/value_b` 来自两个 float 属性，但语义仍需结合注册表进一步确认。

### 2. ResourceKeyNode（已临时命名）

从 `FUN_1407605d0` / `FUN_1407604c0` 汇编分析可得：

```cpp
struct ResourceKeyNode {
  ...
  uint64_t key;        // +0x20
  ListHead obj_list;   // +0x28
};
```

说明：

- `RBX + 0x20` 被读取为当前 key。
- `RBX + 0x28` 被当作循环链表头，挂载该 key 对应的一组运行态资源对象。

### 3. RuntimeResourceObj（未识别真实类名）

从 `FUN_1407605d0` / `FUN_1407604c0` 汇编可确认：

```cpp
struct RuntimeResourceObj {
  ListLinks links;        // 开头用于链表遍历
  ...
  InterfaceA iface_a;     // +0x10, vfunc(+0x8) 返回基础值
  ...
  AdjustorInfo *adj;      // +0x28, 用于定位 InterfaceB
};
```

关键汇编：

- 基础值接口：

```asm
MOV RAX, qword ptr [RDI + 0x10]
LEA RCX, [RDI + 0x10]
CALL qword ptr [RAX + 0x8]
```

- 更深层值接口：

```asm
MOV RAX, qword ptr [RDI + 0x28]
MOVSXD RCX, dword ptr [RAX + 0x4]
ADD RCX, 0x28
ADD RCX, RDI
MOV RAX, qword ptr [RCX]
CALL qword ptr [RAX + 0x28]
```

说明：

- 最终 mineable/value 来自运行态对象虚函数，而不是直接从 XML 或 tree 节点字段裸读。

---

## 四、当前可以确认的关键结论

### 1. `max`/yield 不直接存在 XML 裸结构里

游戏不会在查询阶段重新解析 XML。

真实路径是：

1. `regionyields.xml` / Universe 导入参数
2. 生成 `ResourceNodePayload` / runtime object graph
3. 查询时按位置选 octree node
4. 再对 node 下挂的运行态资源对象调用虚函数返回值

### 2. 查询粒度确实和 `64000` 网格有关

- 多处读取逻辑都以 `64000.0` 为步长扫描/采样。
- 这与存档中的 `resourceareas` 结构一致。
- 说明 `64k area` 不仅是存档粒度，也是运行时查询/采样的重要粒度。

### 3. 运行态资源值最终来自多态对象接口

最核心的两条接口：

- `RuntimeResourceObj + 0x10` 的 `vfunc(+0x8)`
- 通过 `AdjustorInfo` 修正后的接口对象 `vfunc(+0x28)`

查询链并不直接读 `node->max` 一类裸字段，而是调用这些接口方法获取值。

### 4. 当前最接近“生成逻辑”的入口已经找到

当前最接近真正构建运行态资源图的函数是：

- `FUN_1408a6300` 的 `iVar5 == 0xa4` 分支
- `InitMainResourceRuntimeObject` (`FUN_140689450`)
- `InitResourcePayloadFromTypedChildren` (`FUN_140344500`)

这三者连起来，已经能解释：

- Universe 如何先建立按 key 索引的资源 payload 图。
- 主 runtime object 如何从 typed children 初始化。
- payload graph 如何进入后续可查询结构。

---

## 五、New Game 生成链补充：Field / ResourceField / Falloff / Noise

前文主要锁定了查询链和运行态 payload 图。后续继续追到 `Regions::Field` / `Regions::ResourceField` 后，可以进一步把“新游戏时资源场如何定义为可查询空间函数”补全。

### 1. `ResourceField` 构造函数

- `FUN_140e83d30`
  - 这是 `U::Regions::ResourceField::vftable` 对应的初始化函数。
  - 先调用共享基类初始化：
    - `FUN_140e80d20(...)`
  - 然后写入 `ResourceField` 特有参数。

已确认：

- `*param_1 = U::Regions::ResourceField::vftable`
- `param_1[0x222] = param_4`
  - 很像 `ware/key` 对应的资源类型 ID。
- `param_1 + 0x223`
  - 来自 XML 属性 `0x96`
  - 报错字符串明确说明这是 `resource yield`
- `param_1 + 0x111c`
  - 来自 XML 属性 `0x65`
  - 若不小于 `-0.9999` 则乘 `60.0`
  - 很像时间/周期参数
- `param_1 + 0x224`
  - 来自 XML 属性 `0x29`
  - 一个额外倍率参数

这说明：

- `ResourceField` 自身就保存了基础 `yield`/时间/倍率参数。
- 它不是单纯的查询辅助类，而是新游戏资源场的核心业务对象之一。

### 2. `Field` 共享基类初始化

- `FUN_140e80d20`
  - 可视为 `FieldBase_InitFromXml(...)`
  - 所有 field 子类都会先走这条共享初始化。

已确认的关键行为：

- 设置 `U::Regions::Field::vftable`
- 初始化锁、容器、链表头
- 生成一张长度 `0x400`（1024）的随机 float 表，写入 `param_1 + 0xd4`
- 读取多组共享 XML 参数：
  - `param_1 + 3`
  - `param_1 + 0x21f`
  - `param_1 + 0x10d4`
  - `param_1 + 0x21c`
  - `param_1 + 0x10e4`
- 从 child type `0x6c` 读取一个名字/hash，写入 `param_1 + 0x18`
- 从 child type `0x10` 读取颜色/额外 float，写入：
  - `param_1 + 0x21d`
  - `param_1 + 0x10ec`
- 从 child type `0x58` 构建一个 `XLib::EnvelopeProfile` 类对象，挂到：
  - `param_1 + 0x21e`

这说明：

- field 的空间分布不是一个简单常数球/盒，而是：
  - 几何/profile 参数
  - 1024 长度随机表
  - Envelope/Profile 对象
  - 再叠加 `ResourceField` 特有 `yield`

### 3. `ResourceField` 对查询盒的判定函数

- `FUN_140e83ff0`
  - 临时命名：`ResourceField_IntersectsQueryVolume`

关键逻辑：

1. 调 `vfunc(+0xb0)` 检查 field 是否启用。
2. 在 `param_2` 中查找当前 `ResourceField` 的 `ware/key` 是否命中 `param_1[0x222]`。
3. 用 `param_1 + 0x10d4` 作为尺度参数，把查询盒 `(position ± radius)` 归一化到 field 局部网格。
4. 调：
   - `FUN_1414f4840((longlong)param_1 + 0xd4, ..., (int)param_1[0x21c], *(undefined4 *)((longlong)param_1 + 0x10e4))`
   - 这一步负责 noise/voxel 采样求值。
5. 再调：
   - `FUN_14073f6a0(lVar3, param_3, param_4)`
   - 这一步负责 field 的几何/profile 权重。
6. 最终判断：
   - `abs(profile_weight * noise_weight) >= 0.0001`

因此可以把局部强度近似理解为：

```text
local_strength ~= profile_weight * noise_weight
```

若再计入资源强度，则：

```text
final_strength ~= resource_yield * profile_weight * noise_weight * other_multipliers
```

### 4. `falloff` / 几何 profile 计算

- `FUN_14073f6a0`
  - 临时命名：`Field_EvaluateSpatialProfile`

逻辑：

- 若 `param_1 + 0x2b8..0x2d8` 两组范围/容器都为空，则直接返回 `1.0`
- 否则先检查 `param_1 + 0x2b0` 这个 profile 对象是否启用
- 启用时调用：
  - `FUN_14093bd40(param_1 + 0x2b0, param_1 + 0x390, param_1 + 0x3c0, param_2, param_3)`

这说明：

- XML 里的 `<falloff><lateral>...<radial>...</falloff>` 更可能对应这里的 profile 计算
- 若 field 没有额外 profile 数据，几何权重默认就是 `1.0`
- 否则根据局部坐标、边界、profile 曲线返回一个几何权重

对于 cylinder 示例：

```xml
<boundary class="cylinder">
  <position y="-5000"/>
  <size r="20000" linear="10000"/>
</boundary>
<falloff>...</falloff>
```

当前最合理的理解是：

- `radial` 对应圆柱横截面半径归一化：
  - `sqrt(x'^2 + z'^2) / r`
- `lateral` 对应圆柱轴向位置归一化：
  - `abs(y') / linear`

其中 `x'/y'/z'` 是点先平移到 boundary 中心，再按 field 旋转变换后的局部坐标。

### 5. `noise` 计算主函数

- `FUN_1414f4840`
  - 这是 noise/voxel 求值主函数

从当前已追到的路径看，它不是连续解析积分，而是：

1. 把查询盒 `(min/max)` 转成局部归一化 voxel 范围
2. 对 `floor(min)` 到 `ceil(max)` 覆盖到的整数 cell 做遍历
3. 若覆盖 cell 数较小（`< 0x11`），走精细路径
4. 对每个 cell：
   - 用 `FUN_1414f4290(...)` 取 8 个角点值
   - 在 cell 内做三线性插值
   - 对查询盒与 cell 的重叠部分做裁剪和权重累计
5. 累加得到 `noise_weight`

因此它更接近：

```text
noise_weight ≈ 对查询盒覆盖到的离散 voxel 做三线性插值并累加贡献
```

而不是：

- 单点直接查随机数
- 或连续闭式积分

### 6. 8 个角点值如何生成

- `FUN_1414f4290`

这函数不是从地图里直接读 8 个角点值，而是在 field 内部的 1024 float 随机表上做哈希取样。

对于整数坐标 `(x, y, z)`，它会：

1. 对每个轴单独做：
   - 乘 `0.6180339`
   - 取小数部分
   - 再乘不同常数：
     - `173`
     - `263`
     - `337`
2. 将三个轴结果组合：

```text
index = (hx + hy + hz) & 0x3ff
```

3. 从 `param_1` 指向的 1024 float 表取值

于是 8 个角点：

- `(x,y,z)`
- `(x+1,y,z)`
- `(x,y+1,z)`
- `(x+1,y+1,z)`
- `(x,y,z+1)`
- `(x+1,y,z+1)`
- `(x,y+1,z+1)`
- `(x+1,y+1,z+1)`

### 7. boundary RTTI / COL / vfptr 映射

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

各自都会通过这个 hash 流程得到一个 `0~1` 左右的角点值。

因此这更像：

- 3D value noise
- 基于 hash + 1024 长度固定随机表
- 再通过三线性插值变成空间平滑的 noise field

### 7. 对 `64k` 查询块的统一理解

这也是前面多次出现 `64000.0` 的原因。

不应把系统理解为“对某个单点求值”，而应理解为：

- 以 `64k` 为粒度的查询块/area
- 游戏对这个查询盒与资源场的重叠做离散近似累计

近似形式可以写成：

```text
cell_value ≈ ∫_{cell ∩ field} [falloff_profile(x) * noise(x)] dV
```

实现上不是连续解析积分，而是：

```text
for each overlapped voxel:
    sample 8 corner values
    trilinear interpolate
    clip query box against voxel
    accumulate contribution
```

因此：

- 单点查询可以看作极小 query box 的极限
- `64k` area 则是实际运行态/存档层的有限体积累计结果

这也解释了：

- 一个 `64k` 方块的中心点在资源场外，仍可能因为边缘部分与资源场重叠而得到非零结果
- 存档里的 `area.max` 更像局部体积累计/容量上限，而不是单点值

---

## 六、目前能更明确回答的问题

### 1. 资源是否遍布整个 sector？

当前可以较有把握地说：

- 不是一个连续均匀铺满整个 sector 的场
- 它是：
  - `ResourceField` 几何/profile 权重
  - 乘上离散 value-noise 场
  - 再经过阈值裁剪
 形成的稀疏空间分布

因此：

- 在 region/boundary 内也不是“处处有资源”
- 是否有资源取决于 `profile_weight * noise_weight` 是否足够大

### 2. `falloff` 控制什么？

`falloff` 更像是：

- 场的几何包络/空间 profile
- 控制某个点在场内部“理论上应该有多强”

例如 cylinder 示例中：

- `lateral`
  - 更像轴向方向的权重
- `radial`
  - 更像横截面半径方向的权重

它不负责制造“斑块感”，斑块感主要来自 noise。

### 3. `noise` 控制什么？

`noise` 可以近似看成一个局部 `0~1` 的乘子，但更准确地说它是：

- 离散 grid 上由 hash + 1024 长度随机表生成的 3D value noise
- 再经三线性插值变成连续平滑的权重场

最终：

```text
local_strength ≈ falloff_profile * noise_weight
```

### 4. 总量如何理解？

若关心总量或平均值，可以近似认为：

```text
total ≈ ∫_{boundary} [falloff_profile(x) * noise(x) * base_density/yield] dV
```

工程上可进一步简化为：

```text
total ≈ volume(boundary) * mean(falloff * noise) * base_density
```

这不是严格等式，但对“平均总量估算”是合理近似。

---

## 七、当前剩余未钉死的问题

1. `FUN_14093bd40(...)`
   - 仍需继续确认 `lateral/radial` 的精确几何定义和组合方式
2. `ResourceField` 还有哪些虚函数参与：
   - 从 field/value function 离散到 octree node / `64k area.max`
3. `regionyields` 中的 `value_a/value_b`
   - 与最终 `yield` / `time` / 其他倍率的精确字段映射仍可继续细化

---

## 八、当前最实用的工作结论

如果只想建立近似模型，当前可以先采用：

```text
cell_or_area_value
  ≈ base_yield_or_density
    * ∫_{query_box ∩ boundary}
        [falloff_profile(local_pos) * value_noise(local_pos)]
      dV
```

其中：

- `boundary`
  - 来自 region/field 几何定义，例如 cylinder/sphere/box
- `falloff_profile`
  - 来自 XML `falloff -> lateral/radial`
- `value_noise`
  - 来自 `seed/noisescale/minnoisevalue/maxnoisevalue` + 1024 float 随机表
- `query_box`
  - 在运行时常对应 `64k` area

这已经能较好解释：

- 为什么资源不会均匀铺满整个 region
- 为什么 `64k area.max` 更像体积累计结果

### 9. `FUN_1407603f0` / `FUN_140760320` 的值语义分工

继续下钻查询聚合函数后，可以把两条运行态值链进一步区分：

- `FUN_1407603f0(tree, key, tls_ctx)`
  - 在 key tree 中找到目标 key。
  - 遍历该 key 下挂的运行态资源对象链表。
  - 对每个对象：
    - 先调用 `obj + 0x10` 上基础接口的 `vfunc(+0x8)` 做准备/同步。
    - 再通过 adjustor/meta 计算出“最终值接口对象”。
    - 调用该接口的 `vfunc(+0x28)`，并把返回值累加。
  - 因此：
    - `FUN_1407603f0` = 主值聚合函数。
    - 主值来源 = 最终值接口 `slot +0x28`。

- `FUN_140760320(tree, key)`
  - 同样遍历该 key 下的对象链表。
  - 但它把 `obj + 0x10` 上基础接口 `vfunc(+0x8)` 的返回值累加起来。
  - 深层值接口 `vfunc(+0x28)` 也会被调用，但其返回值被丢弃。
  - 因此：
    - `FUN_140760320` = 辅助/基础值聚合函数。
    - 更像“基础对象量 / 基础矿点量 / 次级统计值”。

- `FUN_14075dad0`
  - 明确以：
    - `max_a = max(max_a, FUN_1407603f0(...))`
    - `max_b = max(max_b, FUN_140760320(...))`
  - 维护两个最大值。
  - 这进一步支持：
    - `FUN_1407603f0` 那一支就是查询主值通道，最像 `area.max` / 主资源值。
    - `FUN_140760320` 是辅助统计维度。

### 10. `FUN_1407605d0` 再次验证主值接口

`FUN_1407605d0` 在导出 `(key, value)` 时，会直接通过对象的深层 adjustor/meta 接口调用：

```asm
MOV RAX, qword ptr [RDI + 0x28]
MOVSXD RCX, dword ptr [RAX + 0x4]
ADD RCX, 0x28
ADD RCX, RDI
MOV RAX, qword ptr [RCX]
CALL qword ptr [RAX + 0x28]
```

这与 `FUN_1407603f0` 的“最终值接口 `slot +0x28`”本质一致。

说明：

- `FUN_1407603f0` 的主值聚合
- `FUN_1407605d0` 的 mineables/value 导出

都共享同一条最终值接口链。

这可以强烈支持：

- `slot +0x28` 返回的就是运行态主资源值；
- `area.max` / query 主值 / 导出值三者极可能共用这一数值来源。

### 11. `ResourceField` 数值函数：`FUN_140e84170`

`FUN_140e84170` 已经不再是布尔“是否命中”函数，而是一个真正返回整数值的函数。其行为很像：

- `ResourceField_EvaluateAmountAtQuery`
- 或“单个 field 对一个 `64k area` 的数值贡献”

核心流程：

1. 取 field 的局部变换，把查询位置/盒子变到局部空间。
2. 调 `vfunc(+0xa0)` 取一个基础倍率。
3. 调 `FUN_1400b7620(param_1, &local_78, tls_ctx)` 取局部 noise/occupancy 权重。
4. 调 `FUN_14073f750(...)` 取 boundary/falloff 对当前 `64k area` 的几何权重。
5. 将这些结果相乘，最后转成 `int` 返回。

因此，对单个 field、单个 `64k area`，已经可以写成近似形式：

```text
single_field_contribution(area)
≈ int(
    BaseFactor(field)
  * LocalNoiseOrOccupancy(field, area)
  * BoundaryFalloffWeight(field, area)
)
```

后续 `FUN_1407603f0` 再把同一 key 下多个运行态对象的该值求和。

### 12. `FUN_14073f750`：boundary/falloff 按 `64k area` 参与

`FUN_14073f750` 不是简单的单点 falloff 求值，而是：

- 把查询位置映射到 `64k` 网格：
  - 代码中出现 `1 / 64000 = 1.5625e-05`
  - 再做 `coord / 64000 + 0.5`、取整、回到 `grid * 64000`
- 基于当前 `64k area` 构造局部 box
- 与 field 的 boundary/profile 做包围盒/局部关系判断
- 若相交，再通过 profile 接口更新当前 `area` 的 falloff 权重

这说明：

- boundary/falloff 不是只对“单点”生效；
- 它在运行态里是按 `64k area` 粒度参与的；
- `max` 计算确实已经在 area 粒度上做近似数值求值，而不是简单中心点判定。

### 13. `FUN_1400b7620`：noise window 与 occupancy 权重

`FUN_1400b7620` 的角色可以明确成：

- 对当前局部坐标/`64k area` 取一个连续 noise 值；
- 用 `minnoisevalue / maxnoisevalue` 做窗口裁剪；
- 在窗口边缘两侧各做 `10%` 软过渡；
- 再乘一个更深层的 profile/value-source 结果。

其关键字段映射：

- `param_1 + 0x10d4`
  - `noisescale`
- `param_1 + 0x10e0`
  - `minnoisevalue`
- `param_1 + 0x10e4`
  - `maxnoisevalue`
- `FUN_1414f4630(param_1 + 0xd4, ...)`
  - 连续 3D value noise 取样

因此：

```text
LocalNoiseOrOccupancy
≈ NoiseWindow( sample_noise(local_pos / noisescale), minnoise, maxnoise )
 * deeper_profile_factor
```

这也说明：

- `seed / noisescale / minnoisevalue / maxnoisevalue`
  确实直接参与了 `max` 的 area 级求值；
- 它们不只是视觉参数。

### 14. `FUN_140e83900`：profile/value-source 曲线层

`FUN_140e83900` 进一步说明，`max` 并不是单纯的：

```text
density * falloff * noise
```

而是在 noise/falloff 之外，还有一层更深的 profile/value-source 曲线：

- 如果没有 `param_1 + 0x10f0` 指向的对象，直接返回 `param_1 + 0x10f8` 的默认值。
- 否则：
  - 先从 noise 场中取一个连续 noise 值；
  - 用 `param_1 + 0x1100` 作为 noise 振幅，对 profile 输入做偏移；
  - 最终把构造出的输入参数送进一个 `vfunc(+0x28)` profile/value-source 接口。

因此可以写成：

```text
deeper_profile_factor
≈ EnvelopeProfile( adjusted_input )
```

其中：

```text
adjusted_input
≈ input
 - noiseAmplitude * noise(local_pos)
 - optionalDistanceBias
 - optionalOffset
```

这表明：

- `max` 不是简单线性函数；
- 它内部很可能还经过一条 envelope/ramp/value-source 曲线。

### 15. `FieldBase_Init` 中的关键字段映射

在 `FUN_140e80d20`（共享 `Field` 初始化函数）里，已经可以把若干关键偏移和 XML 来源对应起来：

| 字段偏移 | 作用推断 | 初始化来源 |
|---|---|---|
| `param_1 + 0x10d4` | `noisescale` | `FUN_140108c70(param_3, 0x4d, param_4)` |
| `param_1 + 0x10e4` | `maxnoisevalue` | `FUN_140108c70(param_3, 0x40, param_7)` |
| `param_1 + 0x10ec` | 额外 float 参数（可能颜色/显示相关附加参数） | child type `0x10` 中的 attr `0x8c` |
| `param_1 + 0x10f0` | `EnvelopeProfile` / `ValueSource` 对象 | child type `0x58` 构造 |
| `param_1 + 0x10f8` | profile 缺失时的默认值，默认 `1.0f` | `FUN_140108c70(param_3, 0x15, 1.0f)` |
| `param_1 + 0x1100` | noise 振幅 / 扰动强度 | `FUN_140449fd0(param_3, 0x7f, 0)` |

其中最关键的是：

- `+0x10f0`：真正承载 profile/value-source 曲线的对象；
- `+0x10f8`：无 profile 时的默认常量值；
- `+0x1100`：让 noise 直接进入 profile 输入的振幅。

### 16. 当前可用的 area.max 近似模型

在允许较大近似误差（例如 `50%` 以内）时，可以先将当前已逆出的 area 级 `max` 生成链压缩为：

```text
area.max_like_value
≈ sum over matching runtime resource objects (
    BaseFactor
  * MeanNoiseWindow
  * MeanEnvelopeProfile
  * MeanBoundaryFalloff
)
```

而如果转到 region 总量层面：

```text
Total(region, ware)
≈ Volume(boundary)
 * MeanFalloff
 * MeanNoiseWindow
 * MeanEnvelopeProfile
 * BaseDensityOrYield
 * GlobalWareFactor
```

说明：

- 这里的 `MeanNoiseWindow`
  - 由 `seed / noisescale / minnoisevalue / maxnoisevalue` 主导
- `MeanEnvelopeProfile`
  - 由 `+0x10f0 / +0x10f8 / +0x1100` 这条 profile/value-source 曲线主导
- `MeanBoundaryFalloff`
  - 由 `FUN_14073f750` 对 `64k area` 的几何裁剪与 falloff 计算主导

在目前阶段，这个模型已经足够解释：

- 为什么 `max` 不是简单常量；
- 为什么它明显依赖 `64k area` 粒度；
- 为什么 `noise`、`falloff`、`EnvelopeProfile` 都会共同参与最终主值。

## 六、RTTI / vftable 关键定位点备忘

下面这批 RTTI / `vftable` 位置都值得保留，后续继续追：

### 1. `U::Regions::ResourceField`

- `RTTI_Type_Descriptor`
  - `143318728`
- `TypeDescriptor.name`
  - `143318738` = `".?AVResourceField@Regions@U@@"`
- `vftable_meta_ptr`
  - `142d075a0`
- `vftable`
  - `142d075b0`

已确认与之直接相关的关键函数：

- `FUN_140e83d30`
  - `ResourceField` 构造/初始化函数
- `FUN_140e83ff0`
  - `ResourceField` 对 query volume 的布尔判定函数
- `FUN_140e84170`
  - `ResourceField` 对单个 `64k area` 的数值贡献函数

### 2. `U::Regions::AsteroidField`

- `RTTI_Type_Descriptor`
  - `143318848`
- `TypeDescriptor.name`
  - `143318858` = `".?AVAsteroidField@Regions@U@@"`
- `vftable_meta_ptr`
  - `142d07e60`

说明：

- 当前已经锁到 `AsteroidField::vftable_meta_ptr`。
- 下一步应继续从这里向下查看，拿到：
  - `const U::Regions::AsteroidField::vftable`
- 然后贴出前 `15~20` 个虚函数项，与 `ResourceField` 对比。

### 3. `U::Regions::DebrisField`

- 已在 `AsteroidField` 邻近区域看到：
  - `U::Regions::DebrisField::vftable`
  - `142d07c38`

说明：

- `DebrisField`、`ResourceField`、`AsteroidField` 这几类 `Regions::*Field` 的 RTTI / vftable 很可能在同一片内存区域成簇分布。
- 这一整片区域都值得保留，后续用于：
  - 对比不同 field 类型是否共享 `Field` 基类逻辑
  - 对比固体/气体/残骸场在 `max` 生成链上的分流点

### 4. 建议后续记录方式

后面只要继续看到新的 `Regions::*Field` 类，建议都按同样格式补记：

- `RTTI_Type_Descriptor`
- `TypeDescriptor.name`
- `vftable_meta_ptr`
- `vftable`
- 与其直接相关的构造/判定/数值函数

这样后续在 Ghidra 里回跳会快很多，也方便统一比较：

- `ResourceField`
- `AsteroidField`
- `DebrisField`
- 其他 `Regions::*Field`

## 七、AsteroidField 进度补充

当前已经把 `U::Regions::AsteroidField` 的 RTTI / vftable 定位出来，并确认：

- `AsteroidField` 与 `ResourceField` 共享一部分 `Field` 基类逻辑；
- 但在若干关键槽位上改写了 asteroid-specific 的“单 area 贡献值”与倍率逻辑；
- 因此固体资源不是完全脱离 `64k area` 的独立系统，而是：
  - 共享 `64k area`
  - 共享 noise
  - 共享 boundary / falloff
- 额外叠加 asteroid-specific 系数与全局倍率表

### 0. 关于 region noise 与 asteroid noise：代码确认是“继承/覆盖”，不是两套并行参与

这里按代码证据明确记录，避免把 XML / XSD 的语义误读成“双重 noise 同时乘上”。

共享初始化 `FUN_140e80d20(...)` 对当前 field 对象写 noise 参数时，用的模式是：

```c
value = FUN_140108c70(current_field_xml_node, attr_id, inherited_default);
write_to_current_field(value);
```

已确认的几个字段：

- `+0x10d4`
  - `FUN_140108c70(param_3, 0x4d, param_4)`
- `+0x10e0/+0x10e4`
  - `FUN_140108c70(param_3, ..., inherited_default)`
- seed / noise table
  - 也是先落到当前 field 对象，再初始化 `+0xd4` 那张随机表

因此，运行时可确认的关系是：

```text
resolved_noise(field)
= field 上显式属性（若存在）
  否则继承上层默认值
```

而在 `FUN_140e84c30(...)` 中，asteroid area contribution 只读取：

- 当前对象的 `+0x10d4`
- 当前对象的 `+0xd4` noise table

没有看到“region noise 再算一遍、asteroid noise 再算一遍，然后两者相乘”的逻辑。

所以按当前代码，正确表述应为：

```text
运行时每个 AsteroidField 只有一套最终已解析的 noise 参数。
region 层提供默认值；
asteroid field 层可覆盖这些默认值；
最终 contribution 只使用当前对象上的这一套 resolved noise。
```

### 1. RTTI / vftable 关键定位

- `RTTI_Type_Descriptor`
  - `143318848`
- `TypeDescriptor.name`
  - `143318858` = `".?AVAsteroidField@Regions@U@@"`
- `vftable_meta_ptr`
  - `142d07e60`
- `vftable`
  - `142d07e68`

### 2. 与 `ResourceField` 的关键对位

在 `AsteroidField::vftable` 中：

- `[61] = FUN_140e83ff0`
  - 与 `ResourceField` 共用同一个布尔判定函数
  - 说明二者共用一部分 query-volume 判定 / `Field` 基类逻辑

- `[62] = FUN_140e84c30`
  - 对位 `ResourceField` 的 `FUN_140e84170`
  - 这是 `AsteroidField` 的单 `64k area` 数值贡献函数

因此可以明确：

- 固体资源不是完全另一套“绕开 area”的算法；
- 它也在 `64k area` 粒度上求贡献；
- 但具体贡献值函数在 `AsteroidField` 这一槽位上已经改写成 asteroid-specific 实现。

### 3. `FUN_140e84c30`：AsteroidField 的单 area 贡献函数

`FUN_140e84c30` 的返回值是若干因子的乘积后取整。

核心结构：

```text
AsteroidContribution(area)
≈ ProfileA
 * ProfileB
 * NoiseIntegral
 * FieldScalar
 * FalloffWeight
 * ClampOrScaleFactor
```

当前已确认它直接调用/使用：

- `FUN_1414f4840((longlong)param_1 + 0xd4, ...)`
  - `64k area` 对 noise / value field 的体积采样
- `FUN_14073f750(param_1[2], param_2, param_3, 0)`
  - boundary / falloff 对当前 `64k area` 的几何权重
- `*(float *)(param_1 + 0x232)`
  - asteroid-specific 裸字段，直接乘进结果
- `(**(code **)(*param_1 + 0x1b8))(param_1)`
  - asteroid-specific 虚函数槽位
- `(**(code **)(*param_1 + 0x98))(param_1)`
  - 另一条 asteroid-specific 虚函数槽位
- `FUN_14093c2c0(param_1[2] + 0x2b0)`
  - 经 `* 1e-09` 与上限裁剪后作为附加乘子进入结果

结论：

- `AsteroidField` 的最终贡献值明确依赖：
  - noise
  - falloff
  - `64k area`
  - 以及 asteroid-specific 字段/倍率

### 4. `FUN_140e81620`：Field 工厂分派

`FUN_140e81620` 已确认是 `Regions::*Field` 的工厂/分派函数：

- `case 8`
  - 分配 `0x11b0`
  - 调 `FUN_140e842e0(...)`
  - 写 `U::Regions::AsteroidField::vftable`

因此：

- `FUN_140e842e0`
  - 就是 `AsteroidField` 的真正初始化函数

### 5. `FUN_140e842e0`：AsteroidField 初始化与字段来源

`FUN_140e842e0` 初始化了多个 asteroid-specific 字段，其中部分已经能确认直接参与最终贡献。

#### 已锁定的关键偏移

因为这里 `param_1` 是 `undefined8 *`：

- `param_1[0x22a]`
  - 字节偏移 `0x1150`
- `param_1[0x22b]`
  - 字节偏移 `0x1158`
- `param_1[0x223]`
  - 字节偏移 `0x1118`

#### 当前已知字段映射

| 字段偏移 | 反编译位置 | 初始化来源 | 当前语义推断 | 是否已确认参与贡献 |
|---|---|---|---|---|
| `+0x1118` | `param_1[0x223]` | `FUN_140108c70(param_3, 0x96, 0)` | `yield` | 是 |
| `+0x1150` | `param_1[0x22a]` | `FUN_140108c70(param_3, 0x19, 1.0f) * param_6 * 0.01` | `densityfactor * inherited_base_density_scaled` | 是 |
| `+0x1158` | `param_1[0x22b]` | `param_5` 或本地 `attr 0x61` | `ref` 对应对象/key 来源 | 是 |
| `+0x1190` | `param_1[0x232]` | `FUN_140106340(param_3, 0x67, 100) * 0.01` | `resourcepercentage` 风格直接乘子 | 是 |
| `+0x1194` | `param_1 + 0x1194` | `FUN_140108c70(param_3, 0x97, 0)` | `yieldvariation` | 间接/待继续确认 |
| `+0x1164` | `param_1 + 0x1164` | `FUN_140108c70(param_3, 0x48, 0)` | asteroid-specific 参数 | 未确认 |
| `+0x116c` | `param_1 + 0x116c` | `FUN_140108c70(param_3, 0x6b, 0) * 0.017453292` | 角度/旋转相关参数 | 未确认 |
| `+0x22c` | `param_1[0x22c]` | `FUN_140108c70(param_3, 0x47, 1.0f) * param_7` | asteroid-specific scalar | 未确认 |
| `+0x22d` | `param_1[0x22d]` | `FUN_140108c70(param_3, 0x6a, 1.0f) * param_8` | asteroid-specific scalar | 未确认 |
| `+0x233` | `param_1[0x233]` | `FUN_140101df0(param_3, 0x0e)` | bool flag | 未确认 |

#### `RegionXML` 静态注册表已直接对出关键 attr id

`FUN_140eb41d0` 会初始化 `"RegionXML"`，并从静态表 `DAT_142675a58` 批量注册属性名与 id。
该表布局可直接读成：

```text
ptr64_to_name + attr_id32 + pad32
```

直接读取该表得到以下代码证据：

- `0x19 -> densityfactor`
  - `0x142675be0 : ptr 0x142af76d8, id 0x19`
  - `0x142af76d8 = "densityfactor"`
- `0x61 -> ref`
  - `0x142676060 : ptr 0x142ac7ad0, id 0x61`
  - `0x142ac7ad0 = "ref"`
- `0x67 -> resourcepercentage`
  - `0x1426760c0 : ptr 0x142af7ee8, id 0x67`
  - `0x142af7ee8 = "resourcepercentage"`
- `0x2b -> groupref`
  - `0x142675d00 : ptr 0x142af7d98, id 0x2b`
  - `0x142af7d98 = "groupref"`

因此，前面对 `0x61` 的旧猜测需要按代码修正：

- `0x61` 不是 `groupref`，而是 `ref`
- `groupref` 的 id 是 `0x2b`

说明：

- `+0x1118`
  - 已通过 `FUN_140e803e0` 确认直接参与乘法
- `+0x1150`
  - 已通过 `FUN_140e80300` 确认直接参与乘法
- `+0x1158`
  - 已通过 `FUN_140e80300` 确认用于决定查哪一类全局倍率
- `+0x1190`
  - 已通过 `FUN_140e84c30` 确认直接参与乘法

### 6. `FUN_140e80300`：Asteroid-specific 乘子 A

`FUN_140e80300` 对应 `AsteroidField::vtable[55]`，也就是：

- `slot +0x1b8`

其行为：

1. 读取：
   - `*(float *)(param_1 + 0x1150)`
   - `*(longlong *)(param_1 + 0x1158)`
2. 从 `+0x1158` 对应对象中解析出一个 `class/type id`
3. 去全局树 `DAT_143df3f88 + 0xf0/+0xf8` 查一个 float multiplier
4. 返回：

```text
field_1150 * class_multiplier
```

这说明：

- `+0x1150`
  是 asteroid contribution 的直接裸乘子；
- `+0x1158`
  则是决定查哪个 class/type multiplier 的关键来源。

### 7. `FUN_140e803e0`：Asteroid-specific 乘子 B

`FUN_140e803e0` 对应 `AsteroidField::vtable[19]`，也就是：

- `slot +0x98`

其行为：

1. 读取：
   - `*(ulonglong *)(param_1 + 0x1110)`
   - `*(float *)(param_1 + 0x1118)`
2. 分别去两张按 `ware` 查值的全局树：
   - `DAT_143df3f88 + 0x130/+0x138`
     - 对应 `universeyielddensities`
   - `DAT_143df3f88 + 0x170/+0x178`
     - 对应 `universeobjectyielddensities`
3. 返回：

```text
lookup(universeyielddensities, ware_key)
 * field_1118
 * lookup(universeobjectyielddensities, ware_key)
```

说明：

- `+0x1118` 是当前 field 的 `yield`；其默认基础值来自：
  - `regionyields[ware][yield_tag].resourcedensity`
- `+0x1110` 是查两张 Universe 级覆盖表的 `ware` key。

如果把“默认无自定义 gamestart 覆盖”的情形单独拿出来，那么：

```text
MultiplierB
= regionyields[ware][yield_tag].resourcedensity
```

因为 `universeyielddensities(ware)` 与 `universeobjectyielddensities(ware)` 在无用户自定义时都可按单位乘子 `1` 处理。

### 8. 当前阶段可确认的 asteroid 贡献模型

对单个 `AsteroidField`、单个 `64k area`，可以先写成：

```text
AsteroidContribution(area)
≈ NoiseIntegral(area)
 * FalloffWeight(area)
 * Scalar_0x1190
 * MultiplierA(0x1150, 0x1158)
 * MultiplierB(0x1110, 0x1118)
 * ClampFactor(param_1[2] + 0x2b0)
```

其中：

- `NoiseIntegral(area)`
  - `FUN_1414f4840(...)`
- `FalloffWeight(area)`
  - `FUN_14073f750(...)`
- `Scalar_0x1190`
  - `attr id 0x67`
- `MultiplierA`
  - `FUN_140e80300`
- `MultiplierB`
  - `FUN_140e803e0`
- `ClampFactor`
  - `FUN_14093c2c0(...) * 1e-09` 再上限裁剪

### 9. 当前阶段对“固体 vs 气体”的更新判断

截至目前可以比前文更精确地说：

- `AsteroidField` 并没有绕开 `64k area`
- 它同样在 `64k area` 粒度上求值
- 也同样复用了：
  - noise
  - boundary / falloff
  - 局部坐标变换
- 但它会额外乘入 asteroid/group/type 相关的多个裸字段与全局倍率表

因此当前更合理的判断是：

- 固体与气体 **不是“一个整块算、一个体积算”的完全二分**
- 二者共享 area/noise/falloff 基础框架
- 真正的差异主要来自：
  - `AsteroidField` 特有的额外乘子和全局表
  - 以及后续是否还存在 asteroid object/mining-node 层的离散化逻辑

### 10. `FUN_140339d40`：`AsteroidField` 后续确实会生成 mining node 实体

已经确认：

- `FUN_140339d40` 会在一轮候选生成与去重之后，逐个调用：

```c
FUN_140467110(DAT_143df3f88, &local_res10, param_1, uVar14, uVar14, lVar7, plVar23);
```

- 如果失败，会打印：

```text
"Could not create mining node with macro '%s' on asteroid with macro '%s'"
```

这说明固体资源链在 `AsteroidField` 的 `64k area` 贡献之后，确实还会进入：

- candidate 生成
- candidate 去重/合并
- mining node / asteroid 实体化

也就是说：

- `AsteroidField area contribution` 不是固体资源链的终点；
- 固体资源比气体多了一层明确的实体化流程。

### 11. `FUN_140467110`：mining node 创建包装器

`FUN_140467110(...)` 本身不是 amount 公式，而是：

- 做输入合法性检查
- 找模板 / 宏 / 连接对象
- 调 `FUN_1408aa6d0(...)` 真正创建 Universe 对象
- 再做一层 `vfunc(+0x1170)` 的类型/状态校验

因此：

- `FUN_140467110` 是 solid 资源从 candidate 落到实体的创建包装层；
- 真正的对象实例化和后续挂接逻辑在 `FUN_1408aa6d0` 及其下游。

### 12. `FUN_1408aa6d0`：通用 Universe 对象工厂，`case 4` 创建 `U::Asteroid`

`FUN_1408aa6d0(...)` 会根据 `param_7` 的类型 id 分派创建不同 Universe 对象。

已确认：

- `case 4`：
  - 分配 `0x470` 大小对象
  - 调 `FUN_140699630(...)`
  - 写 `U::Asteroid::vftable`

所以：

- 这条链里不仅会创建 mining node；
- 也会创建真正的 `U::Asteroid` 实体。

### 13. `FUN_140699630` / `FUN_140699720`：`U::Asteroid` 基础构造与宏数据同步

- `FUN_140699630`
  - 主要是 `U::Object` 层初始化与清零
  - 然后调 `FUN_140699720`

- `FUN_140699720`
  - 从 `FUN_14077df00(param_1[0xc])` 返回的宏数据里同步若干 asteroid 配置字段
  - 做字符串/标志/基础状态初始化
  - 调 asteroid 自身的虚函数：
    - `vfunc(+0x15b8)`
    - `vfunc(+0x1608)`

目前这层还未直接出现 ore amount 写入。

### 14. ore amount 容器：`MiningNode` 与 `Asteroid` 各自都有独立 ware-amount list

通过负值清洗逻辑已经确认：

- `FUN_140337150`
  - 导入 `MiningNode`
  - 读 `param_1 + 0x300`
  - `param_1 + 0x328` 会被清零后再重新装载容器
  - 若最小值为负则清零并报：
    - `"Imported mining node has negative ore amount! ..."`

- `FUN_1403383d0`
  - 导入 `Asteroid`
  - 读 `param_1 + 0x430`
  - `param_1 + 0x458` 会被清零后再重新装载容器
  - 若最小值为负则清零并报：
    - `"Imported asteroid has negative ore amount! ..."`

因此：

- `MiningNode` 的 ware amount list 容器起点在 `+0x300`
- `Asteroid` 的 ware amount list 容器起点在 `+0x430`

进一步结合：

- `FUN_140100010(dst, src)` 最后只更新 `dst[5] = src[5]`
- `FUN_140337c60(param_1) { return param_1 + 0x300; }`
- `FUN_140337020` 析构时会按 `param_1 + 0x300` 和 `param_1 + 0x320` 的容器布局释放

现在可以把这个容器布局更准确地写成：

```text
MiningNode amount-list container:
  +0x300 = container base
  +0x320 = container[4] (inline/external storage mode)
  +0x328 = container[5] (entry count / length)

Asteroid amount-list container:
  +0x430 = container base
  +0x450 = container[4] (inline/external storage mode)
  +0x458 = container[5] (entry count / length)
```

也就是说，`+0x328 / +0x458` 不是“独立 cache 字段”，而是 amount-list 容器自身的一部分。

### 15. `FUN_1408bb5d0`：ware amount list 的底层数学

`FUN_1408bb5d0(container, key, amount, capacity_hint)` 已确认 amount 容器是：

- `key -> signed int amount`

的哈希表/线性表。

行为：

- `key != 0 && amount != 0` 才处理
- 若 key 已存在：
  - 新 amount = 旧 amount + `param_3`
  - 若结果为 0，则删条目
- 若 key 不存在：
  - 追加新条目

也就是说：

```text
AmountList[key] += delta
```

### 16. `FUN_14044ce00` / `FUN_14044ced0`：对 ware amount list 的整除与缩放

#### `FUN_14044ce00(src, dst, N)`

- 先复制 `src -> dst`
- 再对每个条目做：

```text
dst[key] = floor(src[key] / N)
```

如果 `N == 0` 会报错 `"Ware amount list division by 0"`。

#### `FUN_14044ced0(src, dst, factor)`

- 若 `factor` 非零：
  - 先复制 `src -> dst`
  - 再对每个条目做：

```text
dst[key] = floor(src[key] * factor)
```

- 若 `factor` 判定为零：
  - `dst` 置空

所以现在已经能把这两类数学操作明确定义为：

- **整除分摊**
- **比例缩放**

### 17. `FUN_140337c70`：把父级 ware list 平均分配给 asteroid 子实体

`FUN_140337c70(...)` 中最关键的一段是：

```c
FUN_14044ce00(param_1 + 0x60, &local_158, pcVar15);
...
FUN_140100010(*param_2 + 0x430, &local_158);
```

含义：

- 父级对象的 ware amount list 在 `param_1 + 0x60`
- `pcVar15` 是满足条件的 asteroid 子实体个数
- 先把父级 list 按 `pcVar15` 整除
- 再把这个平均分配结果写入每个子 asteroid 的 `+0x430`

所以这一层公式非常明确：

```text
ChildAsteroidAmountList = floor(ParentAmountList / NumEligibleAsteroids)
```

### 18. `FUN_140338d90`：更复杂的 asteroid 分裂/重分配逻辑

`FUN_140338d90(...)` 显示：

- 当 asteroid 分裂/重分配到多个子实体时
- 不总是简单平均分
- 会先通过：

```c
FUN_14044ced0(param_1 + 0x430, local_a0, factor)
```

得到按比例缩放后的局部 amount list，

然后再对每个子 asteroid：

- 复制一份临时 list
- 进一步按随机比例 `fVar25` 缩放
- 写入子 asteroid 的 `+0x430`
- 同时把剩余/累计部分继续加回聚合容器

所以这一层可先概括成：

```text
SplitAmountList
≈ Scale(ParentAsteroidAmountList, base_factor)
PerChildAmountList
≈ Scale(SplitAmountList, random_child_factor)
```

其中：

- `Scale(...)` 的数学含义就是 `FUN_14044ced0`
- 具体 `base_factor` / `random_child_factor` 由全局常量、宏参数、RNG 共同决定

### 19. 当前阶段对 solid 链“完整公式”的可观测表达

截至目前，能直接从代码中写出的 solid 资源链是：

#### `AsteroidField` 单 `64k area` 贡献

```text
AsteroidFieldContribution(area)
≈ floor(
    NoiseIntegral(area)
  * FalloffWeight(area)
  * Scalar_0x1190
  * MultiplierA(0x1150, 0x1158)
  * MultiplierB(0x1110, yield)
  * ClampFactor
)
```

补充：

- `+0x1110` 对 `AsteroidField` 来说不是本地 XML 再次读取出来的字段。
- `FUN_140e842e0` 开头会把上层工厂参数继续传给共享初始化 `FUN_140e83d30(...)`。
- 在 `FUN_140e81620(case 8)` 中，这个上层参数就是传给 `FUN_140e842e0(..., param_2, ...)` 的第 4 个参数。
- 因此当前可以明确：

```text
AsteroidField +0x1110
= factory(FUN_140e81620) 传下来的上层 resource/ware key
```

- 也就是说，`MultiplierB(0x1110, yield)` 里的 key 不是 `AsteroidField` 自己解析一遍 XML 得到的，而是更高层 region/resource 构造链 already-resolved 的资源键。

#### mining node / asteroid 实体化层

```text
GeneratedCandidates
≈ RandomSampleAndProject(asteroid geometry / miningnode macro)

MergedCandidateAmountList
≈ SumByHashedKey(ScaledCandidateAmountLists)

MiningNode / Asteroid entities
≈ Instantiate(MergedCandidates)
```

补充：

- `FUN_140339d40` 在 candidate 合并后会继续走实体创建。
- `FUN_140467110(...)` 是创建包装器，真正的对象工厂在 `FUN_1408aa6d0(...)`。
- `FUN_1408aa6d0(case 4)` 明确创建 `U::Asteroid`。
- `FUN_1408aa6d0(case 0x3f)` 明确创建 `U::MiningNode`。

更关键的是，`AsteroidField::vtable[25] = FUN_140e84e40` 已经证明：

- 它会从 `param_1[0x222]` 取 resource/ware key；
- 会从 candidate 结构中取 amount（`param_3 + 0x68`）和附加值（`param_3 + 0x6c`）；
- 然后把这组 key->amount 数据打成 amount list；
- 对 asteroid 实体直接执行：

```text
FUN_140100010(plVar8 + 0x86, &local_1f8)
```

由于 `0x86 * 8 = 0x430`，这已经可以直接写成：

```text
Asteroid +0x430 = amount list(resource_key -> candidate_amount)
```

因此，solid 链里至少有一条已经闭合的桥：

```text
AsteroidFieldContribution / candidate
-> FUN_140e84e40
-> Asteroid +0x430 ware amount list
```

#### asteroid 子实体 ore amount 分摊

```text
ChildAsteroidAmountList
= floor(ParentAmountList / NumEligibleAsteroids)
```

或在分裂/随机重分配场景下：

```text
ChildAsteroidAmountList
≈ floor(ParentAmountList * base_factor * random_child_factor)
```

目前仍未最终锁定的一环主要变成：

- candidate 初始 amount 的直接生产者
- `attr id 0x19 / 0x61 / 0x67` 的直接名字证据

#### `MiningNode +0x300`：运行时 setter 基本锁定

对 `FUN_140339d40` 的反编译与反汇编联合观察表明：

- 它会先生成一批 `0x70` 大小的 candidate；
- 每个 candidate 的 `+0x40` 处都嵌有一份 ware amount list；
- 成功创建实体后，会立刻把 candidate 的这份 amount list 复制到新建对象上。

更具体地说：

- `FUN_140467110(...)` 成功后，返回 `local_res10 = created_object`
- 成功路径里会调用：

```text
FUN_140100010(created_object + 0x300, candidate + 0x40)
```

其中：

- `candidate` 是 `FUN_140339d40` 里构造的 `0x70` 字节结构；
- `candidate + 0x40` 在前面已经通过 `FUN_140100010(local_100, param_1 + 0x430)` 初始化为一份 ware amount list；
- 因而这里已经可以高可信写成：

```text
MiningNode +0x300 = copied candidate ware amount list
```

这意味着 solid 链里现在至少存在两条已经闭合的 amount-list 写入桥：

```text
AsteroidField / candidate
-> FUN_140e84e40
-> Asteroid +0x430

Asteroid +0x430 / candidate +0x40
-> FUN_140339d40(success path)
-> MiningNode +0x300
```

同时，`FUN_140100010(dst, src)` 本身也已经看清：

- 它只负责把一份 amount-list 容器复制到另一份容器；
- 若容量不足会先 `FUN_140102730(...)` 扩容；
- 然后逐项复制 key/value；
- 最后只更新 `dst[5] = src[5]`（项数/长度）。

也就是说：

```text
FUN_140100010 = pure amount-list copy
```

它本身没有看到任何“容器外部 companion cache”的伴随写入逻辑；现在更准确的理解是：

```text
+0x328 = amount-list container 的长度槽位
```

而不是独立缓存。

#### candidate 位置生成函数的角色

`FUN_140339d40` 中用于生成 candidate 变换的 `FUN_1406b48c0(param_1, rng, out_transform)` 也已经初步看清：

- 它沿着 `param_1[0xd]` 链向下找对象；
- 通过若干随机数与矩阵/包围信息构造一个候选位置与姿态；
- 成功时向 `out_transform` 写入一套 4x4/姿态相关数据；
- 失败时返回 0。

这说明：

```text
FUN_1406b48c0 = candidate transform sampler
```

而不是 amount producer。

因此，当前关于 solid 运行时链路的更精确分工是：

```text
FUN_1406b48c0
-> 负责 candidate 的空间位置/姿态

FUN_140100010
-> 负责复制 amount list

FUN_140339d40
-> 负责把“候选位置”和“候选 amount list”组装后落到 MiningNode
```

#### candidate 初始 amount 的当前高优先候选

在 `AsteroidField` 专属虚函数簇里，已经出现一个很像“单对象资源量生成器”的函数：

- `FUN_140e85c10(longlong *param_1, char param_2)`

它做了三件关键的事：

1. 若 `param_2 == 0`，先用 `*(float *)(param_1 + 0x232)` 做一次概率门控：

```text
if (*(float *)(param_1 + 0x232) <= random)
    return 0;
```

2. 调 `vfunc(+0x98)` 取得基础倍率  
   这条链前面已经确认会经过：

```text
MultiplierB(0x1110, yield)
```

3. 再读取 `*(float *)((longlong)param_1 + 0x1194)` 做一次 `yieldvariation` 风格的随机扰动，最后返回 `int`

因此它和当前已知字段的语义高度吻合：

- `+0x1190 / +0x232`：resourcepercentage 风格的概率门控
- `+0x1118`：yield
- `+0x1194`：yieldvariation

所以现在可以把它记为：

```text
FUN_140e85c10
= candidate amount / per-object yield 的高优先候选
```

但当前还缺一条“caller 直接把返回值写进 candidate +0x68”的代码证据，  
因此暂时不能把它写成最终锁死结论。

#### `FUN_140e85c10` 的直接 caller 已定位

后续继续追 `vfunc(+0xa8)` 的调用现场，已在：

- `FUN_140e8ca80`

里拿到直接证据。该函数会生成一类大小为 `0x90` 的 spawn record，并在分配后写入：

```text
+0x78 = FUN_140e85c10(...) 的返回值
+0x7c = FUN_140e83c20(...) 的返回值
+0x80 = companion float
+0x84 = 0
```

对应汇编证据（关键片段）：

```text
CALL qword ptr [field_vtable + 0xa8]   ; = FUN_140e85c10
MOV  dword ptr [RSP + 0x68], EAX
...
alloc 0x90
...
MOV  EAX, dword ptr [RSP + 0x68]
MOV  dword ptr [RCX + 0x78], EAX
MOV  dword ptr [RCX + 0x7c], EBX
MOVSS dword ptr [RCX + 0x80], XMM8
MOV  byte ptr [RCX + 0x84], 0
```

这条链现在可以高可信写成：

```text
FUN_140e85c10
-> 0x90 spawn record +0x78
```

因此，`FUN_140e85c10` 已经不再只是“高优先候选”，而是：

```text
solid spawn record 的直接整数 amount producer
```

#### `FUN_140e83c20` 的角色

`FUN_140e83c20(param_1, out_u32)` 不生成 amount。

它会：

- 读取 `param_1 + 0x10e8..0x10ec` 一组字段
- 若 `+0x10ec > 0`，则做一次随机扰动
- 最终输出一个 `uint`

该值在 `FUN_140e8ca80` 里被写入 spawn record 的 `+0x7c`。

目前更像：

```text
packed visual / variation metadata
```

而不是资源量。

#### `FUN_140e8ca80` / `FUN_140e8fd30`：solid spawn record 生成阶段

`FUN_140e8fd30` 是更上层的 orchestrator。

它会：

- 遍历 cluster / region object buckets
- 对每个条目调用：

```text
FUN_140e8ca80(...)
```

- 然后清理 `local_138` 等临时数组

因此当前可以把这一层总结成：

```text
FUN_140e8fd30
-> 遍历 cluster / object buckets
-> 调 FUN_140e8ca80 生成 0x90 spawn record
```

而 `FUN_140e8ca80` 则负责：

- 做当前 objectfield/asteroid field 的空间筛选
- 调 `vfunc(+0xa8)` 生成单对象整数 amount
- 把 amount / companion metadata / float 参数写进 `0x90` 记录

#### `0x90 spawn record -> FUN_140e84e40` 的桥已经定位

继续往下追后，桥函数已定位到：

- `FUN_140e92e00`

这个函数会在内部搜索 `0x90` spawn record 链表，命中后保存：

```text
local_150 = plVar18 + 2
```

也就是：

```text
param = spawn_record + 0x10
```

随后它调用当前 field 的虚表槽位 `+0xc8`：

```text
(**(code **)(*plVar21 + 200))(plVar21, &local_168, plVar16, plVar18[0x114], 0)
```

这里：

- `200 (dec) = 0xc8`
- `plVar16` 就是前面保存的 `plVar18 + 2`

因此现在可以直接把这条桥写成：

```text
0x90 spawn record
  +0x78 amount
  +0x7c companion u32
  +0x80 companion float

FUN_140e92e00
-> 传递 (spawn_record + 0x10)
-> 调 field vfunc(+0xc8)
-> AsteroidField::vtable[25] = FUN_140e84e40
```

这就精确解释了为什么 `FUN_140e84e40` 读取的是：

```text
param_3 + 0x68
param_3 + 0x6c
```

因为：

```text
(spawn_record + 0x10) + 0x68 = spawn_record + 0x78
(spawn_record + 0x10) + 0x6c = spawn_record + 0x7c
```

所以现在这条链已经完全闭合：

```text
FUN_140e85c10
-> 0x90 spawn record +0x78
-> FUN_140e92e00 传递 spawn_record + 0x10
-> FUN_140e84e40 读取 param_3 + 0x68
-> 写入 Asteroid +0x430 amount list
```

对应的 companion metadata 链则是：

```text
FUN_140e83c20
-> 0x90 spawn record +0x7c
-> FUN_140e92e00 传递 spawn_record + 0x10
-> FUN_140e84e40 读取 param_3 + 0x6c
-> 写入 Asteroid +0x460
```

因此，这一项未决已经消掉。当前不再缺“记录形状转换”的桥。

但 `Asteroid` 侧的 ore amount list 分摊公式已经足够明确。
- 为什么某些 area 会在边缘只有部分资源
- 为什么改 `seed/noisescale/min/max` 会改变资源斑块分布

#### `<resources><resource .../></resources>`：当前只保留已证实代码事实

继续往上追 region 侧逻辑后，`FUN_14073e110` 已经给出几条和 solid 直接相关、但需要严格区分来源树的代码事实。

先纠正一件事：

- `RegionYieldsList_LoadFromXml` (`FUN_140e94470`) 会建立两棵不同的 region-yield 相关结构。
- 其中一棵经 `FUN_140ed8dc0(...)` 解析并插入树；
- 另一棵经 `RegionYieldDef_FromXml(...)` 解析并插入另一棵树。

因此，`FUN_14073e110` 中看到的 `lVar7 + 0x20 / +0x48` 一类偏移，不能在没有继续锁死对象类型之前，直接一概解释成同一个 `RegionYieldDef`。

当前可以严格确认的是：

1. `FUN_14073e110` 会遍历 region 运行时 field 列表 `param_1 + 0x290 .. +0x298`。
2. 它对每个 field 调：

```text
vfunc(+0x1c8) -> ware key
```

在 `AsteroidField` 上，这个虚槽对应：

- `FUN_140e80120`
- 直接返回 `*(undefined8 *)(param_1 + 0x1110)`

所以这里可以确定：

```text
FUN_14073e110` 会按 field 自身的 ware key 把 runtime solid fields 分组
```

3. 在某些路径上，它会对 matching fields 调：

```text
vfunc(+0xa0, 1)
```

并把结果累加。

4. 在后续路径上，它又会对 matching fields 调：

```text
vfunc(+0x28, some_value)
```

并把某个计算结果写回 field。

因此，这条链当前只能按代码写成：

```text
region-level yield/resource 相关运行时数据
-> 按 ware key 找 matching fields
-> 读取 matching field 的 vfunc(+0xa0, 1) 作为某种汇总权重
-> 再通过 vfunc(+0x28, value) 把某个 region-side 结果写回 matching fields
```

现在这条链已经能进一步锁死到 `FUN_140ed8dc0` 那棵树，而不是 long-range-scan 那棵树。

直接代码证据：

- `FUN_14073e110` 在 solid 分配段查的是：

```text
DAT_1477496f8 + 0x8
```

这正对应 `FUN_140e94470` 里第一棵树的根。

- 这棵树的二级节点 payload 是由：

```text
FUN_140ed8dc0(plVar11 + 4, ...)
```

构建的。

- 在 `FUN_14073e110` 中命中二级节点后：

```text
uVar22 = lVar7 + 0x48
fVar46 = (fVar44 * *(float *)(uVar22 + 8)) / sum_weights
```

而对 `FUN_140ed8dc0` 来说：

```text
payload + 0x30 = attr 0x09 = resource density
```

由于这里的 `uVar22` 正好指向该 payload 的 `+0x28` 起点，所以：

```text
*(float *)(uVar22 + 8)
= payload + 0x30
= resource density
```

因此，solid 分配段现在可以按代码更精确地写成：

```text
region yield data (FUN_140ed8dc0 tree)
-> 按 ware key 找 matching solid fields
-> 累加 matching field 的 vfunc(+0xa0, 1) 作为总权重
-> per_field_value = global_multiplier_for_ware * resource_density / sum_weights
-> 对每个 matching field 调 vfunc(+0x28, per_field_value_int)
```

这里真正进入分配公式的 region-side 字段，当前已由代码锁死为：

```text
FUN_140ed8dc0 payload + 0x30 = resource density
```

#### `field->vfunc(+0xa0)`：solid field 报告的权重函数

继续沿 `FUN_14073e110` 往下追到 `AsteroidField` 的对应虚槽后，可以直接确认：

- `vfunc(+0xa0)` 在 `AsteroidField` 上对应：
  - `FUN_140e85b80`

其代码直接返回：

```text
weight
= MultiplierA
 * MultiplierB
 * probability_factor
 * (F(maxnoisevalue) - F(minnoisevalue))
```

对应反编译：

```text
fVar2 = FUN_1414f5870(maxnoisevalue)
fVar3 = FUN_1414f5870(minnoisevalue)
fVar4 = vfunc(+0x1b8)   ; = MultiplierA
fVar5 = vfunc(+0x98)    ; = MultiplierB
return fVar4 * fVar5 * fVar6 * (fVar2 - fVar3)
```

其中：

- `fVar6`
  - 若 `param_2 == 0`，取 `*(float *)(param_1 + 0x232)`
  - 否则取 `1.0`
- `*(float *)(param_1 + 0x232)`
  - 已由代码注册表确认是 `resourcepercentage`

因此，当前可以按代码确认：

```text
vfunc(+0xa0, 1)
= class/resource multiplier
* noise window width
```

这里传入 `param_2 == 1`，所以 `resourcepercentage` 分支不会参与，函数返回的是：

```text
MultiplierA * MultiplierB * (F(maxnoisevalue) - F(minnoisevalue))
```

它是一个和 solid field 资源承载能力强相关的权重函数，但当前还不能越过代码证据，直接把它写成 region-yield 分配的最终比例公式。

#### `field->vfunc(+0x20)`：solid field 接收 region-yield payload 的预初始化

在 `FUN_14073e110` 的同一段里，分配前还会先对 matching field 调：

```text
vfunc(+0x20)(field, payload_ptr, yield_name_string)
```

在 `AsteroidField` 上，这个虚槽对应：

- `FUN_140e83f80`

其代码直接做：

```text
if (field.yield == 0)
    field.yield = param_2[2]

if (field.+0x111c 仍是默认/哨兵)
    field.+0x111c = param_2[0]

if (field.+0x1120 仍未初始化)
    field.+0x1120 = param_2[1]

field.+0x1128 = param_3
```

而这里传入的 `param_2` 就是上面那份指向 `FUN_140ed8dc0` payload `+0x28` 的指针，所以可以直接对齐成：

```text
param_2[0] = payload + 0x28 = attr 0x07
param_2[1] = payload + 0x2c = attr 0x04
param_2[2] = payload + 0x30 = resource density
```

这说明 region-yield-side 数据不是只在最后一步算一个比例，而是会先通过 `vfunc(+0x20)` 把三项 payload 字段灌进 field 本地状态，再通过 `vfunc(+0x28)` 进一步回写最终 `yield/resourcepercentage`。

#### `field->vfunc(+0x28)`：写回 solid field 的本地资源参数

`FUN_14073e110` 中用于写回分配值的 `vfunc(+0x28)`，在 `AsteroidField` 上对应：

- `FUN_140e84990`

它会直接修改当前 field 上两个关键资源字段：

```text
+0x1190 = resourcepercentage
+0x1118 = yield
```

关键代码行为：

1. 先把传入的 `param_2` 写到 `+0x1190`
2. 如果 `param_2 > 1`

```text
resourcepercentage = 1
yield *= param_2
```

3. 否则在另一条路径下，按比例同时调整：

```text
yield *= param_2 / old_resourcepercentage
resourcepercentage = old_resourcepercentage
```

虽然第二条路径还带一个全局阈值/条件分支，但已经可以按代码确定：

```text
vfunc(+0x28, value)
会直接改写当前 AsteroidField 的
- yield (+0x1118)
- resourcepercentage (+0x1190)
```

这就把 region-side 运行时结果与 `AsteroidField` 本地资源参数的连接落到代码上了：

```text
region-side value
-> vfunc(+0x28)
-> AsteroidField.yield / resourcepercentage
-> 后续再进入 per-object amount / candidate / entity amount-list 链
```

#### solid 总量主链已经闭合到 per-object amount

到这里，和固体总量最相关的主链已经可以只按代码闭合成：

```text
FUN_140ed8dc0 payload
  +0x30 = resourcedensity
  +0x28 = replenishtime
  +0x2c = gatherspeedfactor

resourcedensity / region-side value
-> FUN_14073e110
-> AsteroidField::vfunc(+0x20) = FUN_140e83f80
-> AsteroidField::vfunc(+0x28) = FUN_140e84990
-> 改写 field.yield (+0x1118) / field.resourcepercentage (+0x1190)
-> AsteroidField::vfunc(+0x98) = FUN_140e803e0
-> AsteroidField::vfunc(+0xa8) = FUN_140e85c10
-> per-object amount
-> spawn record +0x78
-> FUN_140e84e40
-> Asteroid +0x430 amount list
```

其中最后两步现在可以直接对上：

- `FUN_140e803e0`

```text
MultiplierB
= lookup(DAT_143df3f88 + 0x130, ware_key)
 * field.yield (+0x1118)
 * lookup(DAT_143df3f88 + 0x170, ware_key)
```

- `FUN_140e85c10`

```text
if random > resourcepercentage:
    return 0

amount = MultiplierB
amount *= yieldvariation_noise
return max(1, floor(amount))
```

也就是说，当前已经能按代码确定：

```text
resourcedensity
不会直接变成最终 amount list，
而是会先影响 field.yield / field.resourcepercentage，
再通过 per-object amount 生成器 FUN_140e85c10
转成每个 solid object 的资源量。
```

- Universe 导入节点如何变成 key tree
- key tree 节点如何挂 `ResourceNodePayload`
- payload 如何继续拆成子 payload 与运行态对象图

---

## 五、仍待确认的问题

### 1. region-yield 两棵树各字段的精确语义

这部分现在必须拆开记录：

- `RegionYieldDef_FromXml` (`FUN_140e94280`)
  - 当前能严格确认的只是：
    - `+0x0`：某个由 attr `0x0a` 解析得到的 ID/句柄
    - `+0x8`：调用者传入的 dword
    - `+0xc`：attr `0x0b`
    - `+0x10`：attr `0x0c`
  - 它们的最终资源语义仍未锁死。

- `FUN_140ed8dc0`
  - 这是另一棵 region-yield 相关树的解析器。
  - 当前已确认：
    - `+0x28` <- attr `0x07`
    - `+0x2c` <- attr `0x04`
    - `+0x30` <- attr `0x09`
  - `RegionYieldXML` 的静态注册表（`FUN_140eb3010` + `0x14267d400` 字符串表）已经给出直接名字证据：
    - `0x04 = gatherspeedfactor`
    - `0x07 = replenishtime`
    - `0x09 = resourcedensity`
  - 其中 `attr 0x09` 的负值警告字符串直接写明它是：

```text
resource density
```

所以当前真正能按代码高可信写成“resource density”的，是：

```text
FUN_140ed8dc0` 产物里的 `+0x30`
```

而不是 long-range-scan 那棵树里尚未完全锁死语义的 `RegionYieldDef` 字段。

- 另外，`FUN_14073e110 -> FUN_140e83f80` 已经进一步证明：
  - `+0x30` 会先作为 field 侧的初始 `yield` 候选值灌进去
  - `+0x28/+0x2c` 也会分别灌入 field 的两个本地资源参数槽位

- 目前还能继续确认一条后续使用关系：
  - `FUN_140e801e0`
    - 按 `field.+0x1110` 的 ware key 去全局树 `DAT_143df3f88 + 0x1b0` 查一个 float
    - 再乘 `field.+0x111c`
  - 这说明：

```text
field.+0x111c
确实会在后续运行时公式里再次参与乘法
```

  - 但仅凭当前代码，还不能把它和“solid 总量主公式”直接写死成同一条链。

因此当前最值得继续锁的，不再是“resource density 是否真的参与 solid”，这点已经成立；而是：

```text
DAT_143df3f88 + 0x130 / +0x170 两张按 ware 的全局倍率树的精确语义
以及 field.+0x111c 是否只影响恢复侧而不影响初始总量
```

### 2. 运行态资源对象的真实类名

当前只通过接口行为确认了它们的存在和偏移，还没通过 RTTI/vtable 完全还原真实类型名。

### 3. `field->vfunc(+0x28)` 的具体实现类型

现在已经知道：

- `FUN_14073e110` 会用它把 region yield data 分配值写回 matching field
- 它直接决定 field 侧最终接收到多少按 ware 分配的值

但仍未最终下钻到：

- 这个 `+0x28` 在具体 solid field / runtime resource object 上到底写到哪个偏移
- 后续又如何与 `AsteroidFieldContribution(area)` / candidate amount / entity amount list 汇合

也就是说：

```text
region-level yield distribution -> field-local stored value
```

这一跳已经确认存在，但“field-local stored value 的最终落点”还待继续逆向。

---

## 六、建议的下一步逆向方向

### 方向 A：继续下钻运行态对象虚函数

目标：

- 找到 `RuntimeResourceObj + 0x10` 的 `vfunc(+0x8)` 实现
- 找到更深接口对象的 `vfunc(+0x28)` 实现

这是最有可能直接出现最终 `max` / yield 公式的位置。

### 方向 B：继续追 `InitMainResourceRuntimeObject`

目标：

- 继续识别 `runtime_obj + 0x500` 之后的 payload graph 布局
- 看这些 payload 如何与查询时的链表对象对应起来

### 方向 C：建立结构体草图

推荐把以下临时结构继续细化：

- `RegionYieldDef`
- `ResourceKeyNode`
- `RuntimeResourceObj`
- `ResourceNodePayload`
- `MainResourceRuntimeObject`

这样后续 Ghidra 中的反编译会大幅可读化，减少定位丢失。

---

## 七、当前阶段结论

当前阶段已经可以确定：

- 游戏资源运行态不是“XML 直接查询”。
- XML 和 Universe 参数先被导入为一组中间定义表。
- 然后构建成按 key 和空间位置组织的 payload/tree/object graph。
- `64k` 网格是重要的运行时采样/查询粒度。
- 最终可采资源值来自运行态对象的虚函数，而不是简单字段。

因此，若要继续逼近“`max` 是如何生成的”，最值得继续逆向的是：

- 运行态资源对象的虚函数实现

而不是再停留在 XML 读取层。

---

## 八、Solid 总量链新进展：Region 分配、AsteroidField 权重与 Per-Object Amount

本节只记录已经由代码直接支撑、且与 solid 总量直接相关的链条。XSD/schema 仅作为辅助理解，不作为本节结论来源。

### 1. Region 级 solid 分配主入口：`FUN_14073e110`

当前已确认，solid 的 region 级资源分配主入口是：

- `FUN_14073e110`

它读取的不是 long-range-scan 那棵树，而是由 `FUN_140ed8dc0` 构建的 region-yield payload 树。相关警告字符串也已经对上：

- `"Region '%s' has yield data ID '%s' for ware '%s', but no field with that resource"`
- `"Region '%s' references invalid yield data ID '%s' for ware '%s'"`

这说明这里处理的是 region 内某个 ware 的资源分配，而不是扫描显示数据。

### 2. `FUN_140ed8dc0` payload 字段：已确认映射

当前已确认的 payload 字段：

- `0x04 = gatherspeedfactor`
- `0x07 = replenishtime`
- `0x09 = resourcedensity`

其中对 solid 初始总量直接相关的，目前只保留：

- `resourcedensity`

其余两项：

- `replenishtime`
- `gatherspeedfactor`

虽然代码上会被写入 field 本地状态，但当前不把它们纳入“固体初始总量公式”，除非后续再找到直接证据。

### 3. `FUN_14073e110` 的 solid 分配公式

对每个 ware 的 region-yield payload，`FUN_14073e110` 会：

1. 找到所有匹配该 ware 的 solid field。
2. 对每个匹配 field：
   - 先调 `field->vfunc(+0x20)` 灌 payload。
   - 再调 `field->vfunc(+0xa0, 1)` 累加 field 权重。
3. 若总权重大于 0：
   - 从 `DAT_143df3f88 + 0x130` 这棵按 ware 的全局树查一个 float，默认 `1.0`
   - 计算：

```text
per_field_value = global_multiplier_for_ware * resourcedensity / sum(field_weights)
```

4. 然后对每个匹配 field 调：

```text
field->vfunc(+0x28, per_field_value_int)
```

这条链说明：

- `resourcedensity` 不是旁路标签。
- 它会被 region 级分配逻辑按 ware 分发到匹配的 solid fields 上。

### 4. `AsteroidField` 的三个关键虚槽

对 solid 分配当前最重要的 `AsteroidField` 虚槽已经落到具体函数：

- `vfunc(+0x20) = FUN_140e83f80`
- `vfunc(+0x28) = FUN_140e84990`
- `vfunc(+0xa0) = FUN_140e85b80`

#### 4.1 `FUN_140e83f80`

会先把 region-yield payload 灌进 field 本地状态：

- `+0x1118 <- resourcedensity`（仅当当前 yield 还是 `0`）
- `+0x111c <- replenishtime`
- `+0x1120 <- gatherspeedfactor`

当前与 solid 初始总量直接相关的，是：

- `+0x1118 = yield`

#### 4.2 `FUN_140e85b80`

这是 `field->vfunc(+0xa0, 1)` 对应的权重函数。当前已确认其核心结构为：

```text
field_weight
  = MultiplierA
  * MultiplierB
  * resourcepercentage
  * (F(maxnoisevalue) - F(minnoisevalue))
```

其中：

- `MultiplierA` 来自 `FUN_140e80300`
- `MultiplierB` 来自 `FUN_140e803e0`
- `resourcepercentage` 是 field 本地概率门控参数
- `F(maxnoisevalue) - F(minnoisevalue)` 来自 noise window 对应的区间权重

因此，region 分配时归一化用的不是对象数，而是 field 自身的资源承载权重。

#### 4.3 `FUN_140e84990`

这是 `field->vfunc(+0x28, per_field_value_int)` 对应函数。

当前已经确认：

- 它会直接改写：
  - `+0x1118 = yield`
  - `+0x1190 = resourcepercentage`

也就是说，region 级 `resourcedensity` 分配结果最终不是外挂在外面的独立变量，而是会直接回写到 `AsteroidField` 自身的：

- `yield`
- `resourcepercentage`

然后再进入后续 per-object amount 生成链。

### 5. `AsteroidField` 的 per-object amount 生成器：`FUN_140e85c10`

当前高可信认为：

- `FUN_140e85c10(longlong *param_1, char param_2)`

就是 solid 的单对象 amount 生成器。

其核心结构已经确认：

1. 先用 `*(float *)(param_1 + 0x232)` 做概率门控。
   - 不命中则直接返回 `0`
2. 再调 `vfunc(+0x98)`，也就是 `FUN_140e803e0`
3. 再读取 `*(float *)((longlong)param_1 + 0x1194)` 做 `yieldvariation` 风格扰动
4. 返回 `int`

这对应当前已知字段：

- `+0x1190 / +0x232 = resourcepercentage`
- `+0x1118 = yield`
- `+0x1194 = yieldvariation`

因此，可以把单对象资源量近似写成：

```text
per_object_amount
  ≈ Bernoulli(resourcepercentage)
    * yield
    * per_ware_multiplier_tree_A
    * per_ware_multiplier_tree_B
    * variation
```

这里的两个 `per_ware_multiplier_tree` 当前来自：

- `DAT_143df3f88 + 0x130`
- `DAT_143df3f88 + 0x170`

但它们的精确语义仍待继续锁定。

### 6. Per-Object Amount 到实体 amount-list 的写入链

当前已确认的 solid 实体 amount-list 写入链：

```text
FUN_140e85c10
-> per-object amount
-> spawn record / candidate amount
-> FUN_140e84e40
-> Asteroid +0x430 amount list
```

同时还已经确认：

- `MiningNode +0x300` 的运行时 amount-list 会通过：

```text
FUN_140100010(created_object + 0x300, candidate + 0x40)
```

从 candidate 复制过去。

需要注意：

- `+0x328` 与 `+0x458` 不是独立 cache。
- 它们只是各自 amount-list 容器的长度/entry count 槽位。

### 7. 当前更完整的 solid 总量链

只按已经有代码证据的部分，可以写成：

```text
region-yield payload(resourcedensity)
-> FUN_14073e110
-> 按 ware 找 matching AsteroidFields
-> sum(field_weight = vfunc(+0xa0))
-> per_field_value = global_multiplier_for_ware * resourcedensity / sum_weights
-> vfunc(+0x20) / vfunc(+0x28) 回写 field.yield 与 field.resourcepercentage
-> FUN_140e85c10 生成 per-object amount
-> 写入 Asteroid / MiningNode amount list
```

当前不能再简化为“只有 area noise 决定总量”或“只有 region yield 决定总量”。代码已经显示：

- region-yield payload
- field 权重归一化
- field 局部 `yield/resourcepercentage`
- per-object amount 生成

这几层都直接参与 solid 总量。

### 8. 直接名字证据：已确认的 attr id

当前已直接锁到的几个名字：

- `0x19 = densityfactor`
- `0x61 = ref`
- `0x67 = resourcepercentage`
- `0x2b = groupref`
- `0x96 = yield`
- `0x97 = yieldvariation`

这些映射现在可以当作代码证据使用，不再只是 XSD 猜测。

### 9. 当前仍待继续下钻的未决项

仍与 solid 总量直接相关、尚未完全锁死的主要是：

1. `FUN_140e85c10` 的返回值写入 candidate `+0x68/+0x6c` 的最后桥接点
   - 当前高可信，但还缺最后一跳
2. `+0x111c = replenishtime`
   - 已确认会被读取
   - 但当前仍不把它纳入 solid 初始总量公式，除非后续找到更直接的初始生成路径证据

---

## 九、2026-03-21 复核修正

本节只记录对未提交扩写内容的复核结果。标准是：必须能在当前 Ghidra 工程 `X4.exe` 里直接对上函数反编译；否则不写成定论。

### 1. `FUN_14073e110` 的 region 分配链可以确认

当前重新核对 `FUN_14073e110` 后，可以继续保留以下结论：

- 它会先对匹配 `ware` 的 field 调 `vfunc(+0x20)`，把 region-yield payload 灌入 field 本地状态。
- 然后调用 `field->vfunc(+0xa0, 1)` 累加权重。
- 若总权重大于 `0`，再从 `DAT_143df3f88 + 0x130` 查该 `ware` 的倍率，计算：

```text
per_field_value = lookup(DAT_143df3f88 + 0x130, ware_key) * resourcedensity / sum_weights
```

- 最后对匹配 field 调 `vfunc(+0x28, per_field_value)`。

其中 `FUN_140e83f80` 的代码已经再次确认：

- `param_2[2] -> field + 0x1118`（仅当当前 yield 仍为 `0`）
- `param_2[0] -> field + 0x111c`
- `param_2[1] -> field + 0x1120`

### 2. `FUN_140e85b80` 的一个关键点之前被写错了

`FUN_140e85b80(longlong *param_1, char param_2)` 现在已经重新反编译确认：

```text
return MultiplierA * MultiplierB * gate * (F(maxnoisevalue) - F(minnoisevalue))
```

但这里的 `gate` 不是总是 `resourcepercentage`：

- 当 `param_2 == 0` 时，`gate = field.resourcepercentage`
- 当 `param_2 != 0` 时，`gate = 1.0`

而 `FUN_14073e110` 里调用的是 `field->vfunc(+0xa0, 1)`，所以 region 分配阶段累加的权重 **不包含** `resourcepercentage`。之前把它写成固定乘子，这一条不成立，已修正。

### 3. `FUN_140e84c30` 可以确认是 AsteroidField 的 area contribution 计算

当前工程里能直接反编译到的是 `FUN_140e84c30`，而不是之前扩写里反复写死的 `FUN_140e84170`。

`FUN_140e84c30` 的结构可以确认包含：

- `FUN_14073f750(...)` 的 boundary/falloff 权重
- `FUN_1414f4840(param_1 + 0xd4)` 的局部 noise 项
- `vfunc(+0x1b8)` 返回的 `MultiplierA`
- `vfunc(+0x98)` 返回的 `MultiplierB`
- `field + 0x1190` 的 `resourcepercentage`

也就是说，AsteroidField 的单 area contribution 里，`resourcepercentage` 确实参与；但 region 分配时用于归一化的 `vfunc(+0xa0, 1)` 那一路不带这个因子。两者不能混写。

### 4. `MultiplierB` 现在可以收束成最终结论

在当前证据下，可以把 `MultiplierB` 直接写成：

```text
MultiplierB
= universeyielddensities(ware)
 * regionyields[ware][yield_tag].resourcedensity
 * universeobjectyielddensities(ware)
```

其中：

- `regionyields[ware][yield_tag].resourcedensity`
  - 提供该 `ware` 在该 `yield tag` 下的基础资源量级
- `universeyielddensities(ware)`
  - 提供按 `ware` 的 Universe 级总量倍率
- `universeobjectyielddensities(ware)`
  - 提供按 `ware` 的 Universe 级单对象密度倍率

如果用户没有在 `gamestarts.xml` 里做自定义覆盖，那么后两项按 `1` 处理，因此：

```text
MultiplierB
= regionyields[ware][yield_tag].resourcedensity
```

从贡献角度看，当前可按下列方式理解这些元素：

- `ware`
  - 决定去查哪一行 `regionyields`，也决定两张 Universe 覆盖表查哪一项
- `yield_tag`
  - 决定同一 `ware` 下选 `low/medium/high/...` 的哪条定义
- `resourcedensity`
  - 决定基础量级；它是 `MultiplierB` 里真正的核心幅值来源
- `universeyielddensities`
  - 改的是该 `ware` 的全局倍率；影响同类资源整体偏高或偏低
- `universeobjectyielddensities`
  - 改的是该 `ware` 的对象级密度倍率；影响单对象 amount 的放大或压缩

### 5. 下列说法本次不保留

以下内容在当前工程里没有足够直接证据，或与实际反编译状态不一致，因此不再写成结论：

- 把 `FUN_140e84170` 当作当前工程里已命名、已验证的 `ResourceField_GetContributionForQueryBox`
- “RTTI / vftable 已完全定位”
- “Solid 资源总量链已完全闭合”
- “8.0 气体资源通过 `resourceareas.xml` + callback 系统处理，9.0+ 才引入 `ResourceAreasCallback@Sector@U@@`”
- `RegionManager` 的完整结构定义和 `libraries/region_definitions.xml` / `.xsd` 的硬性绑定

这些内容后续如果要重新加入，必须补上当前工程里的直接交叉证据。
