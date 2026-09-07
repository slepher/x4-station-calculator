# M5.2 逻辑流交互迁移

基线 `d590ede41d41913ab18f5c5a18247bf956a4685a` 加已接受的 M5.1 helper/ENV 输入。工作目录为当前仓库，旧 lane/merge gate 不适用。三个 spec 保留 49 个可执行场景；下面逐项映射，不以旧通过或 collection 作为完成。

共同初始化：setupLogicFlow(page, 'clean')，db.json 排除 vsn，8.0/current logic-flow key，reload，再通过 language-select 切中文。状态由真实拖放、点击、编辑、hover 产生；evaluate 仅只读。helper 保持冻结。

## interaction 编号映射

| 旧编号 | 用户动作与当前行为 | 独立 expected |
| --- | --- | --- |
| 2.1 No Module | 拖 weaponcomponents 建组 | 无 No Module 文本；固定 module_gen_prod_weaponcomponents_01、default/manual，模块名可见 |
| 2.2 Teladi Context | UI 选 Teladi，拖 hullparts | module_tel_prod_hullparts_01、teladi/manual；teladianium 可见，refinedmetals 为零。旧 missilecomponents 使用通用 producer，不适合作为 Teladi 专用模块 witness；目的保留为 race context |
| 2.3 New Group | 点击普通视图新建区 | before/after 唯一新 groupId，nodes=[]，标题可见 |
| 2.4 Draggable crash | 真拖 hullparts | 一组、固定模块/manual；test-setup 保留运行时异常失败 |
| 2.5 T0 restriction | 真尝试拖 Ore/Energy Cells | 原始/Sortable/store 生命周期全 idle，无 +，完整 groups=[]；Ore tier0/locked |
| 2.6 normal control | 真拖 hullparts | 原生初始 draggable=true、tier2，一组固定 hull 模块/manual |
| 3.1 compact | hull 新建区 hover/release | grid-cols-4，真实 helper handshake，release idle，一组 |
| 3.2 smart insertion | weapon→siliconwafers→microchips 拖入同 groupId；duplicate weapon 开 compact | manual compact 顺序固定 weaponcomponents→microchips→siliconwafers（T3→T2→T1），microchips 固定模块，duplicate 释放全状态不变 |
| 3.3 duplicate | 同一 groupId 再拖 hullparts | 独立 duplicated UI + 完整 groups/nodes 不变，不调用 getWareGroupStatus 作为 oracle |
| 3.4 preview | hull 组 hover weapon 后 release | phantom 为 weapon 模块，已有 hull 模块仍可见，最终 weapon 固定模块/manual |
| 4.1 multiple groups | 分别拖 hull、weapon 至新建区 | 两个明确且不同 groupId，原组保留 |
| 4.2 existing target | weapon 投放 hull 所属 groupId | 原组 ID 唯一且不变，weapon 固定模块/manual |
| 4.3 connections | hull 建组 | 四条非能源 SVG 边，path 必须有实际 M/C geometry |
| 5.1b cancel outside | 真开始 weapon drag，移出至空白 release | hover 清空、idle，完整 groups/nodes 不变 |
| 5.3 empty routing | 两次 UI 新建空组，按捕获 ID 向第二/第一投放 hull/weapon | 两组 ID 次序不变，各自确切 manual/module；不依赖 groups[0] |
| 5.2 new-zone | hull 新建区真实投放 | 一组固定 hull 模块/manual |

## bug-regression 映射

原文件没有数字编号，以完整旧标题标识。

