# X4 Region 系统函数调用树

## 完整调用链

```
Layer 1: 入口层 (Entry Points)
│
├─ add_region (FUN_140bfa4e0)
│   │
│   ├─→ FUN_140385b90 ──→ FUN_14073c2e0 (Region 构造函数)
│   │                        │
│   │                        └─→ [初始化 BoundaryList]
│   │
│   ├─→ FUN_14073f560 ────────→ 刷新 Region identity
│   │
│   └─→ FUN_14073e110 ────────→ 编译 Region 运行时数据
│       │
│       └─→ FUN_140e82530 ────→ 按 boundary/split 展开 field，并写入 Region `+0x290/+0x298`
│           │
│           └─→ FUN_140e81ff0 ─→ 创建单个 field 运行时对象并 append 到 Region field-contributor list
│               │
│               └─→ FUN_140e81620 (field factory)
│                   │
│                   ├─ case 0x08: AsteroidField.from_xml_140e842e0
│                   ├─ case 0x13: DebrisField.from_xml_140e842e0
│                   ├─ case 0x4c: NebulaField
│                   └─ case 0x4f: ObjectField
│
├─ SpawnRegionAtPos ────────────→ 代码生成区域入口
│   └─→ [同 FUN_140bfa4e0 路径]
│
└─ FUN_140385740 ───────────────→ 硬编码区域入口
    │
    ├─→ FUN_14073f560
    ├─→ FUN_14073e110
    └─→ FUN_140385c50


Layer 2: Region 编译 (Compile)
│
├─ FUN_14073e110
│   │
│   ├─→ FUN_14093b3c0 ───────────→ reset embedded BoundaryList (+0x2b0)
│   │
│   ├─→ [type 0x0c]
│   │   ├─→ 填充 +0x2b8/+0x2c0/+0x2c8
│   │   ├─→ 填充 +0x2d0/+0x2d8/+0x2e0
│   │   └─→ FUN_14093b5a0 ───────→ 重建 +0x80..+0xa0 cache block
│   │
│   ├─→ [type 0x0d]
│   │   └─→ FUN_14093b4a0 ───────→ 向 +0x2b0 primary vector 插入 child
│   │
│   ├─→ 复制 +0x330..+0x350 → +0x360..+0x380
│   │
│   ├─→ 初始化 +0x390 / +0x3c0 curve-bank mirrors/default scales
│   │
│   ├─→ [type 0x23]
│   │   └─→ FUN_140e82530 ───────→ 创建 field 运行时对象并填充 `region +0x290/+0x298`
│   │
│   ├─→ [type 0x68]
│   │   ├─→ 建立按 ware 的 yield 映射
│   │   ├─→ 回填现有 field 的 payload / yield 基础字段
│   │   └─→ 记录 long-range-scan / yield 引用
│   │
│   ├─→ [type 0x22]
│   │   └─→ 拷贝 0x36 / 0x5f 子节点到 +0x390 / +0x3c0 curve-bank 引用
│   │
│   ├─→ [field payload/writeback]
│   │   ├─→ vfunc(+0x20) receive_region_payload
│   │   ├─→ vfunc(+0xa0) compute_field_weight
│   │   └─→ vfunc(+0x28) writeback_per_field_value
│   │
│   └─→ 同 ware bucket 归一化
│
├─ Field definition branch boundary
│   │
│   ├─→ `FUN_140e81ff0`
│   │   ├─ checks attribute `0x2b`
│   │   ├─ with `0x2b`: group lookup / group expansion path
│   │   └─ without `0x2b`: direct `FUN_140e81620(...)`
│   │
│   ├─→ unresolved entry boundary
│   │   ├─ current Python still branches too early before the proven factory chain
│   │   └─ `ref` path still missing direct closure
│   │
│   └─→ Python planning stubs (not wired)
│       ├─ `field/field_definition_router.py`
│       └─ `field/field_ref_resolver.py`
│
├─ Region 汇合点
│   │
│   ├─ `region +0x290 / +0x298`
│   │   ├─ producer: `FUN_14073e110 -> FUN_140e82530 -> FUN_140e81ff0`
│   │   ├─ consumer: `FUN_14075c250`
│   │   └─ consumer: `FUN_14070f330`
│   │
│   └─ `region +0xa8`
│       ├─ current best reading: filter-like runtime container
│       ├─ side path used by `FUN_140385c50 / FUN_14075ae40 / FUN_1404724c0 / FUN_1404728b0`
│       └─ not part of the main field-contributor list path
│
└─ [返回 region 内部已编译 field runtime state]


Layer 3: 空间索引注册 (Spatial Registration)
│
├─ FUN_140385c50 (dispatch_region_to_managers_140385C50)
│   │
│   ├─→ 遍历 owner+0xA8 容器 (managers)
│   │
│   ├─ [param_2 分支] ──→ FUN_14075bd20 (旧定义移除)
│   │
│   └─ [param_3 分支] ──→ FUN_14075bd20 (新定义添加)
│       │
│       ├─→ FUN_1403a7e40 ────────→ 构造变换矩阵
│       │
│       ├─→ vfunc(+0x1430) ───────→ 获取 Region bounds
│       │
│       ├─→ FUN_1414ef820 ────────→ 变换 bounds
│       │
│       ├─→ Clamp 到世界范围
│       │
│       ├─→ 对齐到 64000 网格
│       │
│       └─→ FUN_14075c250 ────────→ tile/block 递归，并读取 Region field-contributor list
│           │
│           ├─→ 读取 `region +0x290/+0x298`
│           └─→ [存入网格层级结构]
│
├─→ FUN_14070eb70 ─────────────────→ (可选) 全局系统注册
│
└─→ FUN_14075cc00 ─────────────────→ flush / finalize


Layer 4: 统计聚合 (Aggregation)
│
└─ FUN_14075dad0 (update_region_metric_max_14075DAD0)
    │
    ├─→ FUN_1407603f0 ──────────────→ 子对象 metric 总和
    │   │
    │   ├─→ 找到 key 对应节点
    │   ├─→ 遍历节点链表
    │   ├─→ vfunc(+8) ──────────────→ 触发对象
    │   └─→ 累加 vfunc(+0x28)(ctx)
    │
    └─→ FUN_140760320 ──────────────→ 对象本体 metric 总和
        │
        ├─→ 找到 key 对应节点
        ├─→ 遍历节点链表
        └─→ 累加 vfunc(+8)()


Layer 5: 查询/碰撞检测 (Query)
│
├─ FUN_140bf9fe0
│   └─→ FUN_14070edc0 ───────────→ hex-grid 查询分发
│       └─→ FUN_14070f1e0
│           └─→ FUN_14070f330
│               │
│               ├─→ `sector +0x68 -> region list`
│               ├─→ 可选读取 `region +0xa8` filter-like container
│               └─→ 读取 `region +0x290/+0x298`
│
├─ ResourceField_GetContributionForQueryBox
│   │   (resource_field_get_contribution_140E84170)
│   │
│   ├─→ 检查 field 有数据 (param_1[2] != 0)
│   │
│   ├─→ FUN_1403a7e40 ──────────────→ 构造查询矩阵
│   │
│   ├─→ 变换 query_box 坐标
│   │
│   ├─→ vfunc(+0xa0) ───────────────→ 获取 field multiplier
│   │
│   ├─→ FUN_1400b7620 ──────────────→ 获取基础产出值
│   │
│   ├─→ FUN_14073f750 ──────────────→ 实际查询处理
│   │   │   (region_query_tiles_14073F750)
│   │   │
│   │   ├─→ 检查 BoundaryList
│   │   │
│   │   ├─→ FUN_1403a7e40 ──────────→ 构造矩阵
│   │   │
│   │   ├─→ 坐标变换到本地空间
│   │   │
│   │   ├─→ Bounds 碰撞检测 (AABB)
│   │   │
│   │   ├─→ BoundaryList vfunc(+0x10) ─→ FUN_14093b7a0
│   │   │       │
│   │   │       ├─→ secondary: child.vfunc(+0x30)
│   │   │       └─→ primary: (child + 0x08).vfunc(+0x10)
│   │   │
│   │   └─→ FUN_14093bf90 ──────────→ 覆盖值组合
│   │           │
│   │           ├─→ child +0x48/+0x58/+0x60/+0x70
│   │           └─→ FUN_1414ed970
│   │
│   └─→ 返回: partial contribution path，不是最终 save-scale magnitude 全路径
│
├─ FUN_140e84c30
│   ├─→ 当前最佳 object→tile contribution 入口
│   ├─→ 通过上层 `call [rax+0x1f0]` 虚调进入
│   ├─→ `FUN_14075c250` 中的精确 forwarding
│   │   ├─ `uVar6 = (**(code **)(*plVar10 + 0x1f0))(plVar10, param_1, local_138)`
│   │   ├─ `FUN_14075ff10(plVar1 + 2, local_158, (ulonglong)uVar6, ...)`
│   │   └─ `FUN_14075e070(plVar9 + 2, param_3)` → `current += contribution`
│   ├─→ FUN_14073f750 ─────→ query_weight / coverage factor
│   ├─→ FUN_1414f4840 ─────→ local noise factor
│   │   ├─→ `cell_count >= 17`: `FUN_1414f5870(max) - FUN_1414f5870(min)`
│   │   └─→ `cell_count < 17`: clipped trilinear volume-integration slow path
│   ├─→ vfunc(+0x1b8) ─────→ multiplier_a
│   ├─→ vfunc(+0x98) ──────→ multiplier_b (`FUN_140e803e0`)
│   └─→ `floor(multiplier_b * multiplier_a * noise * field_scale * query_weight * clamp_weight)`
│
├─ FUN_1407ff10
│   ├─→ 接收 `FUN_140e84c30` 返回的整数结果 (`r8d`)
│   ├─→ FUN_1407e000 ─────→ 构造 `U::Sector::ResourceRechargeSource`
│   │   ├─→ `[obj+0x00] = vtable`
│   │   ├─→ `[obj+0x10..+0x40]` 初始化 nested recharger/value-source 子对象
│   │   └─→ `[obj+0x48] = recharge_time`
│   ├─→ FUN_1407e070 ─────→ 更新 recharge 数值
│   │   ├─→ `[obj+0x08] += contribution`
│   │   └─→ `[obj+0x0c] = [obj+0x08] / [obj+0x48]`
│   └─→ 将 recharge-source record 插入链表 / 分组容器
│
├─ `FUN_1414f4840` slow path 结构
│   ├─→ 输入
│   │   ├─ noise-space query min `(x0, y0, z0)`
│   │   ├─ noise-space query max `(x1, y1, z1)`
│   │   └─ noise threshold window `[noise_min, noise_max]`
│   ├─→ `FUN_1414f4290`
│   │   └─ 返回当前 lattice cell 的 8 个 corner noise 值
│   ├─→ 三次裁剪
│   │   ├─ x clip
│   │   ├─ y clip
│   │   └─ z clip
│   ├─→ `local_ec`
│   │   └─ 裁剪后 overlap volume weight
│   └─→ `local_2c8`
│       └─ 12 项正差分和 * overlap weight * scale
│
├─ corrected static chain above contribution-record collection
│   ├─→ `FUN_14076fce0`
│   │   ├─ reads stored int at `param_1 +0x10`
│   │   ├─ reads stored double at `param_1 +0x18`
│   │   ├─ reads object at `param_1 +0x20`
│   │   ├─ virtual dispatch via inner-object `slot +0x28`
│   │   └─ virtual dispatch via `[param_1 +0x20]` `slot +0x00`
│   ├─→ `FUN_14076ff20`
│   │   ├─ compares `[param_1 -0x20]`
│   │   ├─ against virtual-call result from `[param_1 -0x10]`
│   │   └─ contains early-return compare/select path
│   ├─→ `FUN_140770110`
│   │   ├─ virtual dispatch via `[param_1 +0x20]` `slot +0x08`
│   │   └─ compares result against `[param_1 +0x10]`
│   ├─→ `FUN_14076f7b0`
│   │   └─ bucket lookup/create layer
│   ├─→ `FUN_140479d10`
│   │   └─ BST lookup/insert layer (`+0x20` key, `+0x8/+0x10` child links)
│   └─→ `FUN_140773cb0`
│       └─ owner/root attach layer
│
├─ side-path clarification: business-node payload at `+0x20..+0x40`
│   ├─ `+0x20` = BST key
│   ├─ `+0x28..+0x40` = 常见为 name/hash/string metadata
│   ├─ runtime sample string: `"lowplus"`
│   └─ 这条路径主要负责索引/分类，不是当前主数值对象
│
└─ [主 contribution 路线已闭合；当前剩余未完成项主要是 `FUN_1414f4840` slow path 的精确 replay，而不是系统级未知]
```


