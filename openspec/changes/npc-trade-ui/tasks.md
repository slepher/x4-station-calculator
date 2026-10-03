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
- [x] 3.2 在 presenter 中维护方向、玩家空间站、搜索词、ware targets、主商品和排序指标等会话状态
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

## 8. 共用分组候选控件

- [x] 8.1 提取无 store 依赖的 `CandidateSearchBox`，统一 query、focus/blur、清空、Escape 和右侧锚点定位
- [x] 8.2 提取无 store 依赖的 `GroupedCandidatePopover`，统一 Teleport、分组标题、颜色、DLC 标签和候选选择事件
- [x] 8.3 市场报价聚焦空查询时显示当前 `wares.json` 中全部未选择商品，并继续复用 `generateFilteredWaresGrouped` 分组和多语言搜索
- [x] 8.4 市场报价不得按当前 archive 实际报价、production module 或 transport 缩减商品候选；TEMP 商品过滤留在游戏数据生成阶段
- [x] 8.5 为 BuildPlan 商品/模块与空间站模块选择增加 presenter 候选组装并复用两个 common 控件，保持既有领域筛选和选择行为
- [x] 8.6 保持 BuildPlan 舰队入口继续使用 `FleetGoalSearchBox`，不纳入商品/模块候选 DTO
- [x] 8.7 运行 `npm run build`，修复共用候选控件改动引入的编译错误直至通过或形成明确 blocker
- [x] 8.8 在应用中英文 locale 增加 `common.others`，并由商品候选 presenter 本地化 `others` 分组标题，不修改游戏文本 locale

## 9. 页面会话状态边界

- [x] 9.1 新增薄 `useNpcTradeStore`，在当前应用会话保存方向、跳数、ware targets、主商品、排名/排序和 binding 上下文选择，不写入持久化 schema
- [x] 9.2 由 presenter 读取薄 store，并使用 `bindingGameGuid` 隔离不同 binding 的 group/station；保留既有 immediate station option 失效校验
- [x] 9.3 搜索文字和候选弹窗继续作为临时交互状态，NPC/船只候选、距离、页面状态与展示分组继续从当前依赖派生，不写入薄 store
- [x] 9.4 报价展示 DTO 和 Vue 行只保留来源、amount 与 price，不展示 archive 的 desired
- [x] 9.5 完成代码后运行 `npm run build`，修复本轮引入的编译错误直至通过或形成明确 blocker

## 10. NPC 交易资格与固定分组

- [x] 10.1 在报价领域逻辑中按 `notradeoffer`、raw relation `-0.01` 边界将 station candidates 分为硬排除、声望合格和声望不足，继续复用既有 comparator 与 sector grouping
- [x] 10.2 从薄 `useNpcTradeStore` 与 presenter contract 删除 `groupBySector`，固定生成正常 sector 分组和底部声望不足 faction→sector 分组
- [x] 10.3 在 presenter 中将 sector/faction/跳数组装到 sector 标题，将 display 声望组装到声望不足 faction 标题，并从 station card 删除重复共享字段
- [x] 10.4 在 `NpcTradeWorkbench` 删除 sector checkbox，渲染正常 sector 列表与默认折叠的底部 faction→sector 列表，并保持 same-sector 精确距离为 station 自身信息
- [x] 10.5 同步中英文声望不足分组与 display 声望文案，删除不再使用的 sector checkbox 文案
- [x] 10.6 运行 `npm run build`，修复本轮引入的编译错误直至通过或形成明确 blocker
- [x] 10.7 将 station 来源文案按玩家方向映射：买入显示“空间站出售”，卖出继续显示“空间站自身需求”，并同步中英文 locale
- [x] 10.8 在 presenter 中从 map sector 独立解析可空 sector owner；正常 station card 仅在 station owner 与 sector owner 不同时输出 station owner，sector owner 为空时必须输出 station owner
- [x] 10.9 在正常与声望不足 sector 标题显示非空 sector owner；声望不足列表继续按 station owner 判断声望、折叠和显示 display 声望，且 card 不重复父级 station owner
- [x] 10.10 运行 `npm run build`，修复本轮引入的编译错误直至通过或形成明确 blocker

## 11. 候选分页与延迟挂载

- [x] 11.1 在 presenter 中先完成正常候选排序与 sector grouping，再以每页 10 个完整 sector 切片并只构造当前页 station card DTO
- [x] 11.2 声望不足 faction 折叠时输出空 sectors；展开后在 faction 内按每页 10 个完整 sector 分页并只构造当前页 cards
- [x] 11.3 在 presenter 保存临时 normal/faction/ship 页码与 faction 展开集合，候选或船只依赖变化时重置，不写入薄 store
- [x] 11.4 在 Vue 中增加可访问的上一页/下一页控件，以受控 `<details>` 和 `v-if` 避免挂载折叠 faction 内容
- [x] 11.5 保留玩家船只现有 sector 分组，并复用每页 10 个完整 sector 的分页规则；船只集合变化时重置页码
- [x] 11.6 同步中英文候选与船只分页文案，并运行 `npm run build` 修复编译错误直至通过或形成明确 blocker

## 后续展示调整

原 3.6/4.5/5.1 的逐船容量展示由 `../trade-auto-fill/tasks.md` 第 9 节替代：型号与装载量独立成卡片，跨星区按 macro 去重；保留本文件已完成任务作为原实现记录。
