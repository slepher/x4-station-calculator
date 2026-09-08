# Generation 6 · T010-A3 定向 owner 裁决

- Role: planner
- Input plan revision: 4
- Published plan revision: 5
- Affected contract: T014 Revision 4 → 5
- Status: amendment_published
- Runtime adoption/acceptance: 由 dispatcher 记录，本说明不代行

## 判定与依据

需要最小 amendment，修复 owner 是 T014。Revision 4 公共合同要求必要回归随修复落实，但同时将 Owned paths 定为写入上限；T014 引入了必需的 `autoSupplyModules`，却未拥有失败的 `tests/unit/current/production/StationPlanningPanel.spec.ts`。因此不能直接派 T014 越界改测试。T010 的实际合同仍是 Revision 3，Owned paths 为空，Acceptance 4 和 Return when 明确禁止修改源码/Unit；该合同保持原文。

[T010-A3 原日志](../evidence/T010-A3/unit.log) 三次报告 `Missing required prop: "autoSupplyModules"`，随后在 `StationPlanningPanel.vue:387:40` 读取 length 失败。组件第 16 行声明必需数组；单测第 46/83/124 行的三个 mount 均未提供该字段。Blueprint、Live → wrapper 的实际组件消费者都已传值。依据 revision 4 的独立 AutoSupply 接口方向，应同步测试消费者；没有为旧测试增加 optional/default/fallback 的产品兼容义务。

## 实际规划文件

- [plan.md](../plan.md)：Revision 5，增加最小影响、证据保留、合同换发和返回路线。
- [tasks/T014.md](../tasks/T014.md)：Revision 5，仅新增一个 Owned path：`tests/unit/current/production/StationPlanningPanel.spec.ts`；补 Acceptance 6、输入证据、focused 验证和返回 T010 的路线。
- [tasks.md](../tasks.md)：同步 T014 Revision 5；其他任务 revision/dependency 保持。
- [decisions.md](../decisions.md)：新增 D15，保留 D14 的其余效力与历史决定。
- [summary.md](../summary.md)：补当前失败、修改理由和后续工作，保留 revision 4/3 累积说明。
- [revisions/revision-4/](../revisions/revision-4/)：先保存以上五个文件的修改前原文，含 `tasks/T014.md`。
- 本文件：新增定向结果，不覆盖任何既有 results/evidence。

`tasks/T010.md` 保持 Revision 3；`tasks/T025.md` 保持 Revision 4。T025 已要求消费实际依赖 revision/attempt，原 T014 依赖足够，不需另建修复任务或反向依赖。

## 给 dispatcher 的精确派发内容

1. 采用 plan Revision 5，在 T014 交接点显式换发 `tasks/T014.md` Revision 5，仍用合同角色 `sup_coding_worker`；将本结果、D15、T010-A3 原日志及 T014-A1-review 一并作为输入。分配下一空闲 T014 attempt/result/evidence 路径；保留已有 A1 和所有其他结果，不由 planner 猜测或预占运行编号。若仍有旧合同执行者，先完成受影响写入交接；无关任务继续原合同。
2. 新增修复只在上述 current Unit 三个现有 mount props 中补 `autoSupplyModules: []`。三个场景保持无补给初态，原 auto/archive max、recommended 虚线/readonly、promote 显式总量断言全部保留；不改产品 prop、不加兜底、不新增 helper、不改断言或 skip。已有源码、测试、调试日志和 T015 的共享 store 成果保留。原 T014-A1-review F1/F2/F3 继续由 T014 在原闭包内修正，不以此三项修复代替。
3. 执行者在 `/home/slepher/project/x4-station-calculator` 按新合同运行：`npm run test:unit -- tests/unit/production/auto-supply-storage.spec.ts tests/unit/production/station-derived-map-semantics.spec.ts tests/unit/current/production/StationPlanningPanel.spec.ts`。记录真实 exit、计数及候选身份，证明 current 单测原三项通过且缺 prop/length 错误消失。T014 原 25 项独占浏览器验证与独立 review 要求仍保留，由 dispatcher 串行分配 build/browser 资源，不重复借用受污染 dist。
4. 修复/必要 review 后冻结新候选，派 T010 按完全未修改的 Revision 3 和新 attempt 执行其原验证，保留 canonical Unit 完整结果；不让 T010 改测试，不把旧 1013 passed 加 focused 3 passed 拼成全量。T010-A3 独立 review 仍按原要求处理。最终全部依赖闭合后由 T025 按原合同执行完整 canonical E2E/build/Unit/diff。

## 保留结果与验证限制

T010-A3 的 180 files / 1016 tests、1013 passed / 3 failed 是原候选实际失败；collection 843 tests / 74 files、成功重试 build 与 6/6 smoke 保留原有覆盖和环境限制，均不证明修复后通过。T014-A1-review 的 F1/F2 领域问题、F3 25 项浏览器与 Save/reload 缺口继续未闭合；本次未重审或关闭它们，其他既有未决项也不变。

本轮仅静态核对合同、消费者及已有日志，并校验规划修订、快照和新增所有权的一致性；未修改源码/测试/配置/status/Git，未运行 Unit/E2E/build，未派生 agent 或记录接受。implementation-simplicity 仅用于产品必需接口/归属的规划边界，不用于测试实现或测试审查。没有新的产品选择需要用户决定；后续路线为 dispatcher → T014 → 独立 review/T010 → T025。
