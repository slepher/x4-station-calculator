# FIX-M10.2-DETAILS

状态：待派发；Astra medium，由主agent分配，禁止再委派。Resolved change: fix-ship-equipment-behaviors，仅DETAILS/BUG-DETAILS。

独占：src/components/ship-build/ShipBuildPanelEquipment.vue；src/components/ship-build/presenters/useShipBuildEquipmentPresenter.ts；tests/unit/ship/ship-equipment-canonical-details.spec.ts；change tasks.md的DETAILS行及bugs.md的BUG-DETAILS节；../results/FIX-M10.2-DETAILS.md。Fit/store/stats共享接口/E2E/helper/fixture只读，不撤回他人修改，不删debug、不提交。若与FIT并行，共享tasks/bugs交主agent集中写，避免抢写。

依diagnosis/change迁入本次metrics和summary展示组装到presenter；补canonical turret/engine字段，用已有details.travelCharge组成travel。保留current/candidate/diff/max、现有额外字段和其他类型，不改变共享summary数字接口/物理公式，不改布局阈值，不引入fallback链或新适配层。

实际mounted/presenter与真实stats focused Unit红绿：beam54/range5000/热0完整字段；engine960/7.38/10089.6及speed:charge的固定输入预期；shield/thruster/null/current-only/diff/max对照。有限消费者build-ship-equipment-panel、ship-build-stat。apply不跑browser/全Unit，不自开build；就绪交主agent协调。

若缺物理数据/新语义必须具体报告，不能编造值或恢复旧布局来迁就测试。保留全部当前失败证据，真正困难只阻塞本合同与实际依赖闭包。
