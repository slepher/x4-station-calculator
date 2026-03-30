# X4 Region 系统逆向工程 - 当前现状与计划

## 一、当前已实现

> 2026-03-28 校正：
> 本文旧版本把 `dispatch_region_to_managers_140385C50` 以上路径写成 replay 已证实主线，
> 这一点现在不成立。当前已证实主链只到：
> `FUN_14075c250 -> FUN_14073f750 -> FUN_14093bf90`。
> `x4_replay.py` 现在是连接器，不再承载 C++ 主逻辑复刻。

### 1.1 Field 层 (Layer 2)

```
field/
├── __init__.py
├── resource_field.py          # 基础 ResourceField 类
├── resource_object_field.py   # vfunc +0x20, +0x28, +0xa0, +0xb0, +0xb8, +0x1c8
│   ├── receive_region_payload_0x20
│   ├── writeback_per_field_value_0x28
│   ├── check_flags_0xb0_1407B0490 (`yield_value > 0 && resourcepercentage > 0`)
│   ├── get_payload_name_ptr_0xb8_1407B02E0 (returns `field + 0x1128`)
│   └── get_ware_key_0x1c8_1407B0120 (returns `field + 0x1110`)
├── asteroid_field.py          # AsteroidField 具体实现
├── debris_field.py            # DebrisField 具体实现
├── nebula_field.py            # NebulaField 具体实现
├── field_factory.py           # Factory chain 实现
│   ├── iterate_resources_140e82530      (FUN_140e82530)
│   ├── resolve_groupref_140e81ff0       (FUN_140e81ff0)
│   └── field_factory_140e81620          (FUN_140e81620)
├── field_definition_router.py # 未证实入口分支 stub，未接主线
└── field_ref_resolver.py      # `ref` 分支 stub，未接主线
```

### 1.2 Boundary 层 (Layer 2 支撑)

```
boundary/
├── __init__.py
├── boundary.py                # 抽象基类, vfunc +0x10, +0x58, +0x70, +0x78
├── sphere_boundary.py         # Sphere 形状
├── cylinder_boundary.py       # Cylinder 形状
├── box_boundary.py            # Box 形状
├── spline_tube_boundary.py    # SplineTube 形状
├── composite_spline.py        # 复合 Spline
└── boundary_list.py           # Boundary 列表管理
```

### 1.3 Impl 层 (Layer 1 & 3)

```
impl/
├── __init__.py
├── region_add.py              # Layer 1 入口 (NEW)
│   ├── add_region_140BFA4E0   # 兼容 wrapper
│   └── compile_region_runtime_14075AE40
├── region_resource_field.py   # Layer 2: FUN_14073e110
├── compile_hit.py             # runtime prepare only
├── save_compare.py            # save compare loader
└── dispatch.py                # 75bd20 replay / spatial tree internals
    ├── dispatch_region_to_managers_140385C50 (未证实上游 wrapper)
    ├── replay_region_runtime_14075BD20
    ├── spatial_manager_process_region_14075BD20
    ├── spatial_index_insert_region_14075C250
    ├── spatial_manager_flush_14075CC00
    ├── build_transform_matrix_1403A7E40
    └── transform_bounds_1414EF820
```

### 1.5 Query 层 (Layer 5 查询 API)

```
query/
├── __init__.py
└── field_query.py             # Layer 5 查询 API
    ├── resource_field_get_contribution_140E84170
    ├── region_query_tiles_14073F750
    ├── get_field_base_value_1400B7620
    └── compute_coverage_14093BF90
```

## 二、实现状态更新

### 2.1 Layer 1: 入口层 ✅ 已完成

| 函数 | C++ 地址 | 状态 | 文件 |
|-----|---------|------|------|
| add_region_140BFA4E0 | FUN_140bfa4e0 | ✅ 已实现 | impl/region_add.py |
| SpawnRegionAtPos | (代码生成入口) | ❌ 未实现 | - |
| FUN_140385740 | (硬编码区域入口) | ❌ 未实现 | - |

### 2.2 Layer 2: Region 编译

