# Generation 7 决策

## D01：当前代码是产品行为基准，替换旧代执行权威

- Decision: 用户已批准“以当前行为更新旧 E2E，可重写、补写，不要求 1:1”；新建 generation 7，不覆盖 generation 6。旧规范不能授权恢复产品代码。
- Evidence: 本次用户确认与“通过，开始规划”；generation-6/plan.md Acceptance 2 曾要求恢复原规范，generation-6/summary.md Revision 4 明列 AutoSupply、sector 来源、装备布局、No Demand 恢复任务。当前 clean HEAD 为 8b5894bc85a7de3d608efa8db74357d942764519。
- Affected tasks: 全部 generation 7 合同；generation 6 不再派发。
- Preserved results: 所有旧文档、review、失败、仍在当前树的修复均保留历史身份。当前代码不因旧 review 的 changes-required 被回退。
- Open questions: 无待确认产品方向；后续发现具体产品异常另报，不恢复旧整套要求。

## D02：按行为迁移覆盖，允许有证据地退休

- Decision: 改写关注测试目的与当前结果，不维持 71/74 文件或旧测试数的硬指标。每个改动场景写明 current-behavior 依据、固定输入、UI 动作和独立 expected；无关的有效用例保留，合并/退休说明现有覆盖去向。测试计数下降本身不是失败，也不能用下降掩盖有效覆盖缺失。
- Evidence: 最新用户明确允许过时用例重写/补写；当前静态 74 个 spec，详见 context/coverage.md。generation 6 的旧逐号不可退休约束已被替换。
- Affected tasks: 全部测试实现及最终验证。
- Preserved results: 有效迁移成果作为实现基础；旧 pass 不是本代运行 pass。
- Open questions: 仅技术可达性未知由相应 owner 查明；“暂时没找到”不得直接写成“当前不存在”。

## D03：采用统一自动设施和当前已保存资源来源

- Decision: 不新增独立 autoSupply 列表、props、仓储归属、internalSupply UI 或 sector sourceView 载入逻辑。重写旧 AutoSupply skip 为当前公开模块/人口/缓冲等操作引起的自动设施行为；旧星区载入测试改为当前已保存帝国/逻辑组网的载入、组内容和实际选择反馈。
- Evidence: src/components/empire/presenters/useProductionPlanningPresenter.ts 的 PlanningPresenterProps 与 src/components/empire/StationPlanningPanel.vue 没有 autoSupply prop；tests/e2e/production/module-management.spec.ts:125 仍有旧Case5 skip。MapResourceFilterAdvancedPanel.vue:163/202 从savedEmpires.list筛选/载入有资源流的station，:903起的empire按钮无sector testid和active class；logicflow项有active class。当前不存在gen6新增的useMapResourceFilterPresenter.ts，不沿其旧报告设计测试。
- Affected tasks: T004、T005、T010。
- Preserved results: 当前其余模块、设置、流量测试继续保留或按当前行为必要调整；不恢复 generation 6 T014/T015 的源码补丁。
- Open questions: 具体人口/仓储数值 fixture 和资源分类断言由 owner 对当前固定游戏版本计算，规划不预写未经验证的数字。
- Decide before: 对应测试 expected 定稿和独立 review。
- Returns to: T004/T005；仅发现产品异常或超出写范围才回 planner。

## D04：工作台自动事务缺口不再强制补产品入口

- Decision: 旧 T011 的不可达自动 station/transit A→B witness 不再是必须实现的产品目标；测试当前公开导航和模式切换。现有 Unit 保留，但不把 Unit 伪称为 E2E，也不要求为已退休的 UI 假设继续补 Unit。
- Evidence: generation 6 T011-A1/A2 和 Revision 7 报告记录公开点击退出 auto-sector-group、进入 auto 清空 station 等路径限制；当前路径由 context/current-behavior.md 重新核对。
- Affected tasks: T002、T010。
- Preserved results: 当前可达的 binding/workbench 用例和已保留 Unit 内容；旧调查无需无新事实重复。
- Open questions: 若发现不同的实际公开自动事件，T002 按其真正语义补测；不将旧假设的缺失作为最终验证永久前置。

## D05：steps 正反分支按现有能力验证

- Decision: 合并旧 T018–T022 为建筑规划测试工作，避免同一 compute spec 多 owner 等待。先验证实际可达输入；当前确有 switch 能力，不能仅因旧 energycells+last 前置失败就退休整个 steps 功能。正例绑定准确方案卡片，负例验证不满足条件时无 switch；汇总、steps 内容和返回后的内容都要独立断言。
- Evidence: src/components/empire/presenters/buildPlanStepsLogic.ts:355 的条件为 groupType=build-material、modules 非空、正的非 energycells 建材 rates；BuildPlanStepsModal.vue:180/226 按条件展示 switch。tests/e2e/build-plan-compute/build-plan-compute.spec.ts 旧3.3 使用 energycells 和最后卡片，未固定上述条件。
- Affected tasks: T008、T010。
- Preserved results: 五项既有显式计算覆盖目的和当前计算实现；不继承旧固定“六项必须原样满足”计数，不修改计算/弹窗源码。
- Open questions: 正例具体 UI/fixture 组合仍需运行取证。现有资料不足以确认当前没有可达正例；由 T008 内有界定位解决，确证无公开路径再向 planner 交付路径/分支证据，不能无限重复或自行新增入口。
- Decide before: T008 独立 review；不存在路径的具体证据裁决先于 T010。
- Returns to: T008；必要时仅修订其受影响验收，不增加产品任务。

