# FIX-M5.2：紧凑模块名称

主 agent 从 M5.2 当前真实失败派发的独立产品修复，Astra medium，禁止再委派；不启用 codex-workflow。

独占写入：`src/components/logic-flow/LogicFlowPlanningZone.vue`、必要的 `src/components/logic-flow/presenters/useLogicFlowPlanningPresenter.ts`、`tests/unit/logic-flow/logic-flow-compact-module-name.spec.ts`、`openspec/changes/fix-logic-flow-compact-module-name/tasks.md` 和 `bugs.md`、本任务 results/FIX-M5.2.md。其他源文件只读，新增依赖禁止。

先读取 change request/spec/design/tasks 和 x4-bug-fix/x4-apply skill。用当前 M5.2 真实 E2E 失败作为 bug 复现输入，完成最小 focused Unit 和产品修复；不得运行 E2E 于 apply 阶段。类型与精确分支对齐正常 node/raw/preview，遵守 store → presenter → Vue，禁止新增中间层、fallback 链、删除调试日志或重构其他组件逻辑。不是唯一编辑人，不回退他人修改，不提交。

验证：`npm run test:unit -- tests/unit/logic-flow/logic-flow-compact-module-name.spec.ts`，主 agent 准许构建窗口后 `npm run build`，`git diff --check`。构建前必须等其他正在运行的 E2E 完成，未获主 agent 内部调度不得直接重建 dist。

完成 focused Unit 后先报告主 agent；source fix 后原 M5.2 owner 在新的构建上复验失败 case 与49项，只有这些证据通过才关闭此产品问题。若无法修复，报告实际阻碍/尝试/未满足验收/恢复条件，原 M5.2 未完成项保持失败，其余独立任务继续。