## 简化调用链 (用户视角)

```
[用户代码]
    │
    ▼
add_region / SpawnRegionAtPos / FUN_140385740
    │
    ▼
FUN_14073e110
    │
    ├──→ reset +0x2b0 embedded BoundaryList
    │
    ├──→ 处理 type 0x0c / 0x0d / 0x23 / 0x68 节点
    │
    ├──→ Field 创建 / payload 注入 / weight 计算 / writeback
    │
    ├──→ 归一化写回
    └──→ 写入 Region `+0x290/+0x298` field-contributor list
    │
    ▼
FUN_140385c50 (dispatch_region_to_managers_140385C50)
    │
    └──→ FUN_14075bd20 (spatial_manager_process_region_14075BD20)
         │
         ├──→ Transform 计算
         ├──→ Bounds 获取
         └──→ 64000 网格对齐
              │
              ▼
         FUN_14075c250 (spatial_index_insert_region_14075C250)
              │
              ├──→ 读取 Region `+0x290/+0x298`
              ├──→ FUN_14073f750 / `FUN_14093bf90` 完成 profile/curve 评估
              └──→ FUN_14075ff10 构造或更新 `ResourceRechargeSource`
              ▼
         [空间索引存储]
              │
              ▼
         [运行时查询 / hex-grid 查询]
              │
              ▼
         FUN_14070edc0 / FUN_14070f330 / ResourceField_GetContributionForQueryBox
              │
              └──→ 返回贡献值
```

