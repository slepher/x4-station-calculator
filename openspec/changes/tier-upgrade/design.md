# tier-upgrade 设计

## 1. 数据边界

本变更以现有 `scripts/x4_data_processor.py` 为唯一静态游戏数据生成入口：

```text
raw final.xml
  → ware_index + recipes
  → Tier / export eligibility / transmutable
  → wares.json + modules.json + res.json
  → useGameData modulesMap / waresMap
  → Logic Flow / Station / BuildPlan
```

不新增运行时数据适配层，也不把静态 recipe 复制进用户方案。三个业务环境通过同一 `modulesMap` 解析 module ID，符合现有 store 真相源边界。

## 2. Tier 判定

### 2.1 网络成员集合

生成器先从全部 recipe 构建两个集合：

- `producedWareIds`：具有至少一个生产配方的 Ware ID；
- `consumedWareIds`：出现在任意 recipe inputs 中的 Ware ID。

`networkWareIds = producedWareIds ∪ consumedWareIds`。

只有 `networkWareIds` 中的导出商品调用现有递归 Tier 计算：

- 无 recipe 或 recipe 没有 Ware 输入：T0；
- 有输入：`max(input tiers) + 1`；
- 不在网络集合：`tier: null`。

这使无配方但被消费的 `rawkhaakscrap` 正确成为 T0，同时使 `condensate` 不再伪装为 T0。`transmutable` 不进入网络成员条件。

### 2.2 类型表达

`X4Ware.tier` 从 `number` 调整为 `number | null`。使用 null 而不是额外 `isIsolated` 字段，因为 null 已直接表达“不参加 Tier 排名”，也避免保留一个虚假的数字 Tier。

这里的“孤立商品”是游戏数据语义，不等同于 Logic Flow 中用户主动设置的 `FlowNode.isIsolated`。后者继续表示切断上游的外部供应节点。

## 3. Ware 导出

### 3.1 transmutable

在现有 `wares_data.append()` 对象中增加：

```python
"transmutable": "transmutable" in self._split_tags(tags)
```

使用精确 tag 拆分，避免字符串子串判断。字段为必填 boolean；不增加替代行为分支。

### 3.2 nividiumgems

`nividiumgems` 继续进入 `ware_index` 和 `recipes`，但在满足普通商品导出条件后、追加到 `wares_data` 前按 ID 排除。

不按 `(TEMP)`、空 group 或是否有 icon 推断，因为这些字段不是稳定的领域标记。也不在 `buildWaresMap` 或 Vue 层过滤，以免生成文件和运行时数据不一致。

## 4. 多 queue 交替生产

当前生成器对每个 queue item 使用各自的 `3600 / recipe.time` 后直接相加，等价于所有配方同时满速运行。

调整为先解析 queue 中全部有效 recipe，再计算：

```text
sequenceTime = Σ recipe.time
factor = 3600 / sequenceTime

for recipe in queueRecipes:
  outputs[recipe.ware] += recipe.amount × factor
  inputs[inputWare] += inputAmount × factor
```

该公式等价于对每条独立连续产率应用时间占比：

```text
(amount / recipeTime) × (recipeTime / sequenceTime)
```

因此它适用于未来配方时长不同的交替序列，不硬编码除以 2。单 recipe 时 `sequenceTime == recipe.time`，自然保持原行为。

多 queue 模块的 `cycleTime` 表示一次完整交替序列时间；标准与 Terran Recycler 均为 600 秒。`outputs` 和 `inputs` 仍是最终小时率，业务层不得再次换算。

## 5. Logic Flow 边界

Logic Flow 的候选集合继续从生产模块种子及其输入回溯生成，而不是扫描全部 Ware。所有创建 `FlowNode.column` 的入口必须先确认 `ware.tier !== null`：

- 候选拖拽和预览；
- 手动节点创建；
- `computeExpandUpstream` 自动回溯；
- 已保存方案恢复；
- BuildPlan 使用的 Logic Flow snapshot 重建。

已保存节点引用被静态数据排除的 Ware 时，沿用现有“unknown ware 则跳过并 warning”的兼容策略，不提升 Flow storage version。

## 6. Station 与 BuildPlan 传播

Logic Flow 导入 Station 时继续把 manual module 节点聚合为 `{ id, count }`。Station 通过 `modulesMap[id]` 获得回收模块的全部 outputs/inputs。

BuildPlan 同样使用 `SavedModule[]` 与 `modulesMap`。需要审计生产流计算入口，统一约束：

- `X4Module.outputs` 是每小时产量；
- `X4Module.inputs` 是每小时消耗；
- `cycleTime` 仅为模块序列元数据，不参与小时率二次换算。

不新增 `productionWareId`，因为用户已确认多产物聚合模型符合当前规划需求；不保存 recipe snapshot，因为切换游戏版本后应解析该版本的权威静态数据。

## 7. 数据迁移与兼容

使用现有命令一次生成所有配置版本：

```bash
python3 scripts/x4_data_processor.py --all-versions
```

预期静态文件变化集中在：

- `wares.json`：nullable Tier、`transmutable` 字段、移除 `nividiumgems`；
- `modules.json`：多 queue 模块的交替小时率与完整序列 cycleTime；
- `res.json`：仍只从 `tier === 0` 的 Ware 生成，因此自动排除 null Tier。

用户数据只保存 Ware/module ID、数量和方案结构；本次没有新增持久化字段，因此不增加 migration version。

## 8. 明确不建模的内容

Scrap Processor 的名义配方吞吐与 Manticore/Teuta 投递造成的实际 uptime 是两层问题。本次只修正权威配方小时率；物流距离、排队、dock/容量以及船只数量留给独立物流模型。

原始 recipe 的 workforce bonus 在多产物之间并不完全一致，但本次不扩展 `X4Module.workforce`。交替 duty share 只修正基础小时率，逐产物 workforce 精度另行设计。
