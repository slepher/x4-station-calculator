# Trade Auto Fill — 技术设计

## 背景与目标

市场报价现有实现使用 useNpcTradeStore 保存交易条件和目标，useNpcTradePresenter 组装分组、商品和报价，NpcTradeWorkbench 展示三列工作区。本 change 在这条链路内增加可编辑的填充操作，不增加适配层。

当前二级菜单通过实际站去重，tradeStation 若已包含在 stationPlan/archive 项中可能不再形成单独 trade option。因此选项 ID 前缀不能作为身份依据，必须对去重后的实体重新挂接当前组 tradeStation 关系。

现有 StationDashboard 的 materialGapItems 会扣 buildingReservation，且相关计算仍位于 Vue。这是历史实现；本 change 不复制该 UI 逻辑，也不扩大为仪表盘重构。自动填充从领域事实计算，仅扣实际入库。

## 架构与职责

| 层 | 职责 | 预期落点 |
|---|---|---|
| store/logic | 站点身份、确认组成员、建材、库存和主产物事实；纯数量计算 | useLiveProductionStore、相关既有领域计算及新的 tradeAutoFill 逻辑 |
| store | checkbox、用户目标、归属、最后触发、有限撤销及动作 | useNpcTradeStore |
| presenter | 读取领域结果，组装标签/明细/提示，编排控件事件 | useNpcTradePresenter |
| vue | 渲染按钮、checkbox、目标及明细，转发事件 | NpcTradeWorkbench |

新的 store/logic 函数是 store 的领域实现，不是 presenter 前后的独立中间层。store 不返回本地化标签、颜色、按钮 DTO 或按 Vue 定制的显示结构。

## 1. 交易上下文与站点归属

### 1.1 显式身份

领域上下文包含 binding gameGuid、已确认 group 标识、当前有效 archive 时间、选中实体 ID、实体身份（trade/station）、方向。实际实体使用当前 archive 内唯一 station code 去重；规划引用与 tradeStation 引用先映射到同一实际身份再合并。未绑定的虚拟实体使用确认计划 ID。

- 命中当前组 tradeStation 的实际或虚拟实体：trade。
- 未命中但属于当前组的 stationPlan/archive 站：station。
- 实际绑定引用缺失、组归属不明确或一个实际站被错误重复归属：unavailable，不任取一个分支。
- 不能因读取不到实际站而转成“虚拟库存零”。

现有 resolveEntrySector 及 selectedPlayerStation 的位置/跳数 contract 继续适用。UI option 增加由领域身份映射出的标签，不改变真实站选取后的距离能力。

### 1.2 成员范围

复用当前 binding 已确认的组成员归属，与左侧同组站点集合一致；包括无 stationPlan 的实际站、虚拟确认计划及该组中转站。不得对每个 coverageSectorMacros 独立遍历后重复累加，也不沿 connectedGroupIds 获取邻组库存。自动分组草稿和未应用规划草稿不参加本次计算。

建立组内唯一成员列表后同时计算需求与库存。普通站的购买用这个组库存，出售只读本站事实。

## 2. 领域事实准备

### 2.1 与工作台选择无关

市场报价计算不能临时修改 live workbench 的 active station、transit mode、moduleScope 或 visualMode 来取得各站数据。应在 store 内复用已有确认目标推导、getArchiveStationDataByCode、StationDerivedMap 和主产物分类能力，提供按显式站点/组读取的领域事实。

事实准备必须验证当前 selected archive 与 binding 归属、期望有效快照、parser 兼容性及 playerStationRecords 已完成加载。不能仅因数组为空就认定整个组库存为零。

### 2.2 建材 R

复用已确认建设目标的 canonical modules 规则：
- 有确认绑定计划：从确认有效目标与 archive 已建、待建状态推导尚待材料的模块集合。
- 无确认计划的实际站：使用 archive 尚待建设模块。
- 明确虚拟规划站：使用确认计划建设模块。

已建模块及材料已经消耗的施工模块不计入；确认目标已包含的 archive 待建模块不再次相加。利用模块 buildCost 聚合为逐商品需求 R，不依赖 costAnalysis 的展示范围，也不在 presenter 扣模块。

实现时校验模块及 buildCost ware 的映射。缺少必须识别的模块/商品返回 unavailable，并报告原因，不能跳过后制造“无缺口”。

### 2.3 建筑库存 B 与普通库存 C