## Recharge 对象确认字段

`FUN_14075e000` / `FUN_14075e070` 现已 runtime 确认：

- `ResourceRechargeSource +0x08`
  - `current`
  - 每次执行 `FUN_14075e070` 通过 `add dword ptr [rcx+8], edx` 累加 contribution
- `ResourceRechargeSource +0x0C`
  - `rate`
  - 由 `current / time` 计算写回
- `ResourceRechargeSource +0x48`
  - `time`
  - `double`

已确认样本：

- 单次 contribution: `1561`
- 同对象累计后: `1561 -> 3122`
- `time = 108000.0`
- `rate = 3122 / 108000 ≈ 0.0289074`

## Contribution 路线完成判断

- 已完成：
  - `region +0x290/+0x298` producer/consumer 主线
  - `FUN_14073f750 -> FUN_14093bf90` coverage/query 权重链
  - `FUN_140e803e0` multiplier_b
  - `vfunc(+0x1b8)` multiplier_a
  - `FUN_140e84c30` 最终 `floor(...)` 整数化
  - `FUN_14075ff10 -> FUN_14075e000 / FUN_14075e070` current/rate/time 落点
- 未完成但已缩窄：
  - `FUN_1414f4840` small-cell (`cell_count < 17`) 慢路径的逐项 replay


