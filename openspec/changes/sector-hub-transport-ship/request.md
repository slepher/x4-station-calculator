# sector-hub-transport-ship 变更请求

## 目标

在 live transit hub 页面为运输路线增加“指定运输船配装”评估能力。用户在 transit hub 建筑区下方选择已收藏的运输船/货船蓝图后，右侧运输路线在现有距离与星门信息基础上额外展示按该配装计算的耗时与单程吞吐量。

## 已确认方案（审核重点）

### 入口与选择状态

- 在 transit hub 建筑区下方显示运输船选择区。
- 选择状态放在 `useLiveProductionStore`，不持久化到 localStorage 或 binding state。
- 切换 active transit group 后保留同一个选中蓝图；只有蓝图不可用时自动清空。
- 未选择运输船时，右侧运输路线保持现状，不显示新增耗时/吞吐量字段。

### 候选来源与过滤

- 候选来自 ship-build 已收藏蓝图。
- 只包含对应 `ship.type === 'freighter' || ship.type === 'transporter'` 的蓝图。
- 候选必须有有效引擎配装，可计算 `V_base`、`V_travel`、`travel.charge`、`travel.attack`、`travel.release`。
- 不可用蓝图过滤掉不显示；如果当前选中蓝图变为不可用，则自动清空选择。
- 候选按飞船分组：
  - 分组标题显示飞船名与 container cargo。
  - 分组按 container cargo 从大到小排序。
  - 组内蓝图按配装巡航速度 `V_travel` 从高到低排序；相同则按蓝图名排序。
  - 蓝图行只用蓝图名作为主 label。

### 选择区 UI

- 无候选收藏蓝图时，显示提示用户去 ship-build 收藏运输船蓝图，并提供“前往船只建造”按钮。
- 有候选但未选择时，在候选列表上方显示“选择运输船以计算耗时与单程吞吐量”。
- 蓝图行以小 chip 展示计算输入和参考值：
  - 速度 `V_base`
  - 巡航速度 `V_travel`
  - 充能时间 `t_charge`
  - 加速时间 `t_attack`
  - 加速距离 `d_attack`
  - 减速时间 `t_release`
  - 减速距离 `d_decel`

### 耗时计算口径

- 使用真实 route segment 距离，不使用 QSNA 固定 `1000km` 标准航程。
- route builder 保持现状，仍允许 superhighway 作为路径段出现。
- **普通空间段** 采用 QSNA-style `charge + attack + cruise + release` 模型，使用引擎参数。
- **highway 段**（sector 内蓝色环道）使用固定速度 **12,000 m/s**，不涉及引擎加速减速。
- `gate-transit` 与 `superhighway` 不计耗时。
- 短距离达不到最高巡航速度时，使用峰值速度模型，不使用线性 attack 截断。
- `travel.charge`、`travel.attack`、`travel.release` 聚合时取有效引擎中的最大值；推力与巡航推力按数量累加。
- **S/M 船可用 highway，L/XL 不可用**。未选船时默认非 highway 方案。
- route builder 不再默认固定截断为 3 条路径候选；选择运输船后先按船型构造候选池，再按真实总耗时最短选择，其次按普通距离最短选择，仍相同时取原始枚举顺序最靠前的候选。
- L/XL 船候选池只使用 `gateCount` 与 `normalDistanceKm` 判断优势；S/M 船候选池使用 `gateCount`、`normalDistanceKm`、`engineDistanceKm`、`engineGateCount` 判断优势。
- 不同路径候选即使经过同一 sector，也必须按该候选的具体 segment 端点独立计算 highway 替代方案。

### 吞吐量口径

- 固定使用 `container` cargo capacity。
- 单程吞吐量公式：

```text
throughputM3PerHour = containerCapacityM3 / oneWayTimeSec * 3600
```

- 单位显示为 `m3/h`，取整数。
- 若总耗时为 0，则吞吐量不计算。

### 右侧运输路线展示

- 选择运输船后，Sector Group row 以 metric chip 显示总耗时与单程吞吐量。
- Sector Group 展开明细中，每个普通空间路径段显示该段耗时；`gate-transit` 与 `superhighway` 不显示耗时。
- Station 分类中：
  - 若 station 与当前 hub 同星区，sector header 依旧不显示，只显示 station row 的耗时与单程吞吐量。
  - 若 station 与当前 hub 不同星区，sector row 显示到目标 sector terminal 的耗时，sector 展开明细像 Sector Group 一样显示每段普通空间耗时。
  - 跨星区 station row 显示星区内耗时、总耗时、单程吞吐量。
- 耗时显示格式：
  - 小于 60 分钟：`Xm Ys`
  - 大于等于 60 分钟：`Xh Ym`

### 数据结构倾向

- 新增耗时/吞吐量信息使用嵌套 `travel` 对象，不把字段散落到 row 顶层。
- station row 的 `travel` 固定包含 local 与 total，同星区时 local 等于 total。
- 同星区 station group 由 presenter 输出 `hideSectorHeader: true`，Vue 不用距离值猜测业务状态。

### 测试准备方向

- 后续测试应构造新的 fixture，添加少量明确收藏蓝图。
- 大量收藏场景通过 patch 形式叠加，不把主 fixture 膨胀为巨大列表。
- 样本应覆盖 M transporter、L freighter、同一 ship 多蓝图、排序、不可用蓝图过滤/清空、右侧新增字段展示。

## 边界

### In Scope

- transit hub 页面运输船选择 UI。
- 收藏运输船/货船蓝图候选筛选、分组、排序与空态。
- 指定配装 travel 参数聚合。
- 真实 route segment 的耗时估算。
- 右侧运输路线耗时与单程吞吐量展示。
- 当前选择状态的非持久 Pinia 状态。
- build 验证。

### Out of Scope

- 不计算 superhighway 耗时。
- 不引入 AI、驾驶员星级、IS/OOS、align、gate 固定等待、靠站时间等模拟。
- 不修改 Rust parser。
- 不新增测试代码或执行测试；测试由后续 `/x4:test` workflow 处理。
- 不把运输船选择持久化到 binding 或 localStorage。

## 验收标准（DoD）

- transit hub 建筑区下方能看到运输船选择区。
- 无收藏运输船蓝图时显示收藏提示与前往 ship-build 的入口。
- 已收藏的 freighter/transporter 蓝图按飞船分组展示，分组与组内排序符合 cargo 与巡航速度规则。
- 不可用蓝图不出现在候选中；当前选择变不可用时自动清空。
- 未选择运输船时，右侧运输路线保持原有距离/星门展示，不显示新增指标。
- 选择运输船后，Sector Group、Station sector、Station row 按已确认规则显示耗时与单程吞吐量。
- 选择运输船后，多条路径候选按真实耗时选择最终展示路径；未选择运输船时仍按普通距离选择。
- 路径明细只为普通空间段与 highway 段显示耗时；gate transit 与 superhighway 不显示耗时。
- 单程吞吐量固定使用 container cargo，显示为整数 `m3/h`。
- 代码实现完成后 `npm run build` 通过。

## 未决项

无。
