# FIX-M10.1

状态：待派发，Astra medium，主 agent 派发，不再委派。Resolved change: fix-ship-selector-filter-lifetime。

独占写入：src/components/ship-build/ShipBuildView.vue；src/components/ship-build/ShipBuildSelectorView.vue；src/components/ship-build/presenters/useShipBuildSelectorPresenter.ts；必要的新 tests/unit/ship-build/ship-selector-filter-lifetime.spec.ts；该 change 的 tasks.md/bugs.md；../results/FIX-M10.1.md。不与 M10.2+ 的测试路径抢写。store 及其他 presenter 只读。

已按只读证据精确扩域：原跨级回填和pending清除依赖卸载重建，单改v-show会破坏两个对照。只把本次所需pending/class/race/type refs、selectedShipId初始化watch及取消/确认必要动作移入presenter；同级取消只清pending，跨级取消明确按currentShip回填。不得在Vue新加业务回填，不全面重构候选/设备/布局。

读该 change 所有规范与设计，按 x4-bug-fix → apply/Unit 分阶段实施。不启用 codex-workflow。已有本轮 E2E red，先追踪所有 caller/lifecycle，优先最小保留组件实例方案；检查同船级保留、跨船级回填、pending reset、selectedShipId 载入和隐藏组件副作用。聚焦 Unit 使用实际相关行为，不写仅检查模板含 v-show 的镜像测试。

保留诊断日志、其他人修改，不提交。Unit就绪后等待内部build协调，不擅自browser/build；E2E原失败及完整35由主agent下一阶段派发。若最小方案不能保持语义，记录已尝试/阻碍/未满足/恢复条件，原任务仍未完成。