## VFunc 调用点汇总

| VFunc 偏移 | 函数名 | 调用位置 | 用途 |
|-----------|--------|---------|------|
| +0x10 | BoundaryList gate | Layer 5, FUN_14073f750 | `+0x2b0` embedded subobject gate，具体实现是 FUN_14093b7a0 |
| +0x18 | set_groupref | Layer 2, FUN_140e81ff0 | 设置 group 引用 |
| +0x20 | receive_region_payload | Layer 2, FUN_14073e110 | 接收区域载荷，slot body 已在 runtime 证实，但不是独立函数入口 |
| +0x28 | writeback_per_field_value | Layer 2, FUN_14073e110 | 写回归一化值，slot body 已在 runtime 证实，但不是独立函数入口 |
| +0x30 | child gate | Layer 5, FUN_14093b7a0 secondary loop | secondary child 直接 gate |
| +0x48 | has_interval_a | Layer 5, FUN_14093bf90/14093bd40 | lateral profile 开关 |
| +0x58 | get_lateral_interval | Layer 3/5 | 获取横向区间 |
| +0x60 | has_interval_b | Layer 5, FUN_14093bf90/14093bd40 | radial profile 开关 |
| +0x70 | get_radial_interval | Layer 3/5 | 获取径向区间 |
| +0x78 | get_volume | Layer 3 | 获取体积 |
| +0x88 | cache block provider | Layer 2, FUN_14093b4a0/14093b5a0 | 更新 +0x80..+0xa0 cache block |
| +0x98 | get_multiplier_b | Layer 2/5 | 获取乘数 B |
| +0xa0 | compute_field_weight | Layer 2/5 | 计算权重，runtime slot -> 0x1407b5b80 |
| +0xb0 | check_flags | Layer 2, FUN_14073e110 | `yield_value_0x1118 > 0 && resourcepercentage_0x1190 > 0`，runtime slot -> 0x1407b0490 |
| +0xb8 | get_payload_name_ptr | Layer 2, FUN_14073e110 | 返回 `field + 0x1128`，runtime slot -> 0x1407b02e0 |
| +0x1430 | get_bounds | Layer 3, FUN_14075bd20 | 获取边界 |
| +0x1b8 | get_multiplier_a | Layer 2/5 | 获取乘数 A |
| +0x1c8 | get_ware_key | Layer 2/3 | 返回 `field + 0x1110` 中的 ware key / handle，runtime slot -> 0x1407b0120 |


