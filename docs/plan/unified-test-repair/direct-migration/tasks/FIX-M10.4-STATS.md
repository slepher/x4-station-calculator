# FIX-M10.4-STATS

Astra medium，主agent派发，禁止再委派。Resolved change fix-ship-build-analysis-contract，仅STATS任务/BUG-STATS。

独占src/components/ship-build/ShipBuildPanelStats.vue、必要src/components/ship-build/presenters/useShipBuildStatsPresenter.ts、tests/unit/ship/ship-stats-average-recharge.spec.ts、该change的STATS task/bug节、results/FIX-M10.4-STATS.md。HULL、共享useEquipmentStats、其他src/test/helper/fixture只读。保留所有debug及他人改动，无提交。

修现有两项指标含义，不新加Vue-store业务路径、不迁整板；若迁出仅相关cohesive组装至同层presenter。实际mounted真实store/stats Unit红绿：明确2种炮塔不同数量独立加权、0安装、DLC排除、原装备与预演、recharge100→1%/s，其他指标无回归。当前一位小数显示保留，301.105显示301.1可作为格式迁移，不能比较错误50.2。共享装备详情recharge数值/接口不改。

按x4-bug-fix/apply，聚焦及有限消费者后交付；无build/browser/fullUnit。原M10.4 E2E保持失败，主agent新构建后独立阶段验证。
