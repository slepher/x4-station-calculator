# tier-upgrade 需求

## 目标

统一商品 Tier、孤立商品和回收模块交替生产的领域语义，使生成的静态游戏数据成为 Logic Flow、Station 与 BuildPlan 的共同真相源，并为后续 `transmutable` 替代材料语义保留明确字段。

## 已确认方案（审核重点）

### Tier 与孤立商品

- Tier 只描述商品在生产网络中的依赖深度。
- 商品具有生产配方，或被其他商品的生产配方引用为输入时，才参与 Tier 排行。
- 无上游 Ware 输入的网络商品为 T0；其余商品按最大上游深度递增。
- 没有生产配方且未被任何生产配方引用的商品为孤立商品，以 `tier: null` 表示；孤立商品仍保留在 `wares.json` 和通用商品查询中，但不进入 Logic Flow 候选、T0 集合或 `res.json`。
- `transmutable` 不参与 Tier 判定。`khaakalloy` 依靠现有配方链自然得到 T2。
- `rawkhaakscrap` 虽无普通生产配方，但被后续配方消费，因此为 T0。
- `condensate` 没有生产配方且未被其他配方消费，因此为孤立商品。

### Ware 元数据

- `X4Ware` 和每个生成的 ware 条目新增必填 `transmutable: boolean`。
- 该字段严格来自原始 ware tags；没有该 tag 时为 `false`。
- 本次只导出元数据，不实现替代材料、兑换比例或生产消耗改写。

### 临时 Ware 排除

- `(TEMP)nividiumgems`（ID `nividiumgems`）不得进入应用层 `wares.json`。
- 排除发生在 `wares_data` 导出边界；原始 XML、内部 ware 索引、recipe 解析以及 macro/component 索引保持不变。
- 使用明确 ID 排除，不按 `(TEMP)` 名称前缀或空 group 做全局推断。

### 回收模块交替生产

- 保留 `X4Module.outputs`/`inputs` 的多产物聚合模型，不增加配方选择字段或用户存档中的 recipe 快照。
- 对含多个 queue item 的模块，一次完整交替序列的时长为所有配方时长之和；每个配方的产出和输入均按该总时长换算为小时率。
- 当前标准与 Terran Scrap Recycler 的两个配方均为 300 秒，因此每条配方的小时率等于独立连续运行小时率的 50%。
- 标准 Scrap Recycler 的基础小时率为：Hull Parts 1,200、Claytronics 360、Energy Cells 消耗 93,000、Scrap Metal 消耗 2,250。
- 当前 9.0 Terran Scrap Recycler 的基础小时率为：Computronic Substrate 300、Silicon Carbide 360、Energy Cells 消耗 99,000、Scrap Metal 消耗 7,500。
- 只有一个 queue item 的生产模块保持原产率；Allographyne Scrap Recycler 不应被错误折半。

### Logic Flow、Station 与 BuildPlan 一致性

- 生成后的 `wares.json` 与 `modules.json` 是三个环境的共同静态数据源。
- Logic Flow 只为 `tier !== null` 的商品创建候选或运行态节点，避免把孤立商品误作 T0。
- Logic Flow 向 Station 或 BuildPlan 传播模块时继续保存/传递 module ID；目标环境从当前游戏版本的 `modulesMap` 读取完整聚合 outputs/inputs。
- Station 与 BuildPlan 必须把模块 inputs/outputs 视为已经归一化的小时率，不得再次通过 `cycleTime` 换算。
- 该变更不增加用户持久化字段，不提升 empire、flow 或 build-plan storage version。

### 静态数据迁移

- 修改现有 `scripts/x4_data_processor.py`，不创建第二套迁移器。
- 使用现有全版本生成入口重新生成 8.0 Diplomacy 与 9.0 Empire 的静态数据。
- 同步 TypeScript 类型和完整 `X4Ware` 构造数据，使 `tier: number | null` 与 `transmutable: boolean` 在编译期明确。

## 边界

### In Scope

- Tier 网络成员判定与孤立商品的 `tier: null` 表达
- `transmutable` boolean 导出与类型同步
- 从 `wares.json` 精确排除 `nividiumgems`
- 多 queue 回收模块的交替小时率计算
- Logic Flow 对无 Tier 商品的边界处理
- Station、BuildPlan 对统一小时率的消费一致性
- 8.0、9.0 静态游戏数据重新生成
- 同步 `tiers.md` 中的已确认领域定义

### Out of Scope

- Allographyne 的替代材料规则和换算比例
- 按名称前缀自动排除所有临时 Ware
- 让用户选择或锁定 Scrap Recycler 的单一 queue item
- Manticore/Teuta 数量、航程、处理器排队和物流 uptime 模型
- Scrap Processor 是否受 workforce 影响的进一步模拟
- 多产物配方的逐产物 workforce bonus 重构
- 用户存档 schema 或 storage version 迁移

## 验收标准（DoD）

1. 8.0 与 9.0 `wares.json` 中，生产网络商品具有数值 Tier，孤立商品具有 `tier: null`。
2. `rawkhaakscrap` 为 T0，`khaakscrapmetal` 为 T1，`khaakalloy` 为 T2，`condensate` 的 Tier 为 null。
3. `khaakalloy.transmutable` 为 true，普通商品的 `transmutable` 为 false；该字段不改变 Tier 结果。
4. 两个版本的 `wares.json` 均不存在 `nividiumgems`，且原始资产和内部解析索引未被删除。
5. 标准与 Terran Scrap Recycler 的生成小时率符合已确认交替数值，单 queue 回收模块产率不变。
6. Logic Flow 不展示或创建 `tier: null` 商品节点，且不会把它们作为 T0 资源。
7. 同一个回收模块通过 Logic Flow 进入 Station 或 BuildPlan 后，三个环境使用一致的聚合输入、输出和小时率。
8. 不新增 recipe 持久化字段，不提升现有用户数据版本。
9. `npm run build` 通过。

## 未决项

无