---

# ResourceField 类继承结构

## 类层次结构

```
ResourceField (基类)
├── ResourceObjectField (固体资源字段基类, 0x11b0 bytes)
│   ├── AsteroidField       (case 0x08) - 小行星场
│   ├── DebrisField         (case 0x13) - 残骸场
│   ├── ObjectField         (case 0x4f) - 通用对象场
│   └── PositionalField     (case 0x56) - 位置场
├── NebulaField             (case 0x4c, 0x1190 bytes) - 星云场
├── AmbientSoundField       (case 0x07) - 环境音场
├── GravidarField           (case 0x2a) - 引力雷达场
├── ViewCorrection          (case 0x8d) - 视图修正
├── ResourceField_0x12      (case 0x12) - 未知类型
├── ResourceField_0x1c      (case 0x1c) - 未知类型
├── ResourceField_0x27      (case 0x27) - 未知类型
├── ResourceField_0x30      (case 0x30) - 未知类型
├── ResourceField_0x91      (case 0x91) - 未知类型
└── VolumetricFogField      (case 0x92) - 体积雾场
```

## 类详情

### ResourceField (基类)

**C++类**: `U::ResourceField`

**大小**: 基类，具体大小由子类决定

**VTable**: `0x142d075a8`

**构造函数**: `FUN_140e83d30`

**字段布局** (所有子类共有):
| 偏移 | 名称 | 类型 | 说明 |
|------|------|------|------|
| +0x00 | vptr | pointer | 虚函数表指针 |
| +0x10d0 | noise_table | float[1024] | 噪声表 |
| +0x10d4 | noisescale | float | 噪声缩放 |
| +0x10e0 | minnoisevalue | float | 最小噪声值 |
| +0x10e4 | maxnoisevalue | float | 最大噪声值 |
| +0x2b0 | boundary | pointer | 边界对象指针 |

