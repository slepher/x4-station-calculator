# FIX-M3.2

状态：待派发，Astra medium，由主agent分配，不再委派。Resolved change: fix-auto-sector-color-display。

独占：src/components/empire/sector-overview/SectorGroupCard.vue；必要新src/components/empire/sector-overview/presenters/useSectorGroupColorPresenter.ts；src/components/map/layers/MapSectorGroupColorLayer.vue；tests/unit/current/auto-sector-group/autoSectorColorDisplay.spec.ts；该change tasks.md/bugs.md；../results/FIX-M3.2.md。其他src/helper/fixture/E2E冻结。保留既有日志和他人修改，无提交。

读change和M3.2实际red，按x4-bug-fix/apply分阶段。追真实picker输出/事件次序与全部消费者，不能依赖不存在data-color属性或默认蓝色fallback；清空为undefined。层半径2/3只作用fill层，不改变可点击sector几何。需要业务展示组装时用已owned局部presenter，禁止新Vue-store逻辑/额外层，不重构所有色彩路径。

Unit先red再green：真实或忠实当前picker输出的透明/非透明及清空末事件；单/多sector半径、中心及无色隐藏，必要现有颜色/卡片消费者。若提交/reload重新配色需扩域先具体报告。Unit后交主agent协调build，不自开browser/fullUnit/build。原13事务复验不等于补充UI合同全完成。
