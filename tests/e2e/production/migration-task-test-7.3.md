# M7.3 迁移映射与当前证据

状态：incomplete。97 项均保留原测试标题并收集；最终 focused 结果见 direct-migration/results/M7.3.md。星区来源的 4 项有效验收保持失败，不新增 skip，不将 savedEmpire 当作已确认替代规则。

## 初始化与交互边界

- 普通空间站：db.json 除 vsn 注入，显式 9.0 / 空 x4_empire_data_v9 version 5，reload、UI language-select、新增空间站。候选以稳定 module ID 精确选择。业务状态由点击、键盘、真实保存和 reload 产生。
- 资源菜单：消费 M5.1 setupLogicFlow(seeded)，追加一个空存档作为 fixture-only 负对照，再 reload / UI 语言 / UI maps；不修改 helper。
- 压缩率：消费 setupLogicFlow(clean) 与 dragWareToTarget，真实鼠标拖入 hullparts，按包含该节点的唯一 production-group 定位。无 drop/drag 事件注入。
- evaluate 仅 fixture 初始化、读取持久化或领域结果；expected 不调用生产计算函数。

## 独立 oracle 与旧目的对应

| 键 | 当前行为与真实用户动作 | 独立 expected |
|---|---|---|
| D1 | 新建站，查看仪表盘和默认标签 | 标题左于标签；Cost active；红色总成本和淡化乘号 |
| D2 | 添加能量模块、重复添加、添加船体模块、展开材料、调价格；切 economy | 静态 9.0 建材 260 claytronics / 951 hullparts / 520 energycells；重复正好倍增；高 tier 先、energy 最后；模块首次添加顺序；行总和等于summary；两价格滑块横排 |
| D3 | 能量模块切 wareflow-volume；调 primary buffer / 星标；比较 economy 控件 | 10,500/h × 12h × 1m³=126,000；24h=252,000；secondary2h=21,000；三个缓冲滑块横排 |
| D4 | 能量模块，查看工人统计并点击工人运算 | 单模块需求90；OFF→ON；当前 station-tabs 将旧自动工业标题控制移至toolbar |
| D5 | 切 dashboard-time；数量1→300 | 能量模块756秒=00:12:36；300×756=2D 15:00:00 |
| D6 | wareflow-volume看推荐量，展开说明；数量10并把primary12→24 | 126,000；明细10,500/h、12h；1,260,000→2,520,000，L仓容量1,000,000所以2→3 |
| D7 | 三个缓冲控件及UI中英文切换；primary8/20、secondary4 | resource范围0..24 step1；三个确切中英文label；84,000/210,000/42,000 |
| D8 | UI英语再中文；查看dashboard标签/材料/统计 | Cost/Time/Workers、Energy Cell Production、6项统计翻译；两语言总值都保留Cr |
| R | UI maps→资源高级→载入；菜单开闭、逻辑存档载入/编辑/刷新；空存档负对照 | 菜单fixed且位于panel右侧；Logic Flow1含3组7资源标签；第二组helium+ methane（quantumtubes配方），第三组ice；加载自动刷新、编辑pending；3个有资源plan且排除empty；sector3.2/3.3/3.9/3.12保持未满足 |
| W1 | 单能量模块，切四种wareflow视图、展开、加第二模块、中英文切换 | 10,500/h；均价16Cr给168,000Cr/h；只一个energy行和Product Income；第二模块21,000/h；视图标题/激活状态确切；运输和建设体积分开定位 |
| W2 | 船体模块，工人ON，锁graphene制造外购运营项；切quantity/economy | 产品→运营→补给→资源确切顺序；foodrations和medicalsupplies补给；支出为负；四组identity不变；组绝对金额等于行绝对金额之和（展示逐行取整误差界）；quantity无Cr |
| W3 | 手动能量+船体；点击星标/锁、切视图、UI命名保存、reload | 手动2↔1，自动graphene0↔1；三个星形SVG；ore disabled点击无效；保存JSON按activeId查帝国，单站priority.energycells=1；reload星标/锁身份保留 |
| W4 | dashboard-volume；运量62000→10000、加第二能量模块、真实保存reload | 6统计及红蓝绿；ceil(summaryVolume/10000)船次；新增模块体积260×24+951×12+520=18,172；持久化transportShipCapacity=10000 |
| W5 | clean真实拖hullparts；检查节点、隔离graphene、检查ore | 1176×12/(160×20+1120×14)四舍五入75%、绿色；graphene1440×20/(4800×6)=100%；隔离后EXT且百分比消失；ore没有百分比 |
| W6 | wareflow-volume看分组布局/推荐量；加hull得到三种货物；切语言/星标 | 14px标题；推荐126,000及图标；分组颜色与行背景；Container/Solid/Liquid确切顺序；推荐合计126,000m3→21,000m3 |
| W7 | hover星标/锁；UI语言切换 | 主/副产物12h/2h提示；锁定/未锁定；英语Primary/Secondary无原始key；能量中英文名称 |