从实际站的明确建材仓库归属读取 building cargo 为 B，station cargo 为 C：
- 建材仓库归属仅按已建立的 station/buildstorage 关系，不按 zone、距离猜测。
- station cargo 中相同 ware 条目先相加，实体只计一次。
- reservation 不计入任何抵扣。
- 完整快照中明确无仓库或空 cargo 可产生零；缺失加载/解析事实则不可用。
- 未绑定虚拟实体 C=0；虚拟中转站不增加自身 R，组内普通规划站仍有确认需求。
- B 超额留在该站建材仓库，不转为普通库存。

每站每商品计算 D=max(0,R-B)，最后汇总 D组 与 C组。不能用 max(0,ΣR-ΣB) 替代 Σmax(0,R-B)。

### 2.4 实际产出与主产物

从有效存档已建模块 outputs 构造本站实际产出集合；组主产物集合为组内每站主产物与实际产出交集的并集。

各站主产物复用领域 resolved priority level 2，与本站实际产出集合相交。已有 archive semantics 和确认规划分类入口继续使用，不在 presenter 发明另一套“最后一层产物”推断规则。必要主产物分类不可解析时显式不可用；合法分类没有主产物为有效空结果。虚拟普通站无实际产出和现货。

生产速率只用于现有分类能力，不参与出售数量；netRate、缓冲小时数、NPC offers 和船容量均不是数量输入。

## 3. 计算结果 contract

领域函数以完整事实、明确身份与方向作为输入，返回互斥结果：

- ready：包含唯一 ware ID、正整数建议数量、逐商品 R/B/D/C 与逐站账目；targets 允许为空。
- unavailable：包含具体原因及关联实体/商品，不携带可应用目标。

ready 的四个分支逐商品执行：
1. trade + buy：建筑 ware 集合，max(0,D组-C组)。
2. trade + sell：实际组主产物 ware 集合，max(0,C组-D组)。
3. station + buy：本站建筑 ware 集合，max(0,D本站-C组)。
4. station + sell：本站实际主产物集合，max(0,C本站-D本站)。

只输出数量>0且当前游戏版本有效的商品，按 wareId 升序形成确定顺序；本地化展示不影响首项主商品的选择。不存在的商品明确不可用，不通过其他 ID 或数量 fallback。

领域账目中分别记录需求 R、建筑库存 B、实际建筑抵扣 min(R,B)、D 和适用普通库存 C，确保超额 B 的解释准确。presenter 可以按站展开明细，但不重算 D。

普通站购买抵扣组库存是单次查询估计，不预留其他站库存；普通站出售只留本站建材。两者与中转站的组级统一留用有明确区别。

## 4. 按钮、checkbox 与填充状态

### 4.1 会话数据

扩展薄 useNpcTradeStore，不写持久化：
- autoFillEnabled：默认 false。
- 最后一次成功填充上下文及原始计算建议，用于结果来源和明细。
- 最后已处理/待处理触发标识，用于等待数据、去重和跨 presenter 挂载保护。
- 目标操作修订计数，用于识别手动调整与过期请求。
- 最近一次成功替换前的 targets、primaryWareId 和归属，用于单次撤销。

数据是交易条件、动作来源和计算事实，不在 store 保存本地化 UI DTO。目标和主商品复用现有 state。

不同 binding 的切换沿用现有条件保存边界，但清理 autoFillEnabled、填充归属、待处理请求和撤销。旧目标即使按现有行为保留，也不能携带属于新 binding 的“自动已更新”标识。

### 4.2 合法触发

| 事件 | checkbox 状态 | 行为 |
|---|---|---|
| 点击按钮 | 任意 | 请求当前上下文填充一次 |
| false -> true | 开启 | 立即请求；数据未齐则等待 |
| true -> false | 关闭 | 取消自动待处理触发，保留目标 |
| 站点/方向/有效快照改变 | 开启 | 请求新上下文，旧请求失效 |
| group 改变 | 开启 | 清理下级选择，选择有效后请求 |
| 上下文改变 | 关闭 | 保留目标，显示需要更新 |
| 目标增删改、排序/跳数等变化 | 任意 | 不产生请求 |
| 同值重选或同上下文重新挂载 | 任意 | 不产生请求 |

按钮每次点击有自己的动作编号，所以相同上下文仍可主动刷新。自动触发使用稳定上下文键去重，不以 computed 对象引用改变作为事件。

