# Generation 6 任务索引

沿用[plan.md](plan.md) Revision 7 的验收映射。已有结果保留但不据此宣称修复/接受。executable 表示合同可派发，依赖未满足时按合同等待；只有边界无法安全确定才用 draft。T013 启动只需 T012 候选，产品接受在真实 pointer 验证后完成。

## T001

- State: retired
- Revision: 1

[核实本次 runner、构建与浏览器运行前提](tasks/T001.md)。决策/事实边界：D02。

## T002

- State: retired
- Revision: 1

[核对可继承成果与原编号映射](tasks/T002.md)。决策/事实边界：D03。

## T003

- State: retired
- Revision: 1

M8.3 在 T025 闭合；M9.1 缺口并入 T016。不再单独执行[原合同](tasks/T003.md)。

## T004

- State: retired
- Revision: 1

调查并入 T011；不再单独执行[原合同](tasks/T004.md)。

## T005

- State: retired
- Revision: 1

根因诊断并入 T012；不再单独执行[原合同](tasks/T005.md)。

## T006

- State: retired
- Revision: 1

[整理规范冲突供独立裁决](tasks/T006.md)。决策/事实边界：D07、D07a、D07b、D07c、D07d、D07e、D07f。

## T007

- State: retired
- Revision: 1

[厘清建筑流、目标、预览与计算的 UI 前置](tasks/T007.md)。决策/事实边界：D08。

## T008

- State: retired
- Revision: 1

oracle 设计并入 T016；不再单独执行[原合同](tasks/T008.md)。

## T009

- State: retired
- Revision: 1

范围核对并入 T024 及相关功能任务；不再单独执行[原合同](tasks/T009.md)。

## T010

- State: executable
- Revision: 3

[验证候选构建与本次 canonical runner](tasks/T010.md)。决策/事实边界：D02。

## T011

- State: executable
- Revision: 7

[补充工作台保护 Unit 边界，保留公开 UI witness 缺口](tasks/T011.md)。仅 Unit 子交付可执行，原 E2E 阶段暂停；决策/事实边界：D05、D17。

## T012

- State: executable
- Revision: 2

[修复独立 drag demo 的确证根因并补组件回归](tasks/T012.md)。决策/事实边界：D06。

## T013

- State: executable
- Revision: 4

[重证 drag demo 全部十项真实拖放](tasks/T013.md)。决策/事实边界：D06。

## T014

- State: executable
- Revision: 5

[完成独立 AutoSupply 原 Case5 验收及 current Unit 消费者适配](tasks/T014.md)。决策/事实边界：D07d、D14、D15。

## T015

- State: executable
- Revision: 4

[完成资源分组四项 sector 来源验收](tasks/T015.md)。决策/事实边界：D07e。

## T016

- State: executable
- Revision: 4

[证明 station 与 sector 放置保存的完整空间身份](tasks/T016.md)。决策/事实边界：D09。

## T017

- State: executable
- Revision: 6

[逐项完成装备面板三项布局及 canonical-details Unit 消费者修正](tasks/T017.md)。决策/事实边界：D07a、D07b、D07c、D16。

## T018

- State: executable
- Revision: 2

[迁移建筑流菜单、绑定与真实拖放持久化](tasks/T018.md)。决策/事实边界：D08。

## T019

- State: executable
- Revision: 2

[迁移目标、Fleet及方案 CRUD 保存恢复](tasks/T019.md)。决策/事实边界：D08。

## T020

- State: executable
- Revision: 2

[迁移预览的 derived、required 和用户目标分离](tasks/T020.md)。决策/事实边界：D08。

## T021

- State: executable
- Revision: 2

[迁移显式计算与详情的五项独立验收](tasks/T021.md)。决策/事实边界：D08。

## T022

- State: draft
- Revision: 4

[恢复计算详情汇总与 steps 的可逆切换](tasks/T022.md)。决策/事实边界：D08。

## T023

- State: executable
- Revision: 4

[完成 tooltip 稳定文案、定位与隐藏验收](tasks/T023.md)。决策/事实边界：D07f、D10。

## T024

- State: executable
- Revision: 2

[承接已确认但尚缺覆盖的既有验收](tasks/T024.md)。决策/事实边界：D10。

## T025

- State: executable
- Revision: 4

[给出最终工作树的完整 canonical 验证与闭合证据](tasks/T025.md)。决策/事实边界：D11。

## Revision 4 执行入口

立即可开始修复：T013、T014、T016、T017、T023。T015 可先准备非共享部分，依赖 T014 的 store 写入交接；不等待产品决定。T022 是唯一 draft，保留 3.3 的三条件卡片 witness 缺口。T025 executable 但依赖 T010–T024 全部闭合，负责最终完整 E2E。T011/T012/T018–T021/T024 原合同未完成部分继续；调查/旧局部通过不表示修复完成。

## Revision 5 定向入口

只换发 T014 Revision 5：增加 `tests/unit/current/production/StationPlanningPanel.spec.ts` 的三个 mount 输入适配和 focused 检查；原 T014 产品验收及 A1-review 未满足项继续。T010 保持 Revision 3，只读复验由 dispatcher 在新候选冻结后分配下一空闲 attempt；T025 保持 Revision 4，消费实际 T014 Revision 5 修复/review 后按原依赖运行。其他合同不换发、不重置，旧结果不覆盖。

## Revision 6 定向入口

只换发 T017 Revision 6：唯一新增 `tests/unit/ship/ship-equipment-canonical-details.spec.ts` 精确写权限，按 A2-review F2 清理 Equipment 死绑定、迁移 summary 断言至现有 active presenter 并保留四项 canonical details 场景。F3 仍要求独占默认 fresh build → preview 六-spec，exit 0、布局 3/3、其余 43/43、总 46/46、0 failed/skipped/flaky。新候选经独立 review 后返回 dispatcher/T025；T025 原合同与依赖不变，其他合同和旧结果保留。

## Revision 7 定向入口

只换发 T011 Revision 7：新增 `tests/unit/current/active-view/activeViewStore.spec.ts` 单一路径，执行 U1 station A→B、U2 transit A→B/合法 sector 派生、U3 非固定模式 setter 对照和整份 focused Unit/diff。A1/A2 的静态交回成立；不创建 focus spec，不运行 E2E/build，不重复无新增事实调查。dispatcher 核对 Unit 子交付后，公开 UI 自动事务及显式点击对照仍交 planner，T011 整体保持未满足。T025 Revision 4 及其 Depends on T011 不变，不能以 Unit 子交付解除前置；其余合同/证据保留，T017 Revision 6 不回退。