**VTable方法**:
| 偏移 | 函数地址 | 说明 |
|------|----------|------|
| +0x98 | 0x140e803e0 | get_multiplier_b |
| +0xa0 | 0x140e85b80 | compute_field_weight |
| +0x1b8 | 0x140e80300 | get_multiplier_a |

---

### ResourceObjectField

**C++类**: `U::ResourceObjectField`

**基类**: `U::ResourceField`

**大小**: 0x11b0 bytes

**VTable**: `0x142d07378`

**构造函数**: `FUN_140e842e0`

**字段布局** (ResourceObjectField特有):
| 偏移 | 名称 | 类型 | 说明 |
|------|------|------|------|
| +0x10f0 | name | string | 字段名称 |
| +0x1108 | groupref | string | 组引用 |
| +0x1110 | ware_key | string/uint | 资源类型键 |
| +0x1118 | yield_value | float | 产量值 |
| +0x1150 | density_multiplier | float | 密度乘数 |
| +0x1158 | ref | string | 引用 |
| +0x1190 | resourcepercentage | float | 资源百分比 (0.0-1.0) |
| +0x1194 | yieldvariation | float | 产量变化 |
| +0x22a | densityfactor | float | 密度因子 |
| +0x232 | resourcepercentage_raw | float | 原始资源百分比 |

**VTable方法** (覆盖基类):
| 偏移 | 函数地址 | 说明 |
|------|----------|------|
| +0x18 | 0x140e83a90 | set_groupref |
| +0x20 | slot body near 0x1407b3f80 | receive_region_payload |
| +0x28 | slot body inside FUN_1407b4850 family | writeback_per_field_value |
| +0x98 | 0x140e803e0 | get_multiplier_b (使用yield_value) |
| +0x1b8 | 0x140e80300 | get_multiplier_a (使用density_multiplier) |
| +0x20 | slot body near 0x1407b3f80 | receive_region_payload |
| +0x28 | slot body inside FUN_1407b4850 family | writeback_per_field_value |
| +0xa0 | 0x1407b5b80 | compute_field_weight |
| +0xb0 | 0x1407b0490 | check_flags |
| +0xb8 | 0x1407b02e0 | get_payload_name_ptr (`lea rax,[rcx+1128h]`) |
| +0x1c8 | 0x1407b0120 | get_ware_key |

---

### AsteroidField

**C++类**: `U::Regions::AsteroidField`

**基类**: `U::ResourceObjectField`

**大小**: 0x11b0 bytes

**工厂case**: 0x08

**创建流程** (FUN_140e81620):
1. 分配内存: `FUN_1414c83e0(0x11b0, ...)`
2. 调用构造函数: `FUN_140e842e0(...)`
3. 设置vtable: `*obj = U::Regions::AsteroidField::vftable`

---

### DebrisField

**C++类**: `U::Regions::DebrisField`

**基类**: `U::ResourceObjectField`

**大小**: 0x11b0 bytes

**工厂case**: 0x13

**创建流程** (FUN_140e81620):
1. 分配内存: `FUN_1414c83e0(0x11b0, ...)`
2. 调用构造函数: `FUN_140e842e0(...)`
3. 设置vtable: `*obj = U::Regions::DebrisField::vftable`

---

### NebulaField

**C++类**: `U::Regions::Nebula`

**基类**: `U::ResourceField` (注意: 不是ResourceObjectField!)

**大小**: 0x1190 bytes

**工厂case**: 0x4c

**构造函数**: `FUN_140e860c0`

**字段布局** (NebulaField特有, 非ResourceObjectField):
| 偏移 | 名称 | 类型 | 说明 |
|------|------|------|------|
| +0x1154 | gather_speed | float | 采集速度主 |
| +0x115c | gather_speed_aux | float | 采集速度辅 |
| +0x22a | color1 | uint32 | 颜色1 (ARGB) |
| +0x22b | color2 | uint32 | 颜色2 (ARGB) |
| +0x22c | ambient_sound | pointer | 环境音引用 |
| +0x1164 | hide_nebulas | bool | 隐藏星云 |

