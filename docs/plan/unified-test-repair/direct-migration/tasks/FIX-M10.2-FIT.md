# FIX-M10.2-FIT

状态：待派发；Astra medium，由主agent分配，禁止再委派。Resolved change: fix-ship-equipment-behaviors，仅FIT/BUG-FIT。

独占：src/components/ship-build/ShipBuildPanelFit.vue；src/components/ship-build/presenters/useShipBuildFitPresenter.ts；src/store/useShipBuildStore.ts；tests/unit/ship/ship-fit-single-candidate-count.spec.ts；change tasks.md的FIT行及bugs.md的BUG-FIT节；../results/FIX-M10.2-FIT.md。Equipment、其他store/helper/fixture/E2E只读，不撤回他人修改，不删debug、不提交。

按diagnosis和change追全caller再改，复用当前合法候选utility及store容量分配；新展示/交互组装进presenter，不新增Vue-store业务路径、不加新层/fallback链、不碰布局三项。若需要fitTypes等额外路径先精确交回，不自扩。不能只改HTML步长或调用保留partial count的旧assign动作来假装修复。

focused Unit先red再green：唯一候选partial→full→clear且不open，0/多候选正常open，DLC/tag/父shield兼容；group总容量与connection步长；异构1+3容量在0/3/4的预演/提交分别0+0/1+2/1+3，preview不写blueprint，slider0保留ID但统计材料不计，清空点击明确null。必要消费者ship-equipment-picker.logic、ship-equipment-selector、ship-build-equipment、ship-build-stat，精确实际路径先rg。

apply不跑browser/全Unit，不擅自build；Unit就绪交主agent。真实困难须列尝试/确定阻碍/未满足/恢复条件，不能同路径无限返工，独立DETAILS/其他任务继续。
