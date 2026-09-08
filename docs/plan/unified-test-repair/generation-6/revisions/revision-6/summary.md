# unified-test-repair · Generation 6

Revision 6 已发布，唯一新增写权限为 T017 的 canonical-details Unit。依据 [T017-A2-review](results/T017-A2-review.md)，Equipment 的两个死 summary 绑定和旧 Unit 消费方式仍待修复；最终六-spec 44/46 尚未通过。本次只出版规划，未修复或运行代码，完整最终验收仍未成立。

## Revision 6 — T017 F2 消费者归属与 F3 重证

[新合同](tasks/T017.md)保留原八个 Owned paths，只新增 `tests/unit/ship/ship-equipment-canonical-details.spec.ts`。Equipment 删除两项死绑定；Unit 的 summary 断言迁到 Fit active picker 使用的现有 presenter，保留 engine/thruster canonical details、engine `5045:8`、thruster 两个 summary 以及 turret/shield 原四项场景。共享 config/helper/fixture 和 T017 之外源码继续只读。implementation-simplicity 仅约束产品侧死绑定/实际消费者归属，不用于 Unit 实现或审查。

F1 的 viewport/几何已闭合及 FIT/DETAILS 成果保留，F2/F3 未闭合。A2 最终 44/46（布局 3/3、其余 41/43）、旧 Unit 4/4 和 pre-final 46/46 都保留原候选含义。dispatcher 换发 Revision 6 后，T017 完成修复、静态搜索、focused Unit 和 owned diff；随后对新冻结候选独占 shared-dist-build/Chromium/23117 执行默认 fresh build → preview 六-spec，必须 exit 0、3/3 + 43/43 = 46/46、0 failed/skipped/flaky。独占仍 404 则保留 trace/网络证据交 runner/asset-serving owner，不能记作通过或修改 oracle。

独立 reviewer 复核 F2/F3 后由 dispatcher 记录接受，再返回原 T025 完整验证。其他任务合同、T014 Revision 5 amendment 和既有未决项不变，无新产品决定。修改前五份规划原文保存在 [revision-5 快照](revisions/revision-5/plan.md)，详见[定向结果](results/planner-revision-T017-F2.md)。本次未修改源码、测试、配置、status、旧结果或 Git metadata，未执行 Unit/E2E/build 或派生 agent。

Revision 5 发布时的 canonical Unit 为 [T010-A3](results/T010-A3.md) 留存的 180 files / 1016 tests、1013 passed / 3 failed；下文保留当时结论，不作为后续候选最新运行事实。

## Revision 5 — current Unit 失败的归属与最小 amendment

三个 StationPlanningPanel 单测未给新必需 prop `autoSupplyModules`，在模板读取 length 时失败。实际 Blueprint/Live 消费者已经传值。这是 T014 接口变更需要同步的测试输入；T010 只负责验证，且 Revision 4 的 T014 Owned paths 没有该单测，不能直接越权派修。现在 [T014 Revision 5](tasks/T014.md) 只增加 `tests/unit/current/production/StationPlanningPanel.spec.ts`：三个 mount 显式提供空数组，原三项行为和断言保持。

T010 合同维持 Revision 3，T025 维持 Revision 4。dispatcher 换发 T014 新合同并安排 focused 检查；T014 原 [独立 review](results/T014-A1-review.md) 的领域隔离、workforce-off 及 25 项独占浏览器/Save-reload 缺口继续处理，随后复审和新候选 T010 验证，全部前置闭合后再做 T025。三项单测通过不会关闭这些原缺口。

T010-A3 的原失败、collection 843/74、build 和 6/6 smoke，以及全部既有结果/补丁保留，不能作为修复后全绿。本次适用 implementation-simplicity 仅用于保持产品接口和领域归属；未将该标准用于测试实现或测试审查。修改前规划保存在 [revision-4 快照](revisions/revision-4/plan.md)，实际文件与派发说明见 [定向结果](results/planner-revision-5-T010-A3-owner.md)。本次只写规划及这份新结果，不改源码、测试、status 或 Git，不执行 Unit/E2E/build，不代行派发或接受。

## Revision 4 历史记录

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
