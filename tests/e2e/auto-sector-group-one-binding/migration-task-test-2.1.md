# task-test-2.1 / M2.1 迁移映射与当前证据

状态：incomplete。自动 activeBindingStation 变化保护尚无有效 witness；恢复条件与对应未完成项见结果报告。16 个事务通过不等于整个 M2.1 完成。稳定共享输入已交接，不阻塞 M3。

目标基线 `d590ede41d41913ab18f5c5a18247bf956a4685a`，工作目录仓库根；使用 ENV 修复后的 preview readiness 与已验证构建。M1.1 helper 本轮只读，没有复制 helper、手工 import save 或回填 playerStationRecords。

## 当前口径

按最新 mode spec 使用查看/编辑/重算与重新计算，按 draft spec 使用 saved groups + 当前参数 Reset。当前 group identity 为 sectorMacro。无旧 Exit、calculationBaseline 恢复、UUID-first 产品变更。原 24 项中大量注释动作未实际执行，本轮合并为 16 个有 UI 动作和精确结果的事务；主 agent 已授权合并重复用例，保留原目的而不保留空壳数量。

## 原编号 → 当前验收 → 用户动作 → 独立 expected

| 原编号 | 当前用例与用户动作 | 独立 expected |
| --- | --- | --- |
| 1.1/1.2/1.3/2.1/2.4/3.2 | `三态与 sidebar 保留修改并恢复菜单`：检查 display 后进入详情，编辑颜色、查看/重算切换、overview 往返、reload | 3/4/5 display 三列与 calculate 三列；sidebar enabled、recalc 红点；virtual id 固定为 `f36126e5-7798-ed14-3c03-938b961efa0b` 且无 saveStationCode；草案改色跨菜单保留、reload 丢弃；菜单恢复 auto-sector-group |
| 2.2/4.1/4.2/5.1 | `Live Map 双向共享颜色与 virtual 删除草案`：Live 改透明色→Map 检查真实 chip CSS→Map 改另一预设色并删除 virtual→Live→Map | 两次不同颜色双向保留；virtual 明确从 1 变 0；持久化 binding 完全不变，未确认删除不落盘 |
| 2.3/1.1.5/3.4.2 | `binding context 切换丢弃旧草案，删除当前 binding 清空详情入口`：UI 载入 B，再载入 A，删除 B 与 A 后 reload | GUID/time 分别为 B/1345095.294、A/667632.933；返回 A 丢弃未确认颜色；删除全部后 activeBinding/result 均 null，sidebar disabled |
| 2.3.3 | `同 GUID archive time UI 切换重新初始化唯一 draft`：fixture 固定 T1→UI 改色→Maps 选择 T2 | 点击前明确 T1=667632.933，点击后 T2=700000；GUID 保持 A，未确认色丢弃 |
| 3.1 | `显式计算`：切重算，阈值选 20M，点击重新计算 | prefThreshold=20000000，切回查看，result groups 非空，binding 和 saved pill baseline 未变化 |
| 3.3 | `重置`：UI 改色、改变当前 threshold 后 Reset | 恢复原 hub 颜色，保留 threshold=20000000，保留 GUID/time，saved binding/pill baseline 不变；virtual 回到初始化内容。不比较整个算法 result |
| 1.4/3.5/5.6 | `确认成功`：UI 改色、逐个选择 virtual trade、确定、reload | 持久化颜色、sectorMacro 顺序、coverage、connections、jumpRange 与 UI 所编辑 draft 的内容一致；无持久化 group.id；applied time=667632.933；按钮 disabled、仍在 auto-sector-group，刷新恢复 |
| 5.2 | `防止 handleColorChange 直接写入持久化 binding`：UI 改色后直接 reload | 保存对象全量不变，未确认颜色丢弃 |
| 4.3 | `重算保留未确认 virtual 删除内容`：Map 删除 virtual→重算 | virtual 仍为 []；持久化 binding 不变 |
| 3.3/5.3 | `Reset 同时恢复 virtual 与颜色草案`：真实改色、Map 删除 virtual、Reset | virtual 完整恢复为原 draft，hub 原色恢复 |
| 4.5 删除边界 | `virtual 删除确认仅移除无 saveStationCode 计划并持久化`：Map 删除→Live 确认→reload | virtual plan 消失；saveStationCode/name/modules/settings 与原计划内容完全一致；刷新仍无 virtual |
| 5.4 | `normalizeState 保留新增字段与迁移 sectorMacro 引用`：版本化存储初始化 owned patch→reload | applied time=1345095294，prefJump=2、bridge=5、threshold=500；KXN-018.groupId 为 cluster_100_sector001_macro，原 A 连接为 cluster_48_sector001_macro；group.id 不存在 |
| 3.4/5.5 | `等分候选 trade gate 阻止确认，真实选择后保存`：原始 archive fixture 克隆同分 KXN 候选→UI 改色→确认 disabled→UI 选择 virtual trade | 等分候选未选时 gate disabled 且无 popup/写入；真实选择后 enabled，直接确认保存 applied time |
| 3.4/3.6 | `未决分配 popup 取消不保存，再次确认进入已保存态`：单 hub、jump=0 的已保存 fixture 产生未决 assignment→改色→确定→取消→再次确定 | uncertain 可见；popup 主次按钮；取消后持久化完整不变；再次确认保存 applied time，按钮 disabled、新增高亮清除 |
| 4.4 | `coverage 丢失保留未分组 virtual，Reset 恢复归属`：fixture virtual 位于 cluster_106 coverage→真实 hub jump=0→Virtual tab→Reset | 原 groupId=A，编辑后 groupId=null、未分组行数=1，Reset 后恢复 A |
| 4.5 创建/更新 | `Map pointer 创建并移动 virtual，确认后刷新恢复`：空白源真实 Mouse API 拖到 A，列表中再次拖动同一个新 id→确定→reload | preview 可见；draft 数量 1→2→2；新站 name/type/modules 为固定默认值、无 saveStationCode；sector/group=A、position 确实改变、同 id 保存并刷新恢复 |

