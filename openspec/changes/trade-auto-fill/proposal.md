## Why

市场报价目前需要用户逐个添加商品并输入数量，无法直接将星区组或本站的建筑材料缺口、现货盈余转换成交易目标。中转站与普通站使用不同范围，但下拉选项缺少明确身份，容易将组级汇总误认为本站库存。需要提供一次填充与随选择填充，同时保持用户对商品的编辑权。

## What Changes

- 在现有左侧交易条件区增加“自动填充”按钮和默认关闭的“随选择自动填充”checkbox。
- 下拉菜单按当前 binding tradeStation 关系标记“中转站”，普通项标记“空间站”；同一实际实体只显示一次，保留星区与站名。
- 中转站按整个确认星区组补建筑缺口或出售组内已建模块主产物的现货盈余；普通站购买计算本站缺口并扣组库存，出售只取本站主产物库存扣本站建材留用。
- 建筑仓库逐站抵扣，普通库存统一去重；不扣未入库 reservation，不把未来产量、NPC 报价或推荐缓冲数量当作库存。
- checkbox 开启时勾选、站点/方向/有效存档切换触发填充；按钮不受 checkbox 状态限制。每次有效计算替换整个列表，合法空结果清空，不可用数据保留并标记未更新。
- 允许删除、修改数量和手动添加；手动调整保持到下一次合法填充触发，不立即回填、不自动恢复删除项。
- 添加来源/已调整提示、逐商品与逐站计算明细、同上下文一次撤销和最新上下文保护；会话状态不增加持久化字段。
- 保持 store -> presenter -> vue 三层结构，不增加中间层，不执行真实交易。

## Capabilities

### New Capabilities

- `trade-auto-fill`：市场报价的站点身份、建筑缺口/现货盈余计算、主动与随选择填充、手动编辑和结果状态。

### Modified Capabilities

无。本 change 增量扩展现有市场报价页面，既有报价分类、排序、分页、船只筛选和导航 contract 保持适用。

## Impact

- `src/store/useNpcTradeStore.ts`：自动模式、填充归属、目标替换及有限撤销的会话状态和动作。
- `src/store/useLiveProductionStore.ts`、`src/store/logic/`：明确当前 binding 的组成员/站点身份，提供与当前工作台选择无关的确认建设需求、现货和主产物领域事实。
- `src/components/empire/presenters/useNpcTradePresenter.ts`：组装身份标签、控件状态、明细、触发编排和最新上下文校验。
- `src/components/empire/NpcTradeWorkbench.vue`、应用中英文 locale：控件及展示。
- `tests/unit/trade-auto-fill/**`：各实现任务对应的 focused Unit。E2E 按独立工作流规划，本 change tasks 不编排 E2E。
- 依赖现有 `npc-trade-ui`、save binding 与有效 archive contract；不新增依赖，不改 Rust/parser/WASM 或持久化 schema。
