# M3.1 当前 core E2E 迁移

状态：incomplete，非玩家 hub 默认 virtual 选择为产品候选。原 34 个函数包含条件执行、空壳、全 result 相互比较；改为独立事务。下面没有 witness 的有效验收继续未完成，未被合并后的通过数覆盖。

## 当前输入

统一只读 `loadLiveBindingFixture(page)`。普通场景真实 fixture → reload → UI 中文。applied fixture 仅在初始化阶段把当前 versioned binding 的 appliedAutoGroupArchiveTime 设为 A 的 667632.933；运行后全部操作走 UI。

候选测试从 beforeEach 已经实际经产品后处理的 selectedArchive 读取完整快照，断言版本等于源码 CURRENT_POST_PROCESSOR_VERSION，再用 helper 初始化合成站，未简单给原 v12 数据改版本。站位置和基础身份采用有效原站数据，合成站 code/component_id 唯一，不携带原 KXN 的错误 factory/profile 衍生信息。模块填 ref/amount/module_id/type/group；built containers 表示已建数量，construction 仅有测试指定的额外在建 1M。Game data 的 Argon L container/solid/liquid 各 1M；foodrations 每个模块是一条生产线。expected 独立为 cap/(1+ln(1+prodLines))，5M built + 1M construction=6M，solid/liquid 各50M都排除。raw7/display5固定名单，不调用被测筛选算法计算 expected。

## 原编号映射（细项未列入 witness 者仍未完成）

