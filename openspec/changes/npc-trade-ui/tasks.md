# NPC Trade UI - Tasks

## 0. 前置 contract

- [x] 0.1 确认 `npc-storage` 已提供完整 `NpcTradeOffer`、station 直属 offers 和唯一关联 `buildStorage`
- [x] 0.2 确认 `save-player-ships` 已提供 archive player ships 与 `selectedArchivePlayerShips` 可用性结果
- [x] 0.3 若任一前置 contract 缺失，停止 UI 实现并报告 blocker，不添加旧 schema fallback

## 1. Live workbench 导航

- [x] 1.1 在 `src/types/production-ui.ts`、`src/types/production-workbench-contract.ts` 与 `src/store/useActiveViewStore.ts` 的 live mode contract 中新增 `npc-trade`
- [x] 1.2 在 `src/components/empire/presenters/useProductionSidebarPresenter.ts` 增加 live-only 市场报价固定入口、active state 和 select event
- [x] 1.3 在 `src/components/empire/ProductionSidebar.vue` 将市场报价放在 overview 与 blueprint-recipe 之间，并补充稳定 testid/icon 路由
- [x] 1.4 在 `src/components/empire/LiveProductionWorkbenchView.vue` 接入 `NpcTradeWorkbench`；blueprint workbench 不增加入口

## 2. 报价领域逻辑

- [x] 2.1 新增 `src/store/logic/npcTradeOffers.ts`，定义玩家方向、ware target、需求来源和 station 候选的基础领域类型
- [x] 2.2 从 station 直属 flags 与 buildStorage 容器分类空间站自身、空间站补给和建材仓库需求；seller 只读取 station 直属 offers
- [x] 2.3 实现数量、方向化价格、足量价格、目标总收入/成本的单 ware comparator
- [x] 2.4 实现主商品排序和多 ware 综合评分，缺失 ware 明确贡献 0，不使用其他报价 fallback
- [x] 2.5 实现 sector 包装排序：组内复用 station comparator，sector 取组内最高 station 作为代表
- [x] 2.6 删除本页未要求的 faction→race 映射与 race 输出，保留现有 faction 本地化

## 3. 市场报价 presenter

- [x] 3.1 新增 `src/components/empire/presenters/useNpcTradePresenter.ts`，只通过 presenter 读取 save、binding、game data 与 active-view stores
- [x] 3.2 在 presenter 中维护方向、玩家空间站、搜索词、ware targets、主商品、排序指标和 sector 分组开关等会话状态
- [x] 3.3 从 active binding 的 groups、stationPlans 和 tradeStation 组装玩家空间站 selector；缺失 sector 的 entry 明确禁用
- [x] 3.4 复用 `generateFilteredWaresGrouped` 生成多语言商品搜索结果，并实现唯一药丸的添加、数量更新和移除事件
- [x] 3.5 复用地图 tooltip station label helper，组装包含 sector、同源 station 名称、code 和 faction 的候选 cards
- [x] 3.6 从当前 binding archive 船只中只保留 available/reclaimable 的 L freighter 与 M transporter，组装本地化船名/型号、尺寸、有效自定义名称、容量和 sector groups
- [x] 3.7 输出互斥页面状态，禁用缺少正目标数量的排序选项并指出对应 ware
- [x] 3.8 以 `binding.gameGuid + selectedArchiveTime` 精确校验当前 archive，并在 live workbench 挂载时恢复 binding archive，隔离地图预览状态
- [x] 3.9 binding 或 station options 改变时清除失效的 session station selection
- [x] 3.10 为 NPC station 与玩家船只组装相对所选空间站的位置：同 sector 距离、不同 sector 跳数（允许 0 跳）、数据缺失 unknown

## 4. 三列 Vue 页面

- [x] 4.1 修正 scoped CSS specificity，确保宽屏真实呈现 `3/5/4`，窄屏保持三列纵向堆叠
- [x] 4.2 左列渲染玩家方向、整理后的空间站 selector、ware search 和目标数量药丸
- [x] 4.3 中列渲染目标数量约束的排序控制、sector 分组、无 race 的完整 station 身份、相对位置及报价层级
- [x] 4.4 玩家卖出时在 station card 内分别展示自身、补给、buildStorage 子需求；玩家买入时展示 station seller offer
- [x] 4.5 右列按 sector 渲染合格运输船身份、容量、相对位置和命中的全部 sector group 名称，不显示 ID/code
- [x] 4.6 Vue 只消费 `useNpcTradePresenter` 的 props/emits，不直接 import 或调用 store，不在组件内重新分类、排序或分组
- [x] 4.7 页面不渲染 archive filename、bindingName 或 snapshot time

## 5. 文案与构建

- [x] 5.1 同步中英文目标数量、船名/型号/尺寸、容量/载量、跳数/距离与未知状态文案，并删除 race 文案
- [x] 5.2 检查所有新增交互具备可访问 label、键盘可操作控件和稳定 testid
- [x] 5.3 运行 `npm run build`，修复本 change 引入的编译错误直至通过或形成明确 blocker

## 6. Player ship archive contract

- [x] 6.1 在 Rust parser player ship 输出与 TypeScript archive 类型中保留已解析 world position
- [x] 6.2 `selectedArchivePlayerShips` 只携带距离所需 position，移除不再用于 UI 的 cargo 传播

## 7. 用户验收修正

- [x] 7.1 修正 virtual station draft 写入 binding 的 groupId，统一使用稳定 `sectorMacro`
- [x] 7.2 将玩家空间站 selector 改为 sector group 一级与 station 二级菜单，并在切换/数据失效时清理下级选择
- [x] 7.3 实际绑定站从当前 binding archive 精确解析 position，虚拟站使用地图星区中心且不以 `(0,0,0)` fallback
- [x] 7.4 商品目标数量与最大跳数使用现有 `X4NumberInput`
- [x] 7.5 最大跳数同时过滤 NPC candidates 与玩家船只，同 sector 为 0 跳、未知排除
- [x] 7.6 船只为所有所选 ware 显示 `floor(capacity / volume)` 最大可装数量，不读取 targetQty 或当前 cargo
- [x] 7.7 同步中英文二级菜单、最大跳数与最大可装数量文案
- [x] 7.8 运行 `npm run build`，修复本轮变更引入的编译错误直至通过或形成明确 blocker
- [x] 7.9 二级菜单复用左侧同 group 的玩家空间站集合，加入未绑定实际站的虚拟 tradeStation，并按实际站去重
- [x] 7.10 二级菜单空间站名称只显示一次，选择完成后隐藏“选择空间站”占位 option
- [x] 7.11 市场报价复用 `mapSectorGraph` 动态计算当前最大跳数范围，移除 5 跳静态缓存限制与 99 的 UI 上限
- [x] 7.12 玩家空间站二级菜单按 `<sector>-<station>` 显示本地化星区与空间站名称