| 旧标题 | 当前 UI 行为与独立 expected |
| --- | --- |
| isolating a node removes its candidate preview | 明确隔离 refinedmetals，候选 planned 点移除、ore 消失；真实拖回同组后 fixed refined module/default、isIsolated=false、ore 和 planned 点恢复。旧任意首个有按钮节点命中 energycells；静态候选资源预览本来独立于组状态，这里验真正的规划标记 |
| isolated middle node keeps isolation and stops upstream preview | weapon 组隔离 hull，refinedmetals 消失；hover refined 仅新增 ore pulse，无 graphene compact 模块；投放后 hull 仍 EXT，refined 固定模块/default/manual |
| duplicate drops are rejected without adding a second node | explicit duplicated UI，完整组快照不变、hull 只有一个 |
| new-zone drop creates exactly one production group | 新建一组，固定 hull 模块/default/manual |
| leaving a hovered target before release cancels the drop | weapon hover 现有锁组→空白；hoverId null、琥珀基础样式、release idle、完整快照不变 |
| locked incompatible drops show rejected feedback and no preview | hull 建锁组，农业/Teladi spaceweed 拖入；explicit rejected 红框/标签/无 phantom，完整组快照不变。替换过期 Energy Cells 建组 |
| the same ware can coexist across two selected lineages | 关闭锁，default hull 与 Teladi hull 同组；固定两 module/lineage/manual 记录；weapon hover 可见双 hull 与 weapon phantom；release 后以两 producer DOM 端点到 weapon 端点验证两条 SVG 连线 |
| default hullparts auto node promotes through a real drop | weapon 创建前置 auto hull；真实拖 default hull，explicit auto UI，最终唯一 fixed default hull/manual |
| Teladi hullparts replaces a default auto node | 前置明确 default auto hull；UI Teladi 后真拖；explicit replace UI，最终唯一 fixed Teladi hull/manual |
| hovering a duplicate shows duplicate feedback before release | 悬停 duplicated 及释放分别验完整快照不变 |
| new-zone hover handshake precedes a single new group | 真 hover 时 groups=[]；release 后一组一个 weapon |
| leaving a locked target clears identity but preserves its base lock style | rejected hover→移出，hoverId null、拒绝标签消失、琥珀基础样式保留、release 完整状态不变 |
| candidate lock toggle is reflected in a UI-created group | UI lock/unlock 两次建组；按唯一 manual ware 找 IDs，第一锁/default，第二不锁，manual lineage 明确 |
| language switch updates candidate and planning UI | hull 建组，UI 中文→英文；候选和规划模块文字各自精确更新 |

## new-feat 编号映射

| 旧编号 | 当前 UI 动作与独立 expected |
| --- | --- |
| Test 1 | 点 hull 标题，文本输入可见且聚焦，确认按钮可见 |
| Test 2 | 输入“我的产线”并 Enter；标题和该 groupId.name 均精确相等。旧 customName 字段过期 |
| Test 3 | 编辑后通过 toolbar 点击 blur；恢复固定默认“船体部件”，name=''，无原文本 fallback |
| Test 4 | 先保存自定义名，再清空 Enter；默认“船体部件”和 name='' |
| Test 5 | 自定义名称后真实拖 weapon；weapon 出现，UI/name 保留自定义值；修复未定义 dragWareToExistingGroup |
| Test 6 | weapon hover；独立固定完整上游 ware 集合，排除 energycells |
| Test 7 | ore hover；精确 ore/refinedmetals/hullparts/weaponcomponents，下游到 T3 |
| Test 8 | refinedmetals hover；同一固定双向链集合，必须执行，不再 if-count 条件通过 |
| Test 9 | ore hover 后移出；先验证链集合，再验证节点/连接高亮全清空 |
| Test 9.1 | 真点击隔离 hull，见 EXT，再 hover；精确 hull/weapon 二节点，ore 消失。旧用例没有创建隔离状态便条件通过 |
| Test 15 | 当前 testid toolbar bounding boxes，flow 在 language 左侧；缺元素直接失败 |
| Test 16 | 当前 blueprint-production→flow UI 切换，candidate 隐藏/恢复与 flow 激活；旧“量化/Quantified”文案过期 |
| Test 17 | 保存 custom title，weapon hover 该 groupId；compact 标题精确，release 后 weapon 可见 |
| Test 18 | weapon 组 hover auto hull；header 恰为 helium/methane/ore，排除 energycells；release 后 hull manual |
| Test 19 | 保存确实超宽的自定义名，compact 保留完整文本、ellipsis CSS 和实际 overflow；release 后持久领域 name 不变 |
| Test 10 | 编辑输入当前背景/边框和确认按钮样式 |
| Test 11 | 切编辑前后真实 header 高度差 <5px，缺 box 失败，无数值 fallback |
| Test 12 | 明确 hover ore；必须有 highlighted-node 和蓝色 border/background，不再旧 .highlighted 条件通过 |
| Test 13 | ore hover 后恰三条高亮链路，实际 stroke/width/marker-end 验证，无条件通过 |

