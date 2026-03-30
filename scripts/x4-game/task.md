# X4 Solid Tile Current Python 落地任务表

## 任务状态图例

- [ ] 未开始
- [~] 进行中
- [x] 已完成
- [!] 阻塞/待定

---

## 任务目标

> 2026-03-28 更新：
> 这份任务表记录的是“solid tile current 首次落地”阶段。
> 其中把 `x4_replay.py` 当作主实现入口、并把 `FUN_14075c250` 以上路径视为已闭合，
> 现在已经证明口径过宽。当前应以：
> - `FUN_14075c250 -> FUN_14073f750 -> FUN_14093bf90` 为已证实主链
> - `x4_replay.py` 仅为连接器
> - `FUN_14075c250` 以上路径仍属未完全证实
> 为新的实现边界。

本任务的唯一目标不是继续探索，而是：

- [ ] 将 solid 资源区域的 tile 筛选、单 tile contribution 计算、以及每个 tile 的 `current` 生成逻辑完整落地到 Python
- [x] 将 solid 资源区域的 tile 筛选、单 tile contribution 计算、以及每个 tile 的 `current` 生成逻辑完整落地到 Python

输出要求：

- [x] Python 能从 region / field 数据生成 solid tile 列表
- [x] Python 能为每个 tile 计算 per-field contribution
- [x] Python 能将同一 tile 的多个 contribution 聚合成最终 `current`
- [x] Python 输出结构能直接表达：`tile -> current`

非目标：

- [x] 不继续围绕 save serialization 展开
- [x] 不把 `ResourceRechargeSource` 作为主实现目标
- [x] 不把 `solid_noise_small_cell.py` 当基线
- [x] 不把工作停留在“数学解释/探索完成”

---

## 当前已知实现基线

- [x] 主 contribution 路线已闭合：
  - `FUN_14075c250` -> field vector iteration / tile-side insertion
  - `FUN_140e84c30` -> single field -> single tile contribution
  - `FUN_14073f750 -> FUN_14093bf90` -> query/coverage factor
  - `FUN_1414f4840` -> local noise factor
  - `vfunc(+0x1b8)` -> multiplier_a
  - `FUN_140e803e0` / `vfunc(+0x98)` -> multiplier_b
- [x] 最终 contribution 规则：
  - `floor(multiplier_b * multiplier_a * noise_window * field_scale * query_weight * clamp_weight)`
- [x] `FUN_1414f4840`:
  - [x] fast path 已确认
  - [x] slow path 已知为 clipped trilinear volume integration
- [x] `FUN_14075e070` 的 `current += contribution` 语义已确认

---

## Phase A: 确定 Python 正式落点

### Task A.1: 明确模块职责
- [x] A.1.1 `scripts/x4-game/query/field_query.py` 负责 query/coverage 入口，不适合作为 noise slow path 终点
- [x] A.1.2 `scripts/x4-game/impl/tile_processing.py` 负责 coverage/profile 组合，不适合作为 solid tile current 总入口
- [x] A.1.3 `scripts/x4-game/field/resource_field.py` 应承载 field 级 noise / multiplier / contribution 逻辑
- [!] A.1.4 旧结论“最终 tile 枚举与聚合入口落在 `scripts/x4-game/x4_replay.py`”已废弃
- [x] A.1.5 新结论：`x4_replay.py` 只做 CLI/orchestration/save compare，阶段实现应落在 `impl/` 模块

### Task A.2: 明确输出数据结构
- [x] A.2.1 定义 Python 侧 `tile key` 表达
- [x] A.2.2 定义 `tile -> current` 输出结构
- [x] A.2.3 定义 per-field intermediate trace 结构，便于对拍

---

## Phase B: 完成 tile 筛选/枚举

### Task B.1: Region → tile 候选集合
- [x] B.1.1 从 `FUN_14075bd20 / FUN_14075c250` 现有结论整理 tile 枚举规则
- [x] B.1.2 在 Python 中明确 64k grid 对齐规则
- [x] B.1.3 明确 bounds -> tile candidates 的筛选条件
- [x] B.1.4 明确 solid field 与 nebula/debris/object 等分流条件

### Task B.2: Python 落地 tile 枚举
- [x] B.2.1 实现 solid region 的 tile candidate 枚举函数
- [x] B.2.2 为 tile candidate 枚举补充最小可复现样本
- [x] B.2.3 输出稳定的 tile 列表，不再依赖手工推断
- [x] B.2.4 旧方案曾把 field build 与 tile 预枚举揉在同一阶段

---

## Phase C: 完成单 field -> 单 tile contribution

### Task C.1: 复用已完成子链
- [x] C.1.1 复用/接入 `FUN_14073f750 -> FUN_14093bf90` 的 Python 逻辑
- [x] C.1.2 复用/接入 multiplier_a
- [x] C.1.3 复用/接入 multiplier_b
- [x] C.1.4 复用/接入 `field_scale`
- [x] C.1.5 复用/接入 `clamp_weight`

### Task C.2: 完成 `FUN_1414f4840`
- [x] C.2.1 将 fast path 正式接入主 contribution 计算
- [x] C.2.2 将 slow path 从“结构级结论”落成 Python 算法
- [x] C.2.3 统一 `FUN_1414f4840` 的 Python API，使上层不区分快慢路径

