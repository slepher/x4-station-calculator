# Workforce Fix - Design

## 目标

当前系统的问题不在于单个公式算错，而在于整条链路只保留了 `workunit_busy` 一套消费表，导致 live 路径下所有居民都被当作 busy 处理。本次设计要把数据模型、命名和运行时算法一起纠正到“idle / busy 双态”。

## 分层策略

遵循仓库的 `store -> presenter -> vue` 原则，本次变更不新增 UI 组装层，主要落点应为：

- `scripts`
  - 修正 X4 原始 XML 的提取结构
- `store/logic`
  - 修正 workforce consumption 数据类型与运行时计算
- `store/state`
  - 修正 live / archive 路径把 `workforces` 直接等同于 `actualWorkforceOverride` 的语义
- `vue/presenter`
  - 仅被动消费修正后的 flow 结果，不新增新的 UI 口径

## 数据模型调整

当前 `RaceMedicalConsumption` 无法表达：

- 不是 medical-only，还包含 food / race-specific food
- 需要区分 `idle` / `busy`

建议改为三层结构：

```ts
interface WorkforceStateConsumption {
  [wareId: string]: number // per person per hour
}

interface RaceWorkforceConsumption {
  idle: WorkforceStateConsumption
  busy: WorkforceStateConsumption
}

interface WorkforceConsumptionMap {
  [race: string]: RaceWorkforceConsumption
}
```

这样可以避免后续继续出现：

- 只看名字误以为只管 medical
- 无法在类型层约束必须同时有 `idle` / `busy`

## XML 提取设计

数据处理脚本需要从 `wares.xml` 中分别读取：

- `workunit_idle`
- `workunit_busy`

对每个 `production method`：

1. 读取 `time`
2. 读取 `amount`
3. 读取 `<primary><ware .../></primary>`
4. 计算 `perPersonPerHour = amount / (population * time) * 3600`

提取结果按 `race -> state -> wareId -> perPersonPerHour` 保存。

注意点：

- `default` 仍是默认 race key
- 不应再覆盖写入单层 `self.race_consumption[method] = consumables`
- 注释必须同步改成“每人每小时”

## 运行时算法设计

### 1. blueprint / planning 路径

当前 blueprint 路径需要拆成两种情况：

- `workforceAuto = true`
- `workforceAuto = false`

#### 1.1 auto 计算

当前路径没有真实居民总数，只有：

- `neededWorkforce`
- `actualWorkforce`

因此该路径继续采用：

- `busyWorkers = actualWorkforce`
- `idleWorkers = 0`

contribution 设计：

- 只生成 `class: 'workforce'`
- 不生成 `class: 'workforce_idle'`

#### 1.2 manualWorkforce 计算

当 `workforceAuto = false` 时，`settings.manualWorkforce` 应视为“总站实际居民数”。

这条路径虽然没有直接输入 race array，但系统已经能根据 habitation module 进行 race 拆分。因此正确流程应为：

1. 使用当前 habitation 环境把 `manualWorkforce` 拆成 race population entries
2. 将这组 race population entries 交给与 `workforceOverride` 相同的后处理函数
3. 统一计算：
   - `totalResidents`
   - `busyWorkers`
   - `idleWorkers`
   - race 级 busy / idle 分摊

也就是说，manualWorkforce 与 workforceOverride 的差异只保留在“上游 race entries 的来源”，不应再保留在“下游 busy/idle consumption 算法”。

### 2. workforce entries 共享后处理

当系统已经拿到 race population entries 后，无论来源是：

- live / archive 的 `workforces`
- blueprint / planning 下由 `manualWorkforce` + habitation 环境拆出的结果

都必须进入同一套后处理逻辑。

这里必须拆成两步：

1. 求总站 busy / idle
2. 按 race 比例分配

总站计算：

```ts
totalResidents = sum(workforces.amount)
busyWorkers = min(totalResidents, neededWorkforce)
idleWorkers = max(0, totalResidents - busyWorkers)
```

按 race 分配：