| 原编号 | 当前行为与 UI 动作 / 独立 expected | 当前 witness / 未决 |
|---|---|---|
| 1.1 | 新 GUID clean slate 创建及纯 hub/assignment | 未完成：本轮尚无新 binding + 独立 graph fixture 事务，原空壳不构成证据 |
| 1.2 | applied baseline reload 后 hub3跳、sectorMacro身份 | baseline事务覆盖1.2.1/2/4；1.2.3新增玩家sector增量未完成 |
| 1.3 | built5M+construction1M；container-only；固定score | raw/top5事务覆盖1.3.1/2与score公式；1.3.3影响归属及1.3.4等距30% assignment未完成 |
| 1.4 | MST 距离边界与双向边 | 未完成：旧双向自洽循环不证明独立图预期，需有界双向图fixture |
| 1.5 | 多bridge gate / 单bridge自动采用 | 未完成：需要可证明连通分量和候选数量的独立fixture |
| 2.1 | 查看显示本地化小行星带、虚拟trade、3跳、无retain | baseline事务；旧“无pin”被当前mode允许固定/取消固定替代；统计数量细项尚未独立验证 |
| 2.2 | 编辑无retain，重算三个retain；unpin禁用，保留hub；切查看无Exit | baseline事务；原2.2.1/6按当前mode迁移；其他删除规则在玩家hub事务 |
| 2.3 | 水星coverage×→candidate+→恢复 | coverage事务覆盖1/2/4；transfer以及assignment默认/排序同步尚未完成 |
| 2.4 | hub3→0清空coverage，0→3只恢复水星，连接不变 | coverage事务；受影响assignment默认和他组不被抢占尚未独立验证 |
| 2.5 | 水星standalone末位且初始不选 | standalone事务覆盖5/6；当前命中全量、扩展最小层、baseline重新吸收未完成 |
| 2.6 | 用户选择水星standalone，card名单/顺序/displayBucket不变，重复点不建第二组 | standalone事务覆盖1/2；其他card选择不受影响细项未完成 |
| 3.1 | 添加菜单小行星带disabled | 玩家hub事务 |
| 3.2 | 添加水星hub，从小行星coverage移除且无水星ordinary card | 玩家hub事务覆盖1/2/3；手动hub候选名单/default独立细项未完成 |
| 3.3 | 添加无玩家站大交易所 I，不创建虚拟生产站，不修改archive | 非玩家hub事务；**默认virtual失败，保留soft断言使隔离断言也执行** |
| 3.4 | 删除新水星hub，card消失，水星返回assignment；所有连接/option无已删引用 | 玩家hub事务 |
| 3.5 | 删除trade card无残余；重复standalone不建重复hub | 玩家hub + standalone事务 |
| 4.1 | 7个raw正容量候选，不保留ZERO；top5固定P1/P2/P3/PURE6/PURE5；全零保留两站；非玩家仅virtual候选 | raw/top5、全零、非玩家事务；未从被测result切片产生expected |
| 4.2 | pure最高选PURE；混合生产领先无默认；全生产2:1选A；全生产1:1无默认 | 四个参数事务；无玩家默认virtual为产品失败 |
| 4.3 | 保存BHW-834保留trade后重算；再手选RWC-785并保存reload | retained player事务 |
| 4.4 | 等分/混合trade未决时改色仍confirm disabled，手选virtual | 两个未决候选事务；bridge gate未完成；uncertain旧disabled改为弹窗，未分组事务验证弹窗确认 |
| 4.5 | virtual无saveStationCode、保留中心position与anchor；player写RWC-785，reload | virtual确认 + retained player事务 |
| 4.6 | virtual trade拖动只改位置、不改anchor/coverage/plan | 未完成：旧case仅读取字段；生产虚拟站拖动不能代替trade拖动 |
| 5.1 | sectorMacro对应同一组，无重复；旧UUID优先由新规范替代 | virtual确认事务 |
| 5.2 | hub半径2/空coverage、groups固定身份、virtualtrade与reload | virtual确认事务覆盖1/2/4/5；连接实际修改后的持久化与移除废弃group未完成 |
| 5.3 | applied group24覆盖sector26；Map coverage pill聚焦，鼠标从已有虚拟站拖到26，groupId24而sectorMacro26，confirm/reload | 跨sector事务；5.3.2旧资源dashboard替换为当前工作台保持 |
| 5.4 | 跨sector虚拟站更新；脱离唯一hub coverage的虚拟站确认时删除 | 跨sector + 未分组事务 |
| 5.5 | 确认前后save-coded plans与已归一化快照完全相同 | virtual确认事务，不把旧UUID localStorage原始行当当前expected |
| 6.1 | solid/liquid不计容量 | raw/top5事务 |
| 6.2 | 单向superhighway不作双向MST | 未完成，需带明确lane_count=1路径的独立边预期 |
| 6.3 | 仅standalone无默认 | 未完成：水星有absorb可选，不能冒充无候选fixture |
| 6.4 | baseline unpin不删除，禁用retain | baseline事务覆盖1；重算输入排除细项未完成 |
| 6.5 | 两端retain off连接不作fixed edge | 未完成，需要能区分重算MST自然选边与fixed edge的图fixture |
| 6.6 | virtual不写__virtual__到saveStationCode | virtual确认事务 |
| 6.7 | 明确把BHW-834改选RWC-785、保存reload仍RWC-785 | retained player事务 |
| 6.8 | 5跳外无absorb/connected candidate | 未完成，旧spec中没有对应test函数，不能保留历史通过 |
| 6.9 | presenter/store reachability传递、不重复BFS | 未完成：这是结构性验收，本次未执行有效静态/unit witness，不能用UI通过宣称满足 |

## 失败溯源

- baseline：原2.3 pass、原5.3 preview缺失，1fail/1pass exit1。未固定当前coverage且使用旧sector→hub吸附预期。迁移改为applied fixture明确group24覆盖26、UI聚焦26后真实指针拖动，明确实际sector26。corrected轮该项已通过。
- migrated：8fail/3pass exit1；本地化名称、retain模式、宽泛candidate locator、可选baseline字段、旧UUID persisted snapshot、错误中文target名都是test-owned，均据当前规范/类型修正。
- corrected：3fail/8pass exit1；候选 fixture 的v12导致后处理重算modules，已换真实current-processed快照。
- fixture-corrected：4fail/2pass exit1；两个null/undefined oracle属test-owned；未分组路径本应有uncertain popup属test-owned；非玩家默认virtual缺失为product candidate。
- 所有失败日志/trace保留 `/tmp/x4-migration-M3.1/`；最终完整计数见 result 报告。

恢复条件：产品缺省选择失败由主agent派修并重建；其余未完成细项需补独立fixture/oracle和focused证据。共享helper及src未改，未完成图行为不阻止独立后续M3.2/M4合同。