## D06：装备与 tooltip 按当前展示验证

- Decision: 保留可用性、正确项身份、选择结果、展开/收起、稳定 hover 文案、定位与隐藏的有效覆盖。装备Fit两列宽改测当前三列；tooltip的No Demand与80/70最小列宽在当前代码中仍存在，应保留，不因它们曾写入旧规范而退休。旧面板拓扑或文案不能反向要求修改当前 UI。
- Evidence: ShipBuildWorkspaceView.vue:106起始终传wide=false，picker打开采用三列；ShipBuildPanelEquipment.vue:197 raceTags>5分两行。FavoriteButton.vue:83起level0 label来自priority_level_0_label，当前en/zh-CN为No Demand/无需求，description为Res/资源缓冲；:259起保留80/70 min-width。详见context/current-behavior.md。
- Affected tasks: T007、T009、T010。
- Preserved results: 当前 FIT/DETAILS 和其他有效装备行为；所有 src/locales/style 只读。
- Open questions: 对固定输入选择的当前 tooltip 分支及装备布局，由 owner 先追调用链，再固定 expected，不能接受多个互斥预期。

## D07：验证、写权限与异常返回

- Decision: 所有实现合同仅授权指定 E2E 文件。本代不设产品、Unit、共享 helper/config 的默认修复 owner。最终完整 E2E 必须真实通过；失败保持失败，环境不可用保持 unavailable。若发现缺陷超出这些权限，带可复现事实增补测试设施合同或请求产品决定，不用旧合同扩权。
- Evidence: 用户批准的本次范围与 AGENTS.md；package.json/playwright.config.ts/vitest.config.ts 当前 canonical 入口；generation 6 原结果不能描述当前候选。
- Affected tasks: T001、T010 及其失败对应 owner。
- Preserved results: 原失败与已交付测试补丁；不让一项异常清空其余可保留成果。
- Open questions: 当前完整运行结果未知；规划阶段没有运行测试/build。
- Decide before: 宣称本代执行完成或新增 Owned paths 之前。
- Returns to: 已有测试路径回对应 owner；其他路径回 planner，产品改动再由用户授权。

## D08：旧任务去向与额外范围

- Decision: 旧任务仅作为覆盖索引，不迁入本代状态/依赖。旧T024的内部调用次数不是当前用户行为目标，退休该实现细节断言；confirm后的公开状态/结果由当前binding及既有Live用例验证。未授权的DLC×bulk、Live/archive新政策不纳入本代产品范围；现有DLC/Live测试保留并全量回归。不会因旧报告列出“未验证”就新建产品任务。
- Evidence: context/coverage.md 记录当前74文件、保留/撤回候选及旧T024边界；用户批准的测试适配范围。
- Affected tasks: T001、T002、T009、T010。
- Preserved results: 当前其余M1–M16有效测试实现与历史结果；新代仍验证完整实际collection。
- Open questions: 无需为旧产品语义另等用户决定；发现未列路径的具体过时E2E时，planner在本代追加测试合同。

| generation 6范围 | generation 7去向 |
|---|---|
| T001–T010的历史调查/runner职责 | T001当前基线；历史调查按有效性保留，不重建旧调查关卡 |
| T011自动工作台假设/Unit补证 | D04退休不可达旧假设；T002覆盖当前公开导航，Unit只读 |
| T012/T013独立drag修复/真实拖放 | T003检查保留后的测试；无产品修复授权 |
| T014独立AutoSupply | D03替换旧产品要求；T004统一自动设施测试 |
| T015 sector来源 | D03替换旧sourceView要求；T005当前已保存来源载入 |
| T016导入/放置 | T006核对现有8项并补确有缺口 |
| T017装备布局/Unit消费者 | T007当前布局测试；Unit和src只读 |
| T018–T022建筑流/目标/预览/计算/steps | T008单owner实现，D05处理可达性，不保留旧T022 draft关卡 |
| T023 tooltip | T009保留当前有效文案/布局/交互覆盖 |
| T024额外范围 | 本决策处理边界，当前UI对应T002/T009，其余既有用例保留至T010 |
| T025最终验证及其余M1–M16用例 | T010当前完整collection与完整运行，旧数量不作门槛 |