**VTable方法**:
- 继承ResourceField的方法
- 有自己的get_multiplier_b实现 (使用gather_speed)

---

## 验证方法

### 1. 工厂函数验证

工厂函数 `FUN_140e81620` 的switch-case展示了所有字段类型的创建逻辑:

```cpp
switch(*(undefined4 *)(param_4 + 0xc)) {
    case 7:   // AmbientSoundField
    case 8:   // AsteroidField -> 调用FUN_140e842e0, 设置AsteroidField vtable
    case 0x13: // DebrisField -> 调用FUN_140e842e0, 设置DebrisField vtable
    case 0x4c: // NebulaField -> 调用FUN_140e860c0
    // ... 其他case
}
```

### 2. 构造函数行为验证

- **FUN_140e842e0** (ResourceObjectField):
  1. 调用 `FUN_140e83d30()` - 基类ResourceField初始化
  2. 设置vtable: `*param_1 = U::Regions::ResourceObjectField::vftable`
  3. 初始化ResourceObjectField特有字段 (+0x1110, +0x1118, +0x1150等)

- **FUN_140e860c0** (NebulaField):
  1. 调用 `FUN_140e83d30()` - 基类ResourceField初始化
  2. 设置vtable: `*param_1 = U::Regions::Nebula::vftable`
  3. 初始化NebulaField特有字段 (+0x1154, +0x115c等)

### 3. 内存大小验证

| 类 | 分配大小 | 证据 |
|----|---------|------|
| ResourceObjectField | 0x11b0 | `FUN_1414c83e0(0x11b0, ...)` |
| NebulaField | 0x1190 | `FUN_1414c83e0(0x1190, ...)` |

### 4. VTable地址验证

| 类 | VTable地址 | 证据 |
|----|-----------|------|
| ResourceField | 0x142d075a8 | 基类引用 |
| ResourceObjectField | 0x142d07378 | 构造函数设置 |
| AsteroidField | U::Regions::AsteroidField::vftable | 工厂函数设置 |
| DebrisField | U::Regions::DebrisField::vftable | 工厂函数设置 |
| NebulaField | U::Regions::Nebula::vftable | 构造函数设置 |

---

## 关键结论

1. **AsteroidField 和 DebrisField 是兄弟类**: 都继承自ResourceObjectField，不是父子关系

2. **NebulaField 与 ResourceObjectField 是平行关系**: 都直接继承自ResourceField，NebulaField不使用ResourceObjectField的任何字段

3. **字段偏移不连续**: 不同子类在相同偏移位置存储不同类型的数据
   - ResourceObjectField: +0x1118 = yield_value
   - NebulaField: +0x1154 = gather_speed (完全不同的语义)

4. **构造函数复用**: AsteroidField和DebrisField共享同一个构造函数(FUN_140e842e0)，仅vtable不同


## 文件对应关系