```ts
raceRatio = raceResidents / totalResidents
raceBusy = allocateByRatio(raceRatio, busyWorkers)
raceIdle = raceResidents - raceBusy
```

再分别套用：

- `consumptionMap[race].busy`
- `consumptionMap[race].idle`

因为 JSON 已经保存为 hourly rate，运行时计算应直接使用：

```ts
hourlyAmount = workers * perPersonPerHour
```

而不是在计算阶段再乘 `3600`。

contribution 设计：

- busy 部分生成 `class: 'workforce'`
- idle 部分生成 `class: 'workforce_idle'`
- 两者都继续使用 `type: 'consumption'`
- 不新增 contribution 字段数量，也不在 contribution 中记录 auto / override 来源

原因：

- auto 与 override 两条路径本身互斥
- 本次真正新增的业务信息只有“这部分 consumption 是否来自 idle workforce”
- 用现有 `class` 体系扩展，改动最小，也最容易兼容当前明细渲染与 grouping

### 2.1 0 值 contribution 过滤规则

若某 race 或总站在当前计算结果下 `busyWorkers === 0`，则不生成对应 `class: 'workforce'` contribution。

若某 race 或总站在当前计算结果下 `idleWorkers === 0`，则不生成对应 `class: 'workforce_idle'` contribution。

规则目的：

- 避免贡献明细中出现 `0 x Workers` 或 `0 x Idle Workers`
- 避免 UI、排序和调试时把“概念上存在但数值为 0”的 contribution 混入真实消耗列表
- 保持 contribution 列表只承载实际发生的消耗

### 3. 分配精度

因为 `busyWorkers` 与 `idleWorkers` 可能不是整数分配到各 race 后的天然结果，建议：

- 内部允许使用浮点比例分摊
- 最终 flow consumption 保留现有浮点计算方式
- 不强制在人数层做整数取整

这样更符合 wareflow 的连续量模型，也避免比例四舍五入造成总量偏差。

## 与现有 live override 逻辑的关系

当前逻辑的问题核心是：

- `workforcesOverride` 被直接当作 `actualWorkforceOverride`
- 之后全部套用 busy 表

本次改造后，应将 live override 语义改成：

- `workforcesOverride` = 真实居民分布
- `actualWorkforceOverride` 不应再与 contribution 口径脱钩
- 共享后处理逻辑中用于效率与 contribution 的 busy 人数必须使用同一口径，即 `min(totalResidents, neededWorkforce)`

这样才能同时保证：

- 效率计算正确
- idle / busy 消耗正确

## Contribution 分类兼容

当前代码中有多处直接判断 `class === 'workforce'`。本次设计落地后，所有 workforce 类判断都必须升级为：

- `class === 'workforce'`
- 或 `class === 'workforce_idle'`

也就是说，分组、明细显示、supply 判断、workforce 标签翻译都要按“workforce 类”处理，而不是只识别 busy 一类。

## 兼容策略

- 若旧数据文件只有单层 race -> ware 结构，不满足新类型，运行时不应静默混用。
- 本次 change 应同步更新生成数据文件与读取类型，避免保留“旧结构也能跑”的模糊兼容。
- 若某 race 缺失，明确 fallback 到 `default`，但不得使用多层 fallback 链掩盖结构问题。

## 风险与注意点

### 风险 1：live 效率被意外抬高

如果继续把 `actualWorkforceOverride` 设成总居民数，而不是 busy 人数，就会在居民多于岗位需求时把效率错误拉满甚至掩盖问题。

规避方式：

- efficiency 口径必须基于 busyWorkers，而不是 totalResidents

### 风险 2：旧测试仍默认 busy-only

现有测试明显围绕“所有 workforceConsumption 都来自单套 consumption map”建立，需要在文档层先明确更新：

- live 有 `workforces` 时，测试断言要检查 idle + busy 合计
- blueprint 没有总居民时，仍只检查 busy

### 风险 3：命名误导继续扩散

若保留 `medicalConsumptionMap` 这种旧命名，后续实现很容易再次把范围理解错。

规避方式：

- 在本次改造中一并完成命名收敛