必要数据尚未就绪时只等待当前请求，不应用空数组。数据完成后检查请求号、当前 binding、快照、站点、方向及用户目标修订；任何过期结果丢弃。若请求等待期间用户已编辑目标，先前待处理请求失效，避免晚到结果覆盖新编辑；checkbox 不关闭。

确认建设计划变化可使计算事实需要更新，但不因普通派生变化即时覆盖手动目标。下一次按钮或规定的上下文触发使用最新确认事实。

### 4.3 原子替换和手动编辑

成功 ready 一次性替换目标：
- 保存同上下文可撤销的前一个目标/主商品。
- 原主商品仍存在则保留，否则用稳定首项；空列表为 null。
- 记录上下文和建议事实，并更新现有候选派生/分页。
- 不修改排名方式及排序指标，保持原可用性检查。
- 相同 ware 不重复出现，重复填充不累加。

ready 且空也成功替换为空，不能沿用早期“一次按钮无结果保留列表”的讨论草案；最后讨论确定采用清空行为。

用户 addWare/updateTargetQty/removeWare 保持现有能力，只补充动作来源/修订和撤销失效。目标值变为零沿用现有 null 语义，不能立即改回建议值。操作后保持 autoFillEnabled，不建立 targets -> autoFill 的 watch。

撤销动作只恢复同上下文的最近前值，恢复后消耗撤销记录并更新结果来源；撤销本身不属于合法填充触发。上下文改变或目标被手动编辑即清理撤销。

### 4.4 页面重新进入

presenter 可以在挂载时检查当前上下文与已处理键，但不能 unconditional immediate autoFill。store 记录相同 binding 上次已处理上下文，使同条件离开返回时保留编辑。

若离开期间有效快照或所选上下文确实改变，开启模式在数据完整后处理新的上下文；关闭模式仅显示过期提示。

## 5. 界面与文案

在现有左列 ware-search 前增加：

```text
商品目标
[自动填充]  [ ] 随选择自动填充
范围：中转站 · 整个星区组
规则：购买补建材 / 出售扣建材留用

自动填充结果（可修改、移除、手动添加）
船体部件 [2400] 自动 ×
黏土电子 [ 800] 已调整 ×
[撤销本次填充]  ▸ 查看计算明细
```

按钮使用统一“自动填充”，说明文字映射四种规则。checkbox 说明“切换站点或买卖方向时，将替换商品和数量”。关闭模式保留“已调整”提示，开启模式加“下次切换条件将重新填充”。

明细默认折叠，列出原建议与当前数量；用户移除的商品不重新创建药丸。组明细可以展示每站库存、需求、已入建筑仓库和仍需建材，提示“库存分布在组内各站”。所有文案使用应用 zh-CN/en locale。

建议稳定 testid：
- npc-trade-auto-fill-button / npc-trade-auto-fill-enabled
- npc-trade-auto-fill-scope / npc-trade-auto-fill-status
- npc-trade-auto-fill-details / npc-trade-auto-fill-undo
- 原目标数量和移除按钮保持既有 testid。

复用现有 X4NumberInput 与商品搜索，checkbox 使用有 label 的原生 input；不要创建第二套候选搜索或报价列表。

## 6. 风险与验证安排

- 真实站重复引用和覆盖重叠：以确认归属及实体去重作 focused Unit。
- 施工材料和 archive/规划目标双计：复用 canonical 规则并覆盖已建、施工已耗、排队和新增目标。
- reservation 与仪表盘口径不同：测试 reservation 不扣，明细明确已入库。
- 切换/加载/重挂载覆盖编辑：以动作编号、上下文键和修订防止过期应用，focused Unit 覆盖快速切换及重建。
- 建材与主产物识别缺失：返回 unavailable，不能静默生成错误的空目标。
- 每个行为任务随实现写并运行 tests/unit/trade-auto-fill/** 对应测试；Vue 行为尽量由 presenter Unit 验证。
- 实现结束运行 npm run build，编译失败修复后重跑或报告明确 blocker；不运行 build-rust。
- E2E 另走 x4-e2e-test，未来涉及 live binding 时复用 loadLiveBindingFixture，本 tasks 不编排 E2E。

## 商品卡片布局补充

NpcTradeWorkbench 在 Vue 层将商品卡片拆为标题行和控件行。标题行名称占剩余宽度并自然换行，移除按钮不收缩；控件行来源标记靠左，数量输入靠右并扩为 w-28。数量说明仅保留 sr-only 标签，原 testid 与 presenter 事件保持不变，无新增业务行为。