| 层 | C++ 函数 | Python 文件 | Python 函数 | 状态 |
|---|---------|------------|------------|------|
| L1 | FUN_140bfa4e0 | impl/region_add.py | add_region_140BFA4E0 | ✅ 已实现 |
| L1 | `FUN_14075ae40` 相关 compile wrapper | impl/region_add.py | compile_region_runtime_14075AE40 | ✅ 已实现 |
| L1 | SpawnRegionAtPos | impl/region_add.py | spawn_region_at_pos_14018E9E0 | ✅ 已实现 |
| L2 | FUN_14073e110 | impl/region_resource_field.py | region_resource_field_14073E110 | ✅ 已实现 |
| L2 | FUN_140e82530 | field/field_factory.py | iterate_resources_140e82530 | ✅ 已实现 |
| L2 | FUN_140e81ff0 | field/field_factory.py | resolve_groupref_140e81ff0 | ✅ 已实现 |
| L2 | FUN_140e81620 | field/field_factory.py | field_factory_140e81620 | ✅ 已实现 |
| L2 | FUN_140e842e0 | field/resource_object_field.py | from_xml_140e842e0 | ✅ 已实现 |
| L3 | runtime prepare orchestration | impl/compile_hit.py | prepare_region_runtime_for_dispatch | ✅ 已实现 |
| L3 | FUN_140385c50 | impl/dispatch.py | dispatch_region_to_managers_140385C50 | [!] 兼容实现；非 replay 已证实入口 |
| L3 | 75bd20 replay wrapper | impl/dispatch.py | replay_region_runtime_14075BD20 | ✅ 已实现 |
| L3 | FUN_14075bd20 | impl/dispatch.py | spatial_manager_process_region_14075BD20 | ✅ 已实现 |
| L3 | FUN_14075c250 | impl/dispatch.py | spatial_index_insert_region_14075C250 | ✅ 已实现 |
| L4 | FUN_14075dad0 | impl/aggregation.py | update_region_metric_max_14075DAD0 | ✅ 已实现 |
| backup | legacy candidate-node aggregation | backup/solid_tile_current.py | aggregate_tile_currents_for_nodes_14075C250 | 已移入 backup |
| L5 | ResourceField_GetContributionForQueryBox | query/field_query.py | resource_field_get_contribution_140E84170 | ✅ 已实现 |
| L5 | FUN_14073f750 | query/field_query.py | region_query_tiles_14073F750 | ✅ 已实现 |

## 2026-03-28 Python 落地补强

- `scripts/x4-game/x4_replay.py` 现在是薄连接器：
  - CLI 参数解析
  - 阶段模块调用
  - save compare
  - 输出格式化
- runtime prepare：
  - `scripts/x4-game/impl/compile_hit.py`
- 75bd20 主线 replay：
  - `scripts/x4-game/impl/dispatch.py`
- legacy candidate node -> tile current 聚合：
  - `scripts/x4-game/backup/solid_tile_current.py`
- 正式 field 级 contribution 落点：
  - `scripts/x4-game/field/resource_field.py`

当前 Python 主链：

```text
compute_region_resources(...)
  -> prepare_region_runtime_for_dispatch(...)
       -> compile_region_runtime_14075AE40(...)
  -> replay_region_runtime_14075BD20(...)
       -> spatial_manager_process_region_14075BD20(...)
       -> spatial_index_insert_region_14075C250(...)
       -> query_tile_occupancy_14073f750(...)
       -> ResourceField.compute_tile_contribution_140e84c30(...)
  -> tile -> current 聚合
```

已证实运行时主链：

```text
FUN_14075bd20(...)
  -> FUN_14075c250(...)
       -> FUN_14073f750(...)
       -> FUN_14093bf90(...)
       -> field vfunc(+0x1c8) => resource_key
       -> field vfunc(+0x1f0) => contribution
       -> FUN_14075ff10(agg_ctx, resource_key, contribution, ...)
       -> FUN_14075e070 / FUN_14075e000
```

证据边界修正：

- 已证实：
  - `FUN_14075c250 -> FUN_14073f750 -> FUN_14093bf90 -> +0x1c8/+0x1f0 -> FUN_14075ff10`
  - `+0x1c8` 返回的 `resource_key` 被转发到 `FUN_14075ff10.rdx`
  - `+0x1f0` 返回的 `contribution` 被转发到 `FUN_14075ff10.r8d`
- 未完全证实：
  - `FUN_14075c250` 以上是否稳定由 `FUN_140385c50` 主导
  - 旧 candidate-node aggregate 已退出主线；当前主线名称应为
    `prepare_region_runtime_for_dispatch -> replay_region_runtime_14075BD20`

实现状态：

- `FUN_1414f4840`
  - fast path: 已接入
  - slow path: 已在 Python 中接入 deterministic small-cell 分支
- `FUN_140e84c30`
  - 已作为 single-field / single-tile contribution API 落地
- 输出结构：
  - `TileResourceData.coord`
  - `TileResourceData.tile_values[ware] = int current`
  - `TileResourceData.field_traces[]`