### 验证界限与旧步骤替代

- 最新规范的自动 activeStation 变化保护，与旧 1.3.5“显式点击 station 也不切菜单”不同。现有 public sidebar selectStation 明确选择 station workbench；本轮不通过写 store 来伪造自动事件，自动变化保护没有单独 E2E witness，交主 agent 审查。
- 未以 monkeypatch 算法调用计数替代行为：模式/面板切换采用未保存颜色和 virtual 删除的保留、saved baseline 不变证明没有重新从 saved binding 覆盖 draft；这些断言不声称能证明算法内部调用次数。
- Confirm 通过真实成功动作、persisted groups、virtual 计划与 reload 证明端到端保存；live flow 数值不在本文件做独立算法 oracle，归 Live consumer 场景。
- 原旧 3.3.5“不重新运行算法”、3.4.1“edit 一律拒绝”、3.5.6“确认回到 display”、计算完成 baseline 捕获已被明确的新规范替代；原清单保留在 OpenSpec e2e_test_tasks.md 的历史段。

## 稳定 fixture 与消费者交接

- `loadLiveBindingFixture` 保持零 diff；初始化之外业务状态均来自 UI。page.evaluate 仅加载 fixture、只读提取业务结果和 localStorage；沒有直接 set result/initAutoGroupDraft/saveBinding 代替用户操作。
- `context-switch-save.patch.json` 改为真实 A GUID、time 700000、filename `M2 later`，同 GUID 测试通过 helper transformSaves 消费此 patch；初始绑定固定 T1，避免目标已 active 的弱 witness。
- `normalize-fields-db.patch.json` 保留 v1/旧 UUID 输入，专门验证加载迁移，已接入用例；不是当前正常运行的 group 身份。
- core/map 只接收上述 fixture/身份/UI 契约；不复用本测试运行中的 browser context。
- 原 `[auto-sector-confirm]` 调试日志监听迁移到 beforeEach，保留全部输出。

## 当前执行与失败保留

所有日志/trace 在 `/tmp/x4-migration-M2.1/`，完整命令与 exit/count 见 direct-migration/results/M2.1.md。

- baseline-reset：exit 1，1 failed；旧 full-result 深比较与 Reset 重算不相容。
- focused-core：exit 1，3 failed；测试误把 hub 名称当已保存中文 group 名，locator 未命中。
- focused-core-corrected：exit 1，1 passed/2 failed；20M 重算不保证原 hub 保留，默认 fixture 已解决 assignment 不应强求 popup。均 test-owned setup/oracle，迁移至 anchor 身份/独立 gate fixture。
- consolidated：exit 1，10 passed/2 failed；未固定时间会初始化为最新、删除当前但保留 B 后 reload 会载入 B。按明确初始 T1 与全部 binding 删除改正。
- gate：exit 1，1 failed；缩小所有 hub 并未产生预设 uncertain，旧测试前提不足；改用持久化单 hub/0 jump 输入，不注入算法结果。
- focused-boundaries：exit 1，4 passed/1 failed；reload 后 archive 暂态 null，改 waitForAppReady 与只读 poll。
- focused-pointer-time：exit 0，2 passed（21.1s）。
- final：exit 0，16 passed/0 failed/0 skipped（1.5m）。
- final-patch：exit 0，1 passed（9.1s），覆盖最终 owned context patch 接入。
- collection：exit 0，16 tests/1 file；diff check exit 0。无产品候选、无未解释失败。没有删除历史失败日志或使用旧弱通过充数。