### Task C.3: 完成 `FUN_140e84c30`
- [x] C.3.1 建立 Python 版 single-field single-tile contribution 函数
- [x] C.3.2 实现最终 `floor(...)` 整数化
- [x] C.3.3 为函数输出 trace：各因子值、pre-floor 值、post-floor 值

---

## Phase D: 完成每个 tile 的 current 聚合

### Task D.1: 对应 `FUN_14075c250 -> FUN_14075ff10 -> FUN_14075e070`
- [x] D.1.1 定义 Python 侧 tile 聚合器
- [x] D.1.2 明确同一 tile 上多 field contribution 的累加规则
- [x] D.1.3 输出 tile 级 `current`

### Task D.2: 生成最终结果
- [x] D.2.1 对一个 solid region 生成完整 `tile -> current`
- [x] D.2.2 对多个 solid field 叠加场景生成完整 `tile -> current`
- [x] D.2.3 确认未采集场景下 `current` 即最终输出目标

---

## Phase E: 验证

### Task E.1: fast path 样本
- [x] E.1.1 选择 `Cluster_03_Sector001_macro / p1_40km_ice_field` 作为快路径集成样本
- [x] E.1.2 对拍 per-field contribution
- [x] E.1.3 对拍 tile-level current

### Task E.2: slow path 样本
- [x] E.2.1 选择 `noisescale = 50000.0 / seed = 666` 的 deterministic `ResourceObjectField` 作为 small-cell 样本
- [x] E.2.2 对拍 slow path 的 `cell_count`、8-corner 哈希、体积裁剪与 final noise 范围
- [x] E.2.3 对拍 slow path 已接入 tile contribution 主 API

### Task E.3: 结果标准
- [x] E.3.1 fast path 结果误差控制在 `1e-6`
- [x] E.3.2 slow path 结果以 deterministic 分支回归和范围校验锁定
- [x] E.3.3 确认不引入新的系统级主未知量

---

## 当前执行顺序

1. [x] A.1.4 明确最终 tile 枚举与聚合入口应落在哪个 Python 文件
2. [x] A.2.1-A.2.3 定义 tile/current/intermediate trace 数据结构
3. [x] B.1.1-B.2.3 完成 tile 枚举
4. [x] C.1.1-C.1.5 接通 contribution 所有已知因子
5. [x] C.2.1-C.2.3 完成 `FUN_1414f4840` Python 落地
6. [x] C.3.1-C.3.3 完成 `FUN_140e84c30` Python 落地
7. [x] D.1.1-D.2.3 生成每个 tile 的 `current`
8. [x] E.1.1-E.3.3 完成验证

---

## 完成判定

本任务完成标准只有一个：

- [x] Python 可以对 solid region 生成完整的 `tile -> current` 结果

补充要求：

- [x] fast path 与 slow path 都已接入
- [x] 结果不是单个 field 权重，而是 tile 级 current
- [x] 结果不是停留在文档，而是已有明确 Python 落点和实现路线

## 当前结构修正

- [x] `scripts/x4-game/impl/compile_hit.py`：runtime prepare
- [x] `scripts/x4-game/backup/solid_tile_current.py`：旧 candidate-node 聚合已转入 backup
- [x] `scripts/x4-game/impl/save_compare.py`：save compare 读取
- [x] `scripts/x4-game/x4_replay.py`：薄连接器

---

## 新任务：Field 分支逻辑重排

> 2026-03-28 新增：
> 当前问题在 field definition 的入口分支边界。
> 现实现过早按 `tag` 做 compile 分流，这一层没有足够的 C++ 证据。
> 已证实的：
> - `FUN_140e82530 -> FUN_140e81ff0 -> FUN_140e81620`
> 不应 stub。
> 当前 runtime 已证实 `FUN_140e81ff0` 存在：
> - `group path`
> - `direct path`
> 下一轮应把剩余未证实部分后移到更接近：
> - `FUN_140e81ff0`
> - `FUN_140e81620`
> 的位置。

### Phase F: 文件结构落盘

- [x] F.1 新增 `scripts/x4-game/field/field_definition_router.py`
- [x] F.2 新增 `scripts/x4-game/field/field_ref_resolver.py`
- [x] F.3 明确 stub 不覆盖已证实 factory 链

### Phase G: 分支重构任务

- [x] G.1 从 `region_resource_field.py` 去掉按 `tag` 的先验 compile 分流
- [x] G.2 让 compile 上游只保留原始 definition 分支键：
  - `type`
  - `groupref`
  - `ref`
- [x] G.3 将 `groupref` 路严格收口到 `FUN_140e81ff0` 对应层
- [x] G.4 将 field 类型分流严格收口到 `FUN_140e81620` 对应层
- [x] G.5 移除主线中的 `ref` 阻塞，让无 `groupref` 的 definition 按 `FUN_140e81ff0` direct path 进入 factory

### Phase H: 下一轮补证据

- [x] H.1 已 runtime 证实 `FUN_140e81ff0` direct path 会实际命中
- [x] H.2 当前主线不再围绕 `ref` 建任务，重点转向 `FUN_140e81620` 的 direct-path type 处理
- [x] H.3 下一轮只需继续补 `FUN_140e81620` 的具体 type 落点