| 函数 | C++ 地址 | 状态 | 文件 |
|-----|---------|------|------|
| region_resource_field_14073E110 | FUN_14073e110 | ✅ 已实现 | impl/region_resource_field.py |
| iterate_resources_140e82530 | FUN_140e82530 | ✅ 已实现 | field/field_factory.py |
| resolve_groupref_140e81ff0 | FUN_140e81ff0 | ✅ 已实现 | field/field_factory.py |
| field_factory_140e81620 | FUN_140e81620 | ✅ 已实现 | field/field_factory.py |
| route_field_definition_stub | 未证实入口分支占位 | [!] stub, 未接主线 | field/field_definition_router.py |
| resolve_ref_stub | `ref` 分支占位 | [!] stub, 未接主线 | field/field_ref_resolver.py |

### 2.3 Layer 3: compile-hit / spatial tree

| 函数 | C++ 地址 | 状态 | 文件 |
|-----|---------|------|------|
| compile_region_runtime_14075AE40 | `FUN_14075ae40` 相关 compile wrapper | ✅ 已实现 | impl/region_add.py |
| prepare_region_runtime_for_dispatch | runtime prepare 连接器 | ✅ 已实现 | impl/compile_hit.py |
| dispatch_region_to_managers_140385C50 | FUN_140385c50 | [!] 仅保留兼容实现，非 replay 已证实主入口 | impl/dispatch.py |
| replay_region_runtime_14075BD20 | 75bd20 主线 replay 入口 | ✅ 已实现 | impl/dispatch.py |
| spatial_manager_process_region_14075BD20 | FUN_14075bd20 | ✅ 已实现 | impl/dispatch.py |
| spatial_index_insert_region_14075C250 | FUN_14075c250 | ✅ 已实现 | impl/dispatch.py |
| spatial_manager_flush_14075CC00 | FUN_14075cc00 | ✅ 已实现 | impl/dispatch.py |
| build_transform_matrix_1403A7E40 | FUN_1403a7e40 | [~] 近似实现 | impl/dispatch.py |
| transform_bounds_1414EF820 | FUN_1414ef820 | [~] 近似实现 | impl/dispatch.py |

### 2.2 Layer 4: 统计聚合 (可选)

| 函数 | C++ 地址 | 状态 | 文件 |
|-----|---------|------|------|
| update_region_metric_max_14075DAD0 | FUN_14075dad0 | ❌ 未实现 | impl/aggregation.py |
| sum_subobject_metric_for_key_1407603F0 | FUN_1407603f0 | ❌ 未实现 | impl/aggregation.py |
| sum_item_metric_for_key_140760320 | FUN_140760320 | ❌ 未实现 | impl/aggregation.py |

### 2.3 Layer 5: 查询 API ✅ 已完成

| 函数 | C++ 地址 | 状态 | 文件 |
|-----|---------|------|------|
| resource_field_get_contribution_140E84170 | ResourceField_GetContributionForQueryBox | ✅ 已实现 | query/field_query.py |
| region_query_tiles_14073F750 | FUN_14073f750 | ✅ 已实现 | query/field_query.py |
| get_field_base_value_1400B7620 | FUN_1400b7620 | ✅ 已实现 | query/field_query.py |
| compute_coverage_14093BF90 | FUN_14093bf90 | ✅ 已实现 | query/field_query.py |

## 三、数据流验证

### 3.1 当前 Python 主线（按证据边界）

```
regions.json + resourceareas.json
    ↓
x4_replay.py (CLI / 连接器)
    ↓
prepare_region_runtime_for_dispatch
    └── compile_region_runtime_14075AE40
        │   ├── FUN_14073f560
        │   └── region_resource_field_14073E110
        ↓
replay_region_runtime_14075BD20
    └── spatial_manager_process_region_14075BD20
        └── spatial_index_insert_region_14075C250
            ↓
    dispatch-side tile replay / aggregation
```

### 3.2 已证实运行时主链（2026-03-29 断点）

```
FUN_14075bd20
    -> FUN_14075c250
        -> FUN_14073f750
        -> FUN_14093bf90
        -> field vfunc(+0x1c8)  => resource key
        -> field vfunc(+0x1f0)  => integer contribution
        -> FUN_14075ff10(agg_ctx, resource_key, contribution, ...)
        -> FUN_14075e070 / FUN_14075e000
```

说明：