## 原编号 → 新用例逐项清单

测试标题逐字保留；D/W编号为各原spec中的顺序，R还保留原章节号。当前行为、用户动作和独立expected由上表键及该标题共同定位。

| 原文件/序号/标题 | 当前spec行 | oracle |
|---|---|---|
| station-dashboard 01 — should render dashboard container with header title and view mode switcher | station-dashboard.spec.ts:52 | D1 |
| station-dashboard 02 — should show Cost tab as active by default | station-dashboard.spec.ts:62 | D1 |
| station-dashboard 03 — should display visual consistency for dashboard elements | station-dashboard.spec.ts:67 | D1 |
| station-dashboard 04 — should display cost summary with total value and material list | station-dashboard.spec.ts:76 | D2 |
| station-dashboard 05 — should group modules with quantity and allow expansion | station-dashboard.spec.ts:81 | D2 |
| station-dashboard 06 — should update total cost when price multiplier slider changes | station-dashboard.spec.ts:87 | D2 |
| station-dashboard 07 — should merge identical modules and maintain addition order | station-dashboard.spec.ts:92 | D2 |
| station-dashboard 08 — should sort materials by tier with Energy Cells at end | station-dashboard.spec.ts:99 | D2 |
| station-dashboard 09 — should aggregate identical modules with correct summary | station-dashboard.spec.ts:103 | D2 |
| station-dashboard 10 — should sort materials by tier descending with valid quantities | station-dashboard.spec.ts:111 | D2 |
| station-dashboard 11 — should display economy view price sliders in flex-row layout | station-dashboard.spec.ts:116 | D2 |
| station-dashboard 12 — should switch to volume view and display volume controls section | station-dashboard.spec.ts:125 | D3 |
| station-dashboard 13 — should display volume data with sliders indicating buffer calculation | station-dashboard.spec.ts:128 | D3 |
| station-dashboard 14 — should update volume when buffer time changes | station-dashboard.spec.ts:133 | D3 |
| station-dashboard 15 — should display total occupied volume with priority-based buffer | station-dashboard.spec.ts:134 | D3 |
| station-dashboard 16 — should affect volume when priority changes | station-dashboard.spec.ts:139 | D3 |
| station-dashboard 17 — should maintain consistent flex-row layout between volume and economy views | station-dashboard.spec.ts:144 | D3 |
| station-dashboard 18 — should display workforce stats bar with workers needed | station-dashboard.spec.ts:153 | D4 |
| station-dashboard 19 — should show workforce option in auto-industry header | station-dashboard.spec.ts:157 | D4 |
| station-dashboard 20 — should display build time in XD HH:MM:SS format | station-dashboard.spec.ts:169 | D5 |
| station-dashboard 21 — should display storage planning volume count in volume view | station-dashboard.spec.ts:182 | D6 |
| station-dashboard 22 — should show planning details in volume tooltip | station-dashboard.spec.ts:183 | D6 |
| station-dashboard 23 — should increase storage slots when buffer time increases | station-dashboard.spec.ts:190 | D6 |
| station-dashboard 24 — should display three buffer sliders in volume view | station-dashboard.spec.ts:205 | D7 |
| station-dashboard 25 — should have correct range attributes on resource buffer slider | station-dashboard.spec.ts:208 | D7 |
| station-dashboard 26 — should have functional primary product buffer slider | station-dashboard.spec.ts:213 | D7 |
| station-dashboard 27 — should have functional secondary product buffer slider | station-dashboard.spec.ts:217 | D7 |
| station-dashboard 28 — should have buffer slider labels with i18n text content | station-dashboard.spec.ts:222 | D7 |
| station-dashboard 29 — should have slider labels with resource and product buffer text | station-dashboard.spec.ts:226 | D7 |
| station-dashboard 30 — should affect volume calculation when buffer slider changes | station-dashboard.spec.ts:229 | D7 |
| station-dashboard 31 — should display English labels on dashboard | station-dashboard.spec.ts:237 | D8 |
| station-dashboard 32 — should display English stats bar labels | station-dashboard.spec.ts:244 | D8 |
| station-dashboard 33 — should display credits symbol with i18n | station-dashboard.spec.ts:250 | D8 |
| station-resource-group 01 — 2.1 状态: 高级模式载入按钮可见 | station-resource-group.spec.ts:85 | R |
| station-resource-group 02 — 2.2 状态: 载入菜单打开态 | station-resource-group.spec.ts:89 | R |
| station-resource-group 03 — 2.3 切换: 高级模式 -> 载入菜单打开态 | station-resource-group.spec.ts:93 | R |
| station-resource-group 04 — 2.4 切换: 载入菜单打开态 -> 载入菜单关闭态 | station-resource-group.spec.ts:98 | R |
| station-resource-group 05 — 3.1 Case: 显示载入按钮 | station-resource-group.spec.ts:105 | R |
| station-resource-group 06 — 3.2 Case: 打开载入菜单 | station-resource-group.spec.ts:118 | R |
| station-resource-group 07 — 3.3 Case: 载入星区空间站为组 | station-resource-group.spec.ts:127 | R |
| station-resource-group 08 — 3.4 Case: 载入逻辑组网存档为组 | station-resource-group.spec.ts:145 | R |
| station-resource-group 09 — 3.5 Case: 点击外部关闭菜单 | station-resource-group.spec.ts:166 | R |
| station-resource-group 10 — 3.6 Case: 刷新按钮无待刷新时隐藏 | station-resource-group.spec.ts:175 | R |
| station-resource-group 11 — 3.7 Case: 刷新按钮有待刷新时显示 | station-resource-group.spec.ts:185 | R |
| station-resource-group 12 — 3.8 Case: 载入后候选自动刷新 | station-resource-group.spec.ts:206 | R |
| station-resource-group 13 — 3.9 Case: 空星区过滤 | station-resource-group.spec.ts:219 | R |
| station-resource-group 14 — 3.10 Case: 空逻辑组网存档过滤 | station-resource-group.spec.ts:229 | R |
| station-resource-group 15 — 3.11 Case: 关闭面板时菜单同步关闭 | station-resource-group.spec.ts:239 | R |
| station-resource-group 16 — 3.12 Case: 载入项高亮显示 | station-resource-group.spec.ts:248 | R |
| ware-flow 01 — Title Style Verification | ware-flow.spec.ts:60 | W1 |
| ware-flow 02 — Switcher Button Style Verification | ware-flow.spec.ts:64 | W1 |
| ware-flow 03 — 3.1 View mode switching | ware-flow.spec.ts:70 | W1 |
| ware-flow 04 — UI Verification: Volume View Switch | ware-flow.spec.ts:77 | W1 |
| ware-flow 05 — 3.2 Profit analysis integration | ware-flow.spec.ts:82 | W1 |
| ware-flow 06 — 3.3 Resource list function | ware-flow.spec.ts:86 | W1 |
| ware-flow 07 — 3.4 Layout and interaction | ware-flow.spec.ts:92 | W1 |
| ware-flow 08 — 3.6 Economy view data display | ware-flow.spec.ts:98 | W1 |
| ware-flow 09 — 8.1 Economy view uses wareFlowList | ware-flow.spec.ts:99 | W1 |
| ware-flow 10 — 8.7 profitTotal from wareFlowList | ware-flow.spec.ts:104 | W1 |
| ware-flow 11 — 8.11 Economy text i18n | ware-flow.spec.ts:108 | W1 |
| ware-flow 12 — 9.1 Resource view uses wareFlowList | ware-flow.spec.ts:113 | W1 |
| ware-flow 13 — 9.5 Economy view display consistent | ware-flow.spec.ts:117 | W1 |
| ware-flow 14 — I18n Verification | ware-flow.spec.ts:123 | W1 |
| ware-flow 15 — Supply group display | ware-flow.spec.ts:140 | W2 |
| ware-flow 16 — Economy view supply expenses | ware-flow.spec.ts:146 | W2 |
| ware-flow 17 — Group order: Products -> Operations -> Supply -> Resources | ware-flow.spec.ts:153 | W2 |
| ware-flow 18 — 8.2 Economy view groups: Product Income / Operational Expense / Resource Expense | ware-flow.spec.ts:156 | W2 |
| ware-flow 19 — 8.4 Group sum netValue display | ware-flow.spec.ts:161 | W2 |
| ware-flow 20 — 9.3 Resource view same grouping as economy | ware-flow.spec.ts:171 | W2 |
| ware-flow 21 — 9.4 Resource view has no Cr values | ware-flow.spec.ts:178 | W2 |
| ware-flow 22 — 1.1 FavoriteButton 3-state icon render | ware-flow.spec.ts:186 | W3 |
| ware-flow 23 — 1.2 FavoriteButton state cycle | ware-flow.spec.ts:192 | W3 |
| ware-flow 24 — 1.3 FavoriteButton across view modes | ware-flow.spec.ts:197 | W3 |
| ware-flow 25 — Button visible but disabled for pure input solid wares (Ore) | ware-flow.spec.ts:206 | W3 |
| ware-flow 26 — Button visible for produced wares (Energy Cells) | ware-flow.spec.ts:211 | W3 |
| ware-flow 27 — 2.1 Product identity detection | ware-flow.spec.ts:215 | W3 |
| ware-flow 28 — 2.2 Priority state persistence | ware-flow.spec.ts:220 | W3 |
| ware-flow 29 — 4.1 Integration workflow | ware-flow.spec.ts:226 | W3 |
| ware-flow 30 — FavoriteButton availability in economy and volume views | ware-flow.spec.ts:234 | W3 |
| ware-flow 31 — Stats Bar Layout and Colors | ware-flow.spec.ts:250 | W4 |
| ware-flow 32 — Footer Controls: Transport Capacity slider and trips | ware-flow.spec.ts:256 | W4 |
| ware-flow 33 — Data Verification: volume increases with more modules | ware-flow.spec.ts:263 | W4 |
| ware-flow 34 — Persistence: transport capacity survives save and reload | ware-flow.spec.ts:269 | W4 |
| ware-flow 35 — 2.1 FlowNode displays compression rate | ware-flow.spec.ts:285 | W5 |
| ware-flow 36 — 2.2 Compression rate color coding | ware-flow.spec.ts:290 | W5 |
| ware-flow 37 — 2.3 Isolated node hides compression rate | ware-flow.spec.ts:295 | W5 |
| ware-flow 38 — 2.4 T0 resource node hides compression rate | ware-flow.spec.ts:302 | W5 |
| ware-flow 39 — 4.9 Volume group titles spacing | ware-flow.spec.ts:312 | W6 |
| ware-flow 40 — 4.10 Volume title info display | ware-flow.spec.ts:320 | W6 |
| ware-flow 41 — 4.11 Group header colors blend with WareFlow | ware-flow.spec.ts:324 | W6 |
| ware-flow 42 — Volume group i18n | ware-flow.spec.ts:328 | W6 |
| ware-flow 43 — Planning space display | ware-flow.spec.ts:334 | W6 |
| ware-flow 44 — 3.8 Volume analysis feature | ware-flow.spec.ts:337 | W6 |
| ware-flow 45 — FavoriteButton tooltip display | ware-flow.spec.ts:347 | W7 |
| ware-flow 46 — LockButton tooltip display | ware-flow.spec.ts:353 | W7 |
| ware-flow 47 — i18n tooltip key verification | ware-flow.spec.ts:358 | W7 |
| ware-flow 48 — 3.5 Internationalization language switch | ware-flow.spec.ts:365 | W7 |

## 规范与冲突

主规范：station-dashboard、station-resource-group、ware-flow-display、dual-buffer-calculation；补充volume-compression、station-tabs、button-tooltip-integration和wareflow-refactory。

station-resource-group/spec.md:8,27-32,49,60-72明确sector及所属station来源；当前MapResourceFilterAdvancedPanel.vue:913起却遍历savedEmpires，没有sector testid；logicflow来源仍可达。主agent检索活动及归档规范未发现sector→savedEmpire被确认的替代条款，故3.2/3.3/3.9/3.12保留当前失败和未满足状态。3.6/3.7/3.8原验收目的为刷新状态/自动刷新，改用规范本来就支持的logicflow来源，不等同于声称sector通过。

旧35个skip（dashboard11、ware24）均迁移为活跃测试；旧条件通过、错误tab索引、macro候选、宽泛第一个候选、吞保存错误已替换。当前推荐仓储说明通过allocation行展开读取，保持旧规划说明内容目的；建设材料体积与流量推荐量分别验证。
