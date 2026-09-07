# FIX-M10.2-DIAG

只读诊断完成；只写本报告，未运行browser/build/测试、未改源码/测试。输入M10.2真实完整37pass/9fail，加独立纠正后composite38pass/8fail（不能称单次38/8）。本合同诊断5个行为/字段失败；3个布局问题冻结，等待用户裁决。

## 合同A：Fit唯一候选点击与数量

已确认三个原失败：Osaka weapon group部分1/2点击应补2/2；满2/2点击应清空；engine group总容量2但step1。规范依据 archived2026-03-05-ship-equipment-selector/spec.md单候选点击、简化模式补满、step=totalCount、二阶段更新。

真实链路：Workspace挂载PanelFit，slot按钮调用PanelFit:805 handleSlotClick，无条件openPicker；当前真正picker是ShipBuildPanelEquipment（Workspace:122），不是独立旧ShipBuildEquipmentPicker。后者的filters不是本修复入口。

PanelEquipment:95 extractPickerCandidates调用既有`extractEquipmentSlotCandidatesWithFacets`，输入shipMap/equipmentMap/selectedShip/slotType/size/target.tags及`isEquipmentDlcUsable`；base candidates不加race/MK/UI过滤。utility排除noplayerblueprint，校验type/size、真实connection refs和tags。单候选判断必须使用此兼容基线，不计UI的null空选项，不以picker临时race/MK过滤把多候选误判唯一；空/多候选仍走picker。Group通常按size+完整tag signature归并（Fit:471），不能只拿首connection的候选用于潜在异构目标；应证明所选候选兼容全部connection，父slot shield与独立shield都需对照。

数量链：Fit:827 `sliderStepForTarget`错用connectionKeys.length。`SlotTarget.totalCount`已经是容量和，one key可以count2；异构keys容量例如1+3，总数4不是2。Fit:842按容量比例和最大余数分配，目前可实现1+3目标总3→1+2、全满4→1+3；store:1420已有等价分配器供buildPreviewBlueprint使用，不应新写第三份。

store:1208 `applyConnectionAssignment`保留当前count（已有partial不会填满），所以只调用该动作不足以修唯一候选。需明确为每connection赋唯一装备并提交实际capacity；清空点击用null装备动作；parent shield需保持父装备及兄弟shield。store:1250 `setConnectionAssignmentCount`只clamp非负整数、无容量上限；UI或复用的target领域动作必须按真实capacity clamp，不能仅改HTML step后让实际store计数越界。

同闭包额外静态发现：规范同文件要求slider提交0保留装备ID。Fit:887 group commit对nextCount0调用applyConnectionAssignment(null)，会清ID；connection模式只setCount可保留。store:1477 group preview同样nextCount0置null，而setEquipment/cleanup本身允许非空ID+count0保留。这不是本轮新增浏览器失败，需focused Unit证实后同数量合同修正，避免只改step掩盖既有数量语义；不要把“点击清空装备”和“slider数值0”合成一个动作。

建议最小owned：

- `src/components/ship-build/ShipBuildPanelFit.vue`：只迁出本次target点击、step、数量preview/commit相关逻辑，模板消费presenter；不动宽度/行高/布局。
- 新`src/components/ship-build/presenters/useShipBuildFitPresenter.ts`：UI条件/唯一候选数量选择及动作，访问store；不在Vue新增store分支。直接复用现有候选utility，不建新适配层。
- `src/store/useShipBuildStore.ts`：复用已有capacity resolver/distributeCountByCapacity形成目标赋值/计数领域动作或最小公开能力，让实际commit与preview用同一个分配器；保留equipmentId在count0的数量操作，显式清空仍null。不要改变普通picker确认现有计数语义。
- 新`tests/unit/ship/ship-fit-single-candidate-count.spec.ts`；必要共用type仅在确需导出target接口时扩`fitTypes.ts`，不先扩。

