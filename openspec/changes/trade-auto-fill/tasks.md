# Trade Auto Fill — 实现任务

任务进度随实现和 focused Unit 验证更新。按 request.md -> specs/trade-auto-fill/spec.md -> design.md 执行；每个行为任务随代码完成其 focused Unit，不另设 Unit 实现阶段。Unit 文件仅位于 tests/unit/**；本清单不编排 E2E，E2E 走独立 x4-e2e-test 工作流。

## 1. 明确身份、确认组成员与事实入口

- [x] 1.1 在现有领域层明确 stationPlan/archive/tradeStation 的实际实体映射与身份，按当前 binding tradeStation 关系识别中转站；在 tests/unit/trade-auto-fill/station-context.spec.ts 覆盖同一实际站重复引用、中转站优先身份、名称/option 前缀不能决定身份及真实记录缺失不转虚拟。
- [x] 1.2 复用当前确认分组归属获取唯一成员，纳入未绑定规划的实际站、确认虚拟站与中转站，不沿组间连接扩展；在 station-context.spec.ts 覆盖跨物理星区组、重叠 coverage、未应用分组草稿排除和每站只计一次。
- [x] 1.3 在 useLiveProductionStore/既有领域逻辑提供按显式站点读取确认目标、有效 archive 建材/库存/主产物事实的能力，不切换 active station 或 workbench mode；在 tests/unit/trade-auto-fill/station-facts.spec.ts 覆盖 binding/快照不匹配、加载未完成、完整空库存与缺失记录区别，以及读取不修改工作台选择。

## 2. 建材和库存纯计算

- [x] 2.1 复用 canonical 确认目标计算每站 R，排除已建、已耗材料施工和未应用草稿，避免 archive 待建与规划双计；在 station-facts.spec.ts 覆盖实际有/无 stationPlan、新虚拟规划站、施工进度、待建模块已在目标、模块映射失败与视图切换无关。
- [x] 2.2 按明确归属读取建筑库存 B，逐站计算 max(0,R-B)，普通库存 C 按实体与 ware 聚合，不扣 reservation；在 tests/unit/trade-auto-fill/accounting.spec.ts 覆盖超额 B 不抵其他站、不进入出售库存、普通/建筑仓库分离、重复 cargo 条目、船舱/NPC/在途排除。
- [x] 2.3 获取已建模块实际输出集合，以及普通站领域主产物 level 2 与实际输出的交集；在 station-facts.spec.ts 覆盖主产物/副产物/输入、未来产物、组内仅购入囤货、合法无主产物与必要分类不可用。

## 3. 四种填充规则与可解释结果

- [x] 3.1 实现 trade+buy 的 max(0,D组-C组)，逐站抵建筑仓库后才汇总，组库存只扣一次；在 tests/unit/trade-auto-fill/targets.spec.ts 覆盖 A/B 双站建材示例 2000、多个站共享同 ware、库存充足为空和超额建筑库存不得跨站抵扣。
- [x] 3.2 实现 trade+sell 的实际组主产物筛选及 max(0,C组-D组)；在 targets.spec.ts 覆盖 11000-8000=3000、库存不足不出售、库存分散在组内各站以及不以小时产量/NPC 数量/船容量截断。
- [x] 3.3 实现 station+buy 的 max(0,D本站-C组) 与 station+sell 的主产物 max(0,C本站-D本站)；在 targets.spec.ts 覆盖组库存覆盖本站采购、出售不借其他站库存也不扣其他站需求、虚拟站购买与无现货出售。
- [x] 3.4 输出 ready（允许空 targets）或 unavailable 的互斥领域结果及逐商品/逐站账目，结果唯一、正整数、按 wareId 稳定排序；在 accounting.spec.ts/targets.spec.ts 覆盖未知 ware/模块、失效归属不可静默跳过，需求/库存/实际抵扣明细一致和纯计算不修改输入。

## 4. 会话状态、填充与手动编辑

- [x] 4.1 扩展 useNpcTradeStore 的自动模式、填充归属、已处理/待处理触发、目标修订和有限撤销状态，不增加持久化字段；在 tests/unit/trade-auto-fill/session.spec.ts 覆盖默认关闭、同 binding 会话保留、binding 切换清理自动状态和旧归属不串用。
- [x] 4.2 提供一次原子目标替换动作，保存同上下文前值，原主商品有效则保留、否则选稳定首项、空结果为 null，保留排序指标和模式；在 session.spec.ts 覆盖重复填充不累加、空结果清空、主商品有效性及一次撤销恢复与消耗。
- [x] 4.3 让 addWare/updateTargetQty/removeWare 保持自由编辑，记录手动调整并使旧撤销/待处理请求失效，不修改 checkbox、不触发回填；在 session.spec.ts 覆盖删后不复活、改量后保留、手动新增、零数量沿用 null 规则、手动编辑不被晚到结果覆盖。

## 5. Presenter 触发与页面展示

- [x] 5.1 在 useNpcTradePresenter 接入按钮/checkbox，开启即请求、有效站点/方向/快照变化自动请求，group 切换等待有效下级选择；以稳定上下文和动作号去重，在 tests/unit/trade-auto-fill/presenter.spec.ts 覆盖两种 checkbox 状态按钮、勾选即填、关闭保留、同值重选不触发、搜索/跳数/排序/分页不回填。
- [x] 5.2 校验最新 binding、快照、站点、方向和目标修订后才应用，数据未就绪等待、不可用保留并显示未更新、有效空清空；在 presenter.spec.ts 覆盖快速切站/切快照、旧结果丢弃、实际数据未齐、有效空结果及关闭模式条件变化提示。
- [x] 5.3 从会话已处理键恢复 presenter，离开返回同上下文不重新填充；在 presenter.spec.ts 覆盖 checkbox 开启时手动删改后重新挂载、待处理期间编辑取消旧请求、离开期间上下文确实变化才自动填及不可用后加载完成只处理当前请求。
- [x] 5.4 为去重后的下拉选项输出本地化“中转站/空间站 · 星区 · 名称”，组装范围、来源、已调整、原建议/当前值和可展开逐站账目，保持 UI 逻辑在 presenter；在 presenter.spec.ts 覆盖实际中转站标签且只出现一次、各分支范围、超额建筑库存明细、删商品不因展示明细复活、无 NPC 匹配仍保留目标。
- [x] 5.5 在 NpcTradeWorkbench 渲染按钮、可访问 checkbox、状态、同上下文撤销及折叠明细，保留原商品增删改控件；同步 en/zh-CN 文案和稳定 testid，以 presenter.spec.ts 验证控件 props/emits、禁用原因、手动提示和撤销可用性，人工检查 Vue 没有 store/业务组装依赖。

## 6. 实现完成验证

- [x] 6.1 复核 request.md 的全部 DoD 与 spec 场景均已由实现和 owning task 的 focused Unit 覆盖，检查四种范围、明细和 store -> presenter -> vue；不额外添加 adapter/view model/facade，不改 Rust/parser/WASM。
- [x] 6.2 汇总各任务已运行的 tests/unit/trade-auto-fill/** focused Unit 结果；只有新改动、失败或未解决问题才重复扩大测试，不以全套运行替代分支覆盖。
- [x] 6.3 代码写完后运行 npm run build，编译错误修复后重跑直至通过或记录明确 blocker；不得仅为消除编译错误删除业务代码，未修改 rust-parser/src/*.rs 不运行 build-rust。

## Apply 验证记录

- `tests/unit/trade-auto-fill/station-context.spec.ts`：7 passed（身份、去重、唯一确认归属、跨物理星区、配置名称）。
- `tests/unit/trade-auto-fill/station-facts.spec.ts`：11 passed（确认 canonical 目标、施工已耗、已建实际输出、虚拟站、排除草稿、快照/仓库完整性、视图无关）。
- `tests/unit/trade-auto-fill/accounting.spec.ts`：4 passed（逐站 R/B/D/C、超额建筑库存、reservation 排除、数量完整性）。
- `tests/unit/trade-auto-fill/targets.spec.ts`：8 passed（四种公式、有效空、商品筛选、稳定顺序、输入不变）。
- `tests/unit/trade-auto-fill/session.spec.ts`：7 passed（默认关闭、绑定隔离、原子替换、编辑保护、单次撤销、过期请求）。
- `tests/unit/trade-auto-fill/presenter.spec.ts`：18 passed（合法触发、重挂载、快速切换、加载等待、控件、四种范围、来源/明细、无报价保留、撤销）。
- `tests/unit/trade-auto-fill/archive-load.spec.ts`：2 passed（缺失 IndexedDB 记录不可当完整空快照；合法空快照可用）。
- 当前 change focused Unit 合计 **57 passed**；受影响的既有市场报价 store/offers/jumps/presenter/workbench 文件合计 **13 passed**。
- 三层检查：Vue 只消费 `useNpcTradePresenter`；身份、确认成员、canonical 事实与账目由 store/logic 负责；标签、状态、明细及控件编排在 presenter。没有新增中间层或持久化字段；未修改 Rust/parser/WASM。
- 建设目标与组归属使用 `useSaveBindingStore.getBindingByGameGuid` 的确认快照，排除 `draftBinding` 和 `virtualStationDrafts`；有效 archive 使用当前已选择的兼容快照。
- 本轮发现并修复的边界问题记于 `bugs.md`，已提供 focused Unit；最终完整验证仍由 `/x4:verify trade-auto-fill` 执行。
- 未执行 E2E 或全量 Unit，未运行 build-rust，未提交代码。
- 最终 `npm run build` 通过（production compatibility guard、vue-tsc、Vite）；仅保留 Vite 的大包提示。`git diff --check` 通过。

## 7. 用户反馈补充

- [x] 7.1 商品改为两行卡片，名称完整换行，来源与数量另起一行；移除可见“目标数量”说明，保留可访问标签并扩为 w-28。此项为展示调整，既有控件事件不变，无新增业务 Unit；workbench/presenter 原有用例通过。
- [x] 7.2 中转站出售仅选组内已建主产物（resolved priority level 2）并继续扣全组建材；真实中转站也必须有主产物分类。targets/station-facts 新增回归先出现 4 个失败，调整后通过；同步 zh-CN/en 范围文案与 request/spec/design/proposal。
- [x] 7.3 本次反馈修改后 npm run build 通过（production compatibility guard、vue-tsc、Vite），git diff --check 通过；保留既有大包提示。

### 补充 focused Unit 记录

- targets.spec.ts：9 passed，覆盖副产物排除、任一生产站的主产物可使用全组库存、分类变更后移除。
- station-facts.spec.ts：13 passed，覆盖实际/虚拟中转站仅主要产出、用户分类覆盖、未来主产物排除与分类缺失。
- presenter.spec.ts：18 passed；npc-trade-workbench.spec.ts：4 passed。此次受影响用例共 **44 passed**。
- 商品卡片预览的数量编辑、已调整标记、移除行为通过独立临时检查；未执行 E2E/全量 Unit，未提交代码。
