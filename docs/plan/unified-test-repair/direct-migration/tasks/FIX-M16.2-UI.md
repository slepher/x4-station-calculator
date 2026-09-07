# FIX-M16.2-UI

状态：待派发。Astra medium，由主 agent 分配，禁止再委派。

Resolved change: fix-station-dlc-ui。读取该 change 的 request/spec/design/tasks/bugs，遵循 x4-bug-fix → apply/Unit → 构建 → 独立 E2E 的阶段，不启用 codex-workflow。

独占写入：src/components/empire/StationPlanningItem.vue；src/components/empire/presenters/useStationPlanningItemPresenter.ts；tests/unit/current/dlc-settings/station-planning-item-dlc.spec.ts；该 change 的 tasks.md/bugs.md；../results/FIX-M16.2-UI.md。其他 src/spec/E2E/helper/fixture 只读，不撤回他人修改、不删 debug、不提交。

当前 M16.2 失败已有效复现，不在未修复前重复跑同一浏览器。先建立最小 mounted Unit red，再改 Item 对 label / disabled 的消费并抽出现有 DLC 展示组装到 presenter。保留 readonly、countDisabled、base 不显示、删除、策略关闭行为。不扩到计算链路或整个组件重构。

完成 focused Unit 后交回，等待主 agent 内部协调独占构建窗口；不擅自运行 build/E2E。如越界需求出现立即报告精确文件和理由。M16.2 原任务和第三项计算失败始终保留未完成，UI 小修可独立通过。