## 当前证据与失败分类

- 代表性 baseline（9 tests）：4 passed / 5 failed / 0 skipped，exit 1，日志 `/tmp/x4-migration-M5.2/baseline.log`。失败为任意隔离目标误选 Energy Cells、禁拖 Energy Cells 建组、Teladi witness 选错通用 producer、未定义 drag helper、旧导航文案，均 test-owned/stale。
- baseline 的 Test 9.1/Test 12 原通过不能证明行为：if 分支未进入。迁移必须无条件制造状态并断言，不将旧 pass 当验收。
- 首次 candidate full 主动停止：exit 130，1 failed/1 interrupted/47 did not run。隔离按钮 accessible name 实为符号，标题在 title 属性；改用确切 title locator，再运行完整 owned scope。无产品推断。
- 最终运行命令、exit/count、trace 和未决项在 `docs/plan/unified-test-repair/direct-migration/results/M5.2.md`。collection 本轮为 49 tests/3 files。

所有 browser 使用 PORT=22255、ENV preview-only、正常 chromiumSandbox=true，精确 escalation 授权；未改 src/helper/fixture，不 build、不 git 写入。曾在 M5.1 通过的四个消费者证据只作为输入参考；修改后的三文件仍需完整 focused 证明。

## 完整 focused 与产品边界

完整 focused：49 tests，48 passed / 1 failed / 0 skipped，exit 1，1.8m，`/tmp/x4-migration-M5.2/focused.log`。
唯一失败为 `the same ware can coexist across two selected lineages`：领域节点已有 default/Teladi 两个不同 moduleId，但 compact 双 hull 标签都显示通用“船体部件产线”。`LogicFlowPlanningZone.vue:getCompactNodeDisplayName` 用 wareId 查首节点，忽略当前 node.moduleId；这是违反模块独立显示的 product-owned 候选，本轮禁止修 src。

补充 `coexist-evidence`：将名称断言保持为 expect.soft（仍使 test failed），只为继续独立的 release 与双 producer→weapon SVG 端点验收。exit 1 / 1 failed，唯一错误仍是名称；后续 mouse release、idle、双 hull 保留和双连接端点全部执行通过。日志 `/tmp/x4-migration-M5.2/coexist-evidence.log`。不继续重试同一失败。

恢复原两个 spec 的 pageerror→console.error 诊断监听；保留普通视图中 default/Teladi 两个模块名断言，并按 moduleId 对应 nodeId 定位。此后只进行 collection-final（49 tests/3 files，exit 0）和 git diff --check（exit 0）；尚未对这两项最后修订做新完整 focused，不以旧运行伪称最终文件全通过。

恢复条件：主 agent 提供符合 moduleId 身份的产品显示修复及新构建，再完整复验 M5.2；受阻依赖仅 coexist compact 名称验收，其他 48 行为与已接受 M5.1 helper 不因此回退。

## 修复后闭环（当前结论）

独立 FIX-M5.2 按 node.moduleId 修复紧凑命名并移入 presenter；focused Unit 红绿通过，主 agent 授予独占窗口后的 npm run build exit0。随后切回本测试合同执行：

- `post-fix-coexist`：精确原失败，exit0，1 passed / 0 failed / 0 skipped，4.3s。
- `post-fix-full`：三个原 spec 完整，exit0，49 passed / 0 failed / 0 skipped，1.7m。
- `post-fix-collection`：exit0，49 tests / 3 files；`post-fix-diff-check`：exit0。

均使用 fresh dist、PORT22255、preview-only、workers1/retries0/trace on；日志 `/tmp/x4-migration-M5.2/post-fix-*.log` 与同名trace目录。原失败和补充soft证据保持原目录。最终诊断监听、普通/compact模块名、独立SVG端点验收均已包含，当前无未决失败，BUG-001 Verified，交主 agent 审核。
