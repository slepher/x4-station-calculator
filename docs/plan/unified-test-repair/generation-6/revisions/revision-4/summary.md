# unified-test-repair · Generation 6

Revision 4 已发布：目标是实际修复剩余产品/测试问题并完成最终完整 E2E。当前仍没有完整 E2E 结果；已有调查和局部通过不代表修复完成。此次只修改规划文档，当前产品/Unit 补丁保留，未宣称已接受。

本次把四项误设的产品决定前置取消：T006 独立审查已确认沿用原规范不需要新选择。T014 恢复独立 AutoSupply，T015 恢复真实 sector 来源，T017 恢复原三项布局，T023 恢复 No Demand 并落实 T024 已确认的 80/70 列宽。四项均有明确产品及测试路径、验证命令和独立 review。

T013 可先消费 T012 已有候选做真实 pointer 验证，再将结果供 T012 独立产品审查，解除相互等待。T016 必须提交测试补丁，加强 station placement，新增 sector placement 与两种 Save/reload 完整空间身份断言；原七项重跑不构成交付。

立即可开始 T013/T014/T016/T017/T023；T015 非共享部分可准备，修改共享 store 等 T014 候选交接。T022 是唯一 draft：仍缺满足 build-material、非空 modules、正的非 energycells target rates 的精确卡片/UI witness，五项计算通过不能关闭原 3.3。T025 的合同已 executable，等待全部修复与必要审查闭合后才执行单次完整 canonical E2E、build、Unit、diff；collection 和局部结果不能替代最终验收。

保留证据：[T012-A1](results/T012-A1.md) 的 store/Unit 补丁及 2/2 尚未独立接受；[T016-A1](results/T016-A1.md) 的 unchanged spec 7/7、[T021-A1](results/T021-A1.md) 的五项结果仅覆盖原局部范围；[T006 review](results/T006-A1-review.md) 和 [T024](results/T024-A1.md) 的事实已落实到修复合同。源码、Unit、E2E、结果和 runtime status 本轮均未修改，没有运行测试/build 或派生 agent。

Revision 3 的受影响规划原文已保存在 [revision-3 快照](revisions/revision-3/plan.md)。dispatcher 采用 revision 4 后换发八份受影响合同；其余合同与既有证据继续保留，planner 不记录接受。

## Revision 3 历史记录（由上方 Revision 4 纠正）

下文保留当时“等待产品决定”等原结论供追溯；这些等待及接受循环已由 Revision 4 取代，不是当前执行指令。

Revision 3 继续 direct-migration 的剩余验收。已有 T001/T002/T006/T007 结果保留，不重跑；T003/T004/T005/T008/T009 不再作为独立关卡。

当前进度：

1. **立即执行 T010**：一次 canonical Unit、E2E collection 和最小 browser smoke，建立当前基线。
2. **可并行开始 T011/T012/T016/T024**：各任务内部先完成原 T004/T005/T008/T009 的必要调查，再实现或闭合。Browser 阶段仍等 T010。
3. **T018–T021 在 T010 后执行**：直接使用已接受的 T007 事实；T022 等 T021 交接与真实 build-material card witness。
4. **T014/T015/T017/T023 等待产品决定**：T006 已确认规范与实现冲突，不由测试修改暗自裁决。
5. **T013 等 T012；T025 最后执行**。

独立 review 仅用于 expected/规范变更、产品修复和最终候选。普通只读调查和按已定语义迁移由 dispatcher 核对 diff 与运行证据。

仍未满足的行为保持不变：M5.3 两项 hover、M7.2 一个原 skip、M7.3 四项 sector 来源、M10.2 三项布局、M15.2 最终文案、自动工作台保护、地图完整身份持久化，以及 M11–M14 迁移。M8.3/M9.1 已有运行事实保留，缺失部分分别在 T025/T016 闭合。
