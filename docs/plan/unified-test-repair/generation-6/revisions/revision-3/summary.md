# unified-test-repair · Generation 6

Revision 3 继续 direct-migration 的剩余验收。已有 T001/T002/T006/T007 结果保留，不重跑；T003/T004/T005/T008/T009 不再作为独立关卡。

当前进度：

1. **立即执行 T010**：一次 canonical Unit、E2E collection 和最小 browser smoke，建立当前基线。
2. **可并行开始 T011/T012/T016/T024**：各任务内部先完成原 T004/T005/T008/T009 的必要调查，再实现或闭合。Browser 阶段仍等 T010。
3. **T018–T021 在 T010 后执行**：直接使用已接受的 T007 事实；T022 等 T021 交接与真实 build-material card witness。
4. **T014/T015/T017/T023 等待产品决定**：T006 已确认规范与实现冲突，不由测试修改暗自裁决。
5. **T013 等 T012；T025 最后执行**。

独立 review 仅用于 expected/规范变更、产品修复和最终候选。普通只读调查和按已定语义迁移由 dispatcher 核对 diff 与运行证据。

仍未满足的行为保持不变：M5.3 两项 hover、M7.2 一个原 skip、M7.3 四项 sector 来源、M10.2 三项布局、M15.2 最终文案、自动工作台保护、地图完整身份持久化，以及 M11–M14 迁移。M8.3/M9.1 已有运行事实保留，缺失部分分别在 T025/T016 闭合。
