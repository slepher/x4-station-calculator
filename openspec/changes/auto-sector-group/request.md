# 自动星区划分 (auto-sector-group)

## 目标

解决 Live Production 中星区划分需要大量手动操作的问题：用户在存档绑定后能够一键自动划分星区 group，系统根据中转站（hub）识别规则、星区跳数距离、产线反向评分等，自动生成 group 方案，并对不确定的情况提供候选供用户选择。

## 已确认方案（审核重点）

### 1. 入口与触发

| 场景 | 触发条件 | 行为 |
|---|---|---|
| 点击绑定按钮 (SaveList) | guid 无绑定 | 创建 guid 级绑定 → 载入最新存档 → 自动分组 → Col 2/3 展示结果 |
| 点击绑定按钮 (SaveList) | guid 有绑定 | 载入存档 → 判定是否有未分配到 group 的玩家星区 → 有则运行增量分配 |
| 上传新存档 (SaveUploadPanel) | 当前无任何绑定 | 创建绑定 → 自动分组 → Col 2/3 展示结果 |
| 上传新存档 | 当前有绑定，且属于该 guid，且是该 guid 最新时间 | 绑定迁移到新存档 → 运行增量分析 |
| 上传新存档 | 当前有绑定，属于该 guid，但非最新 | 不分析、不切换（guid 级绑定跟随最新） |
| 上传新存档 | 当前有绑定，属于其他 guid（该 guid 无绑定） | 创建绑定，不分析 |
| 上传新存档 | 当前有绑定，属于其他 guid（该 guid 已有绑定） | 不做任何事 |

### 2. Col 2 / Col 3 布局

现有 `LiveProductionWorkbenchView.vue` overview 模式布局（`grid-cols-12`，Col 1=3, Col 2=5, Col 3=4）：

| 列 | 内容 |
|---|---|
| Col 1 (3) | 上传存档 Card + 分组覆盖跳数 + 预制容量 + 存档列表 |
| Col 2 (5) | [确定栏] + 星区列表（含已有 group & 新 group），与 `MapBindingSectorGroup` 同形态 |
| Col 3 (4) | 存在未决时：星区分配 + 存疑列表；无未决时：`EmpireWareFlowsDashboard` |

**Col 2 确定栏**：`[分组覆盖跳数: ▼] [默认容量: ▼] [重新计算]`。分组覆盖跳数默认 2，仅影响新建 group；默认容量影响 hub 阈值。修改 group 跳数 → 点重新计算 → Col 3 刷新。

**Col 3 确定栏**：全部存疑解决 → [确定] 可用 → 一次性写入 `saveBindingStore` → Col 3 切换资源视图 → `ProductionSidebar` 更新。

### 3. 星区分配的交互

- Col 3 中每个 sector 一张卡片，上下排列候选选项（含「独立成组」始终作为最后一个选项）
- 算法自动分配的 → 对应选项默认选中（●）
- 存疑 → 全部 ○
- 用户点击任意选项切换选中 → Col 2 即时更新 group 构成（纯 UI draft，未写入 store）
- 不区分「已分配」和「存疑」两个区，统一列表，已分配只是有默认选中
- Col 3 card 的显示身份在算法生成时固定：`resolved` 表示算法已有默认选择，`unresolved` 表示需要用户决策
- 用户为 `unresolved` card 做出选择后，该 card 仍保持 `unresolved` 身份，不移动到 `resolved` 区，也不因 `selectedOptionIndex !== null` 被重新分类
- 用户选择 absorb / standalone / bridge 方案中心 sector 只更新 card 内部选中态和 Col 2 draft 预览，不改变 Col 3 中已有 card 的顺序
- 当前选中的 absorb（含算法默认选择）必须同步反映到 Col 2 目标 group 的 coverage 药丸
- 用户选择 standalone 后，其他可覆盖 sector 只追加指向新 group 的派生候选，不移除原始候选；若派生候选更优则自动切换选中
- standalone 撤销时，仅移除该 standalone group 派生出的候选；若当前选中项被移除，则在剩余候选中重选最佳项
- 只有显式 [重新计算] 或重新运行自动分组时，才允许重建 Col 3 card 顺序和显示身份

### 4. 自动分组算法

#### 4.1 Hub 识别

**数据来源**：`modules[]`（已建成）+ `constructions[]`（在建）。容量查 `modules.json` 的 `cargo.capacity`。