- 上面这条是已证实运行时链。
- 上一节的 Python 主线只代表当前实现形态，不再代表已证实的 C++ 数据流。
- 尤其不能再把旧 candidate-node handoff 当作已证实链路。
- 2026-03-29 之后的主线接口已经收缩为
  `prepare_region_runtime_for_dispatch -> replay_region_runtime_14075BD20`。

## 四、关键常数

- **网格大小**: 64000 (0xFA00)
- **Field Type Asteroid**: 0x08
- **Field Type Debris**: 0x13
- **Field Type Nebula**: 0x4c

## 五、最近更新

- 2026-03-29: 断点确认 `FUN_14075c250` 内部已直接连到 `FUN_14075ff10`
  - 命中顺序确认：
    - `FUN_14075bd20`
    - `FUN_14075c250`
    - `FUN_14073f750`
    - field vfunc `+0x1c8`
    - field vfunc `+0x1f0`
    - `FUN_14075ff10`
  - 运行时参数确认：
    - `+0x1c8` 返回值被写入 `[rsp+0x30]`，并在 `FUN_14075ff10` 入口作为 `rdx`
    - `+0x1f0` 返回值进入 `r12d`，并在 `FUN_14075ff10` 入口作为 `r8d`
  - 因此 `FUN_14075ff10` 的真实输入来自 `FUN_14075c250` 叶子路径现场计算，不是 Python 当前的外置 `candidate_nodes` handoff
- 2026-03-28: 新增 field 分支重排规划骨架
  - 不再把 `tag` 当作已证实的 compile 分流条件
  - `FUN_140e82530 -> FUN_140e81ff0 -> FUN_140e81620` 保持为已证实主链
  - stub 只保留在未证实入口分支与 `ref` 分支
  - 新增规划文件：
    - `field/field_definition_router.py`
    - `field/field_ref_resolver.py`
- 2026-03-28: replay 已收缩为连接器
  - `x4_replay.py` 现在只负责：
    - CLI 参数解析
    - 调用 runtime prepare / 75bd20 replay / save compare 模块
    - 格式化输出
  - 新增模块：
    - `impl/compile_hit.py`
    - `impl/save_compare.py`
    - `impl/dispatch.py`
- 2026-03-28: 当前已证实主链收敛为
  - `FUN_14075c250 -> FUN_14073f750 -> FUN_14093bf90 -> +0x1c8/+0x1f0 -> FUN_14075ff10`
  - `FUN_14075c250` 以上路径暂不再宣称 replay 已证实
  - `field/resource_field.py` 现在负责：
    - `FUN_1414f4840` fast/slow path
    - `FUN_140e84c30` single-field single-tile contribution
  - 当前输出已经不是中间 float weight，而是 tile 级 integer current
- 2026-03-28: 主 contribution 路线判断已闭合
  - `FUN_140e84c30` 作为 field-family vtable 的 `+0x1f0` 槽实现之一，经 `FUN_14075c250` 虚调进入
  - `FUN_14075c250` 迭代 `region +0x290/+0x298` field vector，得到整数 contribution 后转发给 `FUN_14075ff10`
  - `FUN_14075ff10 -> FUN_14075e070` 将该整数累加进 `ResourceRechargeSource +0x08`
  - 当前主未知已收敛为 `FUN_1414f4840` 在 `cell_count < 17` 时的 slow path 精确 replay
- 2026-03-25: 实现 Layer 1 入口 (impl/region_add.py)
  - add_region_140BFA4E0 (FUN_140bfa4e0) - 主要入口
  - 修正 x4_replay.py 调用链，现在调用 Layer 1 而非直接 Layer 2
- 2026-03-25: 实现 Layer 3 空间索引注册 (dispatch.py)
  - dispatch_region_to_managers_140385C50
  - spatial_manager_process_region_14075BD20
  - spatial_index_insert_region_14075C250 (octree traversal)
  - spatial_manager_flush_14075CC00
- 2026-03-25: 实现 Layer 5 查询 API (query/field_query.py)
  - resource_field_get_contribution_140E84170
  - region_query_tiles_14073F750
  - get_field_base_value_1400B7620
  - compute_coverage_14093BF90
- 2024-03-25: 整理现有代码结构, 确定待实现函数清单