focused Unit：实际mounted Fit/presenter+真实store验证partial→full→clear且不emit picker-open，0/2+候选仍emit，DLC/nonblueprint/tag不兼容排除，parent/standalone shield；Group step使用总容量，connection step1；异构1+3在0/3/4提交分别0+0/1+2/1+3、无越界、preview与commit一致、拖动实时不写蓝图、slider0保留ID但材料/stat不计。期望为固定capacity/装备ID，不能用被测分配器产生expected。有限消费者：ship-equipment-picker.logic、ship-equipment-selector、ship-build-equipment、ship-build-stat；新build后复验selector3.2/3.3/3.9和原46集合，布局失败独立保留。

## 合同B：Equipment字段与引擎摘要

两个原失败均在PanelEquipment。:246字段表刻意仅weapon包含burstDPS和5个热字段，turret被排除；:325 engine表漏thrustForward/boostMultiplier/travelThrust。canonical equipment-panel/spec.md:78/88要求这些字段；现有额外字段不用删除，验收是arrayContaining完整字段。

useEquipmentStats已有数据：turret和weapon走同一calculateWeaponDPS，返回全部字段；engine details已有thrustForward/boostMultiplier/travelThrust/travelCharge，不需要改物理公式。实际失败候选ARG M All-round Engine Mk1数据：forward960，boost.thrust7.38，travel.thrust10.51，charge8；当前显示3997应成为`3997:8`，不是编造缺失数值。travelThrust=10089.6由明确输入相乘。当前composable.summary仅speed/travelSpeed；PanelEquipment:490直接String(travelSpeed)，丢掉已有detail.travelCharge。

实际turret候选ARG M Beam Turret Mk1引用bullet_gen_turret_m_beam_01_mk1_macro；bullet数据damage126/lifetime3/reload7/range5000、charge0/shotHeat0/heat0，装备无heat。现有计算结果burstDPS=sustainedDPS54、singleDamage378、avgShotTime7；热时间字段按现算法输出0。这些0表达此计算没有热周期，不可改成虚构过热秒数；只恢复行显示。若后续决定用“不适用”显示，应另行明确规范/类型，不在本修复猜测。

summary消费搜索：生产代码只有PanelEquipment消费useEquipmentStats.summary，PanelStats使用details做聚合；Unit build-ship-equipment-panel已有数字travelSpeed契约。最少无需改composable接口：在presenter用既有details.travelCharge组装UI travel字符串，保留领域summary数字字段与所有其他消费者。

建议最小owned：

- `src/components/ship-build/ShipBuildPanelEquipment.vue`：模板改消费presenter字段/summary，不动picker race布局、分页或候选评分。
- 新`src/components/ship-build/presenters/useShipBuildEquipmentPresenter.ts`：迁入本次类型字段定义与metrics/summary展示组装，调用既有useEquipmentStats；保留current/target/diff/max及缺失候选语义，不新加fallback链。
- 新`tests/unit/ship/ship-equipment-canonical-details.spec.ts`。`src/composables/useEquipmentStats.ts`预期只读；若发现确实缺领域数值再精确扩域，不预先改共享数据接口。

focused Unit实际mounted Equipment/presenter+真实stats，固定beam54/range5000/热0全部turret字段可见；固定engine960/7.38/10089.6/charge8与给定ship.physics导出显式speed:charge oracle；shield/thruster及null/current-only/候选diff/max对照保留。有限消费者ship/build-ship-equipment-panel.spec.ts、ship/ship-build-stat.spec.ts；新build复验原turret/engine两项和整46集合，布局3项继续分账。

## 协作与未决

A/B源码默认不重叠（Fit+store versus Equipment），可独立合同；若A为了共享候选入口必须修改PanelEquipment，则先A落定接口再B，不能两位同时改同文件。首选复用既有候选utility避免交叉。共同build由主agent协调。

布局Fit2/3、race两行、展开两列/行高未获用户新基线裁决，本报告不修改它们或据此给完整46通过承诺。数量0额外问题仅静态证据，Unit必须先red后修；其他五项沿已有真实失败，不重试未变产品路线。
