# NPC Trade UI - Tasks

## 0. 前置 contract

- [ ] 0.1 确认 `npc-storage` 已提供完整 `NpcTradeOffer`、station 直属 offers 和唯一关联 `buildStorage`
- [ ] 0.2 确认 `save-player-ships` 已提供 archive player ships 与 `selectedArchivePlayerShips` 可用性结果
- [ ] 0.3 若任一前置 contract 缺失，停止 UI 实现并报告 blocker，不添加旧 schema fallback

## 1. Live workbench 导航

- [ ] 1.1 在 `src/types/production-ui.ts`、`src/types/production-workbench-contract.ts` 与 `src/store/useActiveViewStore.ts` 的 live mode contract 中新增 `npc-trade`
- [ ] 1.2 在 `src/components/empire/presenters/useProductionSidebarPresenter.ts` 增加 live-only 市场报价固定入口、active state 和 select event
- [ ] 1.3 在 `src/components/empire/ProductionSidebar.vue` 将市场报价放在 overview 与 blueprint-recipe 之间，并补充稳定 testid/icon 路由
- [ ] 1.4 在 `src/components/empire/LiveProductionWorkbenchView.vue` 接入 `NpcTradeWorkbench`；blueprint workbench 不增加入口

## 2. 报价领域逻辑

- [ ] 2.1 新增 `src/store/logic/npcTradeOffers.ts`，定义玩家方向、ware target、需求来源和 station 候选的基础领域类型
- [ ] 2.2 从 station 直属 flags 与 buildStorage 容器分类空间站自身、空间站补给和建材仓库需求；seller 只读取 station 直属 offers
- [ ] 2.3 实现数量、方向化价格、足量价格、目标总收入/成本的单 ware comparator
- [ ] 2.4 实现主商品排序和多 ware 综合评分，缺失 ware 明确贡献 0，不使用其他报价 fallback
- [ ] 2.5 实现 sector 包装排序：组内复用 station comparator，sector 取组内最高 station 作为代表
- [ ] 2.6 在同一领域模块维护单一 faction→race 显式映射；无法映射时返回 unknown

## 3. 市场报价 presenter

- [ ] 3.1 新增 `src/components/empire/presenters/useNpcTradePresenter.ts`，只通过 presenter 读取 save、binding、game data 与 active-view stores
- [ ] 3.2 在 presenter 中维护方向、玩家空间站、搜索词、ware targets、主商品、排序指标和 sector 分组开关等会话状态
- [ ] 3.3 从 active binding 的 groups、stationPlans 和 tradeStation 组装玩家空间站 selector；缺失 sector 的 entry 明确禁用
- [ ] 3.4 复用 `generateFilteredWaresGrouped` 生成多语言商品搜索结果，并实现唯一药丸的添加、数量更新和移除事件
- [ ] 3.5 关联 maps/factions/locales/wares，组装包含 sector、station 名称/类型、code、faction 和 race 的候选 station cards
- [ ] 3.6 从 `selectedArchivePlayerShips` 过滤 available/reclaimable，按 sector 分组，并收集 anchor/coverage 命中的全部 binding group 名称
- [ ] 3.7 输出 context unavailable、station not selected、wares empty、target missing、no matches 和 results 等互斥状态

## 4. 三列 Vue 页面

- [ ] 4.1 新增 `src/components/empire/NpcTradeWorkbench.vue`，使用 `grid-cols-12` 与 `lg:col-span-3/5/4`
- [ ] 4.2 左列渲染玩家方向、整理后的空间站 selector、ware search 和目标数量药丸
- [ ] 4.3 中列渲染排序控制、sector 分组开关、完整 station 身份及方向对应报价层级
- [ ] 4.4 玩家卖出时在 station card 内分别展示自身、补给、buildStorage 子需求；玩家买入时展示 station seller offer
- [ ] 4.5 右列按 sector 渲染 available/reclaimable ships，并显示命中的全部 sector group 名称
- [ ] 4.6 Vue 只消费 `useNpcTradePresenter` 的 props/emits，不直接 import 或调用 store，不在组件内重新分类、排序或分组
- [ ] 4.7 页面不渲染 archive filename、bindingName 或 snapshot time

## 5. 文案与构建

- [ ] 5.1 在 `src/locales/en.json` 与 `src/locales/zh-CN.json` 增加入口、方向、需求来源、排序、sector 分组、船只状态和空状态文案
- [ ] 5.2 检查所有新增交互具备可访问 label、键盘可操作控件和稳定 testid
- [ ] 5.3 运行 `npm run build`，修复本 change 引入的编译错误直至通过或形成明确 blocker
