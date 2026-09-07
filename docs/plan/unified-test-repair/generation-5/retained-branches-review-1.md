# Generation 5 retained branch review 1

本记录汇总 9 个 retained branch 的独立 reviewer 返回结果。评审按当前已接受规范、generation-5 task contract 和 `develop` 基线进行。失败数量本身不构成拒绝合并理由；拒绝或暂缓只记录合同违反、过时测试假设、证据不足、重复候选或未达到父任务边界。

| 顺序 | 分支 | 候选 | reviewer verdict | 处理 |
|---:|---|---|---|---|
| 1 | `workflow/unified-test-repair-retained-task-test-1` | `e5951858e470d275b9969aa213be2006e3ae2b2a` | `changes_required` | 保留修正；不得直接合并，回到 parent `task-test-1` |
| 2 | `workflow/unified-test-repair-retained-task-test-5` | `b2060a45d41697593e09ac405a9064f436cc5fd1` | `drop` | 丢弃；被 postfix 候选完全覆盖 |
| 3 | `workflow/unified-test-repair-retained-task-test-5-1-postfix` | `f9294c3292a045375f272c8c3ad12cec0e5130ea` | `changes_required` | 保留修正；只能经 parent `task-test-5` 汇合 |
| 4 | `workflow/unified-test-repair-retained-task-test-7-1` | `3a047bab582e208623e6b0b56535684e330b0209` | `changes_required` | 保留修正；回到 parent `task-test-7` |
| 5 | `workflow/unified-test-repair-retained-task-test-8-1` | `efa3d232d9e279d4aaa5d7fe6ebf0a4814eb947d` | `changes_required` | 保留修正；回到 parent `task-test-8` |
| 6 | `workflow/unified-test-repair-retained-task-test-8-2` | `e2f182a5ce7523b86972dc2799861a88e9d99741` | `changes_required` | 保留修正；回到 parent `task-test-8` |
| 7 | `workflow/unified-test-repair-retained-task-test-8-3` | `98dc4532f75143077d0dae2d0b2f91ae60de88cf` | `changes_required` | 保留修正；回到 parent `task-test-8` |
| 8 | `workflow/unified-test-repair-retained-task-test-13-1` | `d852d943eca26c005f8894651642b726271a9ad6` | `changes_required` | 保留修正；回到 parent `task-test-13` |
| 9 | `workflow/unified-test-repair-retained-task-test-14-1` | `88f5378164328d5ba2d41e2cfe8c41b20096d437` | `changes_required` | 保留修正；回到 parent `task-test-14` |

## Review basis and routing

### 1. task-test-1.1 — changes_required

可复用部分是同目录枚举 filename/save 配对、双时间戳、手动选择 GUID/时间/filename/validity/compatibility、reload 和 KXN-018。当前候选仍以不同 GUID 构造 archive，不能证明同 GUID 下“更新的 invalid 被拒绝、较旧 valid 被选中”；fixture 预选 valid archive 也绕过了该场景。候选还持久化了应由运行时计算的 `isCompatible/isValid`，使用了禁止的 `liveStore?.playerStationRecords || []` fallback，迁移文档未对齐当前候选。

### 2. task-test-5.1-old — drop

postfix 候选与该分支的 3 个可执行测试文件 blob 相同，并增加了后续证据；旧候选没有独立可复用内容。丢弃依据是候选重复并被完全覆盖，不是测试失败数量。

### 3. task-test-5.1-postfix — changes_required

重排上下文、group identity、语义化 tab/race locator 具备保留价值。仍需修正 `v-show` 节点上的 `toHaveCount(0)`、把 Energy Cells 从非法拖拽输入中移除、避免 `groups[0]`、避免由被测 `getWareGroupStatus` 推导期望值，以及清理 fallback/弱断言；迁移文档的失败归属也需与权威报告一致。

### 4. task-test-7.1 — changes_required

fixture 生命周期和 sidebar testid 方向正确，27 个测试保留且没有 skip/fixme/only。仍需验证默认空 empire 与 `activeStationId === null`，完成删除确认及 ID 消失断言，统一相互冲突的 reorder 期望，修正按 `nth(i)` 命名站点、旧 locator、fallback、retry 和未完成 smart-save 的弱断言。

### 5. task-test-8.1 — changes_required

移除 shipBuildStore 直接访问、采用 map URL、补齐 fixture 生命周期、修正 hover 大小写方向具备价值。仍有旧 map locator、缺少当前 IndexedDB archive、条件式通过、搜索 helper 覆盖输入、大小写错误的 Cluster ID、tooltip 自比较/错误元素/资源名范围/拖拽跳过；迁移文档与当前 46 场景及候选 SHA 不一致。

### 6. task-test-8.2 — changes_required

移除 shipBuildStore 直接写入并使用 map route、language、resource tab，fixture 生命周期方向正确。当前多数断言只证明“有 candidate/score/panel”，仍缺少精确 resource/hub/set/score/jump/pie/focus 行为；存在条件式通过、旧 locator、uppercase resource ID 和不可达 postcondition，迁移文档也缺少完整场景映射。

### 7. task-test-8.3 — changes_required

移除固定 173/88 计数并保留 fixture 生命周期，20 个测试结构可复用。仍使用 uppercase Cluster ID、可空通过的 `toHaveCount(0)`、弱 gate/resource/address/search/reload oracle 和旧 locator；map-dlc 的产品能力问题必须在精确 witness 建立后再分类，迁移文档需逐场景补齐。

### 8. task-test-13.1 — changes_required

目标、名称、标签、只读和 unmatched/user-goal 断言有改进，保留 8 个原场景及 1 个 bug 场景。fixture 未注入 `x4_game_version`，当前默认 9.0 会读取 `x4_logic_flow_plans_v9`，导致注入的旧 key 不生效；还需确定性选择有效 logic-flow、明确方向、按 moduleId 语义验证去重、补齐 `graph === null`/`sccGroups === []`，移除条件式语言设置，并补建 migration task 和完整证据。

### 9. task-test-14.1 — changes_required

Energy Cells x1/x520/12m 的精确断言可保留，且没有 skip/fixme/only 或直接 store 访问。当前 3.3 是 fixture/setup 问题：缺少版本 key，未通过 UI 选择 logic-flow-1/build-material；还需精确验证 module/material/time、重叠生产去重、totalCredits、preview 责任，并补齐 scenario 映射和完整证据。

## Merge decision

评审 verdict 保持原样，但根据用户随后明确指令，已按上述顺序将 8 个 `changes_required` 候选直接合入 `develop`：`518dfc55`、`b3c1ccb8`、`949e132c`、`15c73a83`、`055854ba`、`5482dce1`、`22e55c4f`、`d590ede4`。这些合并不等于任务通过；parent review、合同修正和可用 runner 上的证据仍未关闭。8 个已合入 retained 分支引用随后删除。第 2 个旧 task-test-5 分支已按 `drop` 决定删除。runner connection refusal 等环境不可用项不被当作产品失败，也不单独阻塞可审查性。