- 只计 **container** 容量，排除 solid/liquid（采矿用）
- Tier 1：`container_cap ≥ THRESHOLD`（默认 5M m³），score = `cap / (1 + ln(1 + prod_lines))`
- Tier 2：`container_cap < THRESHOLD`，score = `cap`
- Tier 1 始终排在 Tier 2 前
- 纯 hub = `qualified AND prod_lines == 0`

#### 4.2 星区距离

- 同 cluster 内 = 0（superhighway）
- 跨 cluster = cluster_gates BFS 层数
- 与 `saveBindingUtils.ts:buildSectorGraphFromMaps()` 一致

#### 4.3 纯净分组（无已有 group）

Phase A: 纯 hub (prod_lines=0) 建组，玩家星区贪婪分配到 jumpRange 内最近纯 hub
Phase B: 带产线 Tier 1 站 → 在纯 hub jumpRange 内则吸收；超出但在 5 跳内 → 存疑
Phase C: Tier 2 未分配 → 在 5 跳内自动吸收

- 两纯 hub 等距且 score 差距 < 30% → 存疑
- 带产线超 jumpRange 但在 5 跳内 → 存疑（吸收 vs 独立）
- Tier 2 超 jumpRange 但在 5 跳内 → 自动吸收（Tier 2 不能独立成 hub）

#### 4.4 增量分配（已有 group）

- 每个已有 group 用**自己的 jumpRange** 吸收新 sector
- 预制值仅用于新建 group
- 超出 group jumpRange 但在 5 跳内 → 需扩展跳数 → 存疑
- 等距多候选 score 相近 → 存疑
- 超过 5 跳 → 建议 standalone
- 新 standalone group 用分组覆盖跳数

### 5. 分配后的扩展与回退

- 分配超出分组覆盖跳数 → jumpRange 自动扩展到覆盖所需值 → BFS 扩展覆盖星区
- 撤销该分配 → jumpRange 自动回退到无需扩展的最小值 → 移除多余覆盖星区

### 6. Pin 机制

- 新 group 默认未 pin
- Pin 按钮启用后：视为已有 group，重新计算不影响其地位
- 仅 pin 后 & 已有 group 可编辑跳数

### 7. 确定栏

- Col 2 & Col 3 各有独立确定栏
- Col 2 确定栏含：分组覆盖跳数（默认 2，仅影响新 group）、默认容量（hub 阈值）、重新计算按钮
- Col 3 确定栏：全部存疑解决后可点，一次性写入 store

### 8. 绑定规则

- 绑定以 `gameGuid` 为主键，一个 guid 一个 `SaveBindingPlan`
- `selectedArchiveTime = null` → guid 级绑定，跟随最新存档
- `selectedArchiveTime = number` → time 级绑定，锁定特定快照

## 边界

**In Scope**：
- `LiveProductionWorkbenchView.vue` overview 模式三列布局改造
- 自动分组算法（纯净 & 增量）
- Col 3 交互（存疑卡片、候选选择、撤销、改为独立组）
- Pin 机制
- SaveList 绑定按钮行为修改
- SaveUploadPanel 上传自动分析逻辑
- Col 2 确定栏（分组覆盖跳数/容量、重新计算）
- 存入 `saveBindingStore` 的写路径

**Out of Scope**：
- `MapBindingPanel` / `MapBindingSectorGroup` 的改动（Col 2 同形态但非本次改）
- 地图覆盖高亮
- Terraforming 模块
- Research / Blueprint Recipe
- 生产侧栏搜索/筛选（后续改进）

## 验收标准（DoD）

1. 用户上传新存档（新 guid）→ 自动创建 binding + hub 识别 + 生成 group → Col 2 显示 group 列表，Col 3 显示分配/存疑
2. 已有 guid 无绑定 → 点击绑定按钮 → 同上
3. 已有 guid 有绑定 → 载入存档 → 有新增玩家星区则运行增量分配 → Col 2/3 展示
4. Col 3 中所有 sector 卡片可切换候选 → Col 2 即时更新
5. 全部存疑解决 → [确定] 可用 → 写入 store → Col 3 切换资源视图
6. 无未决 → Col 3 显示 `EmpireWareFlowsDashboard`
7. 超出跳数的分配 → jumpRange 自动扩展；撤销 → 自动回退
8. Pin 新 group 后 → 重新计算不消除其地位
9. Col 2 修改已有 group 跳数 → 点重新计算 → Col 3 刷新
10. Col 3 card 在用户选择后不改变生成时的显示身份和顺序
11. `npm run build` 通过

## 未决项

无
