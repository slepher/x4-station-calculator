# Trade Auto Fill Specification

## Purpose

定义存档绑定工作台市场报价中的中转站/空间站身份、建筑材料缺口与现货盈余自动填充、随选择触发和手动编辑行为。自动填充产生可编辑的查询目标，不执行真实交易。

## ADDED Requirements

### Requirement: Station identity and group scope

系统 SHALL 使用当前 binding 的 tradeStation 关系识别中转站，并在玩家站点下拉菜单显示本地化身份、星区与站名；同一实际站 MUST 只出现一次。组级计算 SHALL 复用已确认分组的站点成员归属，不通过重叠地理覆盖重新构造成员。

#### Scenario: Actual trade station also has station plan

**前提** 同一实际站同时由 stationPlan 与 tradeStation 引用
**当** 生成玩家站点选项
**那么** 只显示一个“中转站 · <星区> · <名称>”选项
**并且** 选择该项使用组级计算，而非普通站计算

#### Scenario: Group covers multiple physical sectors

**前提** 当前中转站管理的确认星区组包含多个物理星区
**当** 计算中转站购买或出售目标
**那么** 汇总整个组的唯一玩家站点及中转站自身
**并且** 不沿 connectedGroupIds 扩展到其他组，不计入 NPC 或其他组成员

#### Scenario: Virtual entity is explicit

**前提** binding 中存在明确的虚拟中转站或虚拟普通站
**当** 执行自动填充
**那么** 虚拟中转站使用真实组成员事实，自身库存为零
**并且** 虚拟普通站购买使用确认规划需求及组库存，出售没有自身现货
**并且** 实际绑定记录缺失 MUST NOT 被判定为虚拟实体

### Requirement: Construction demand and owned building stock

系统 SHALL 逐站逐商品计算 R 为尚待建设材料、B 为本站所属建筑仓库已入库材料、D = max(0, R - B)。R SHALL 由确认建设目标与当前有效存档建设状态推导，排除已建成与已消耗材料的施工部分、未应用草稿及重复规划计数。

#### Scenario: Building stock exceeds one station demand

**前提** A 站 R=100、B=150，B 站 R=80、B=0，均为同一商品
**当** 汇总全组尚需建材 D组
**那么** D组 为 0+80=80
**并且** A 建筑仓库的多余 50 不抵扣 B，不作为出售库存

#### Scenario: Target includes archive queued module

**前提** 一个尚未施工的模块已存在于 archive 待建记录，也包含在确认目标中
**当** 计算 R
**那么** 只计该模块一次
**并且** 已建成和已耗材料的施工模块不再次计入所需建材

#### Scenario: Actual station has no planning binding

**前提** 实际站已属于当前确认组，但不存在 stationPlan
**当** 汇总组建筑需求
**那么** 该站有效存档的待建需求仍计入
**并且** 未应用规划草稿不计入

#### Scenario: UI view toggles do not alter demand

**前提** 同一 binding、确认目标和有效存档保持不变
**当** 切换仪表盘模块范围或 live/planning 显示
**那么** 自动填充所用 R、B、D 不变

### Requirement: Ordinary inventory boundary

系统 SHALL 从当前有效存档提取本站普通库存 C，按唯一实际实体汇总 C组。建筑仓库、NPC、运输船货物、未入库 reservation、未来产量和推荐缓冲 MUST NOT 作为 C。

#### Scenario: Duplicate actual entity has one inventory contribution

**前提** 同一站有 planning、archive 与 tradeStation 多种引用
**当** 汇总 C组
**那么** 该实际站普通库存只计一次，建筑仓库不混入普通库存

#### Scenario: Reservation has not arrived

**前提** 某站 R=100、B=20、组普通库存=30，另有未入库 reservation=50
**当** 计算该商品建筑采购缺口
**那么** 尚需建材为 80，建议购买为 50
**并且** 明细注明仅扣已入库材料

### Requirement: Trade station buy targets

玩家购买且所选对象为中转站时，系统 SHALL 对全组建筑材料逐商品计算 max(0, D组 - C组)，只生成正数目标。

#### Scenario: Aggregate after per-station building deduction

**前提** A 站 R=8000、B=3000，B 站 R=4000、B=1000，组普通库存=6000
**当** 点击自动填充或发生有效自动触发
**那么** D组=8000，该商品购买数量为 2000
**并且** C组只抵扣一次，不分别用于两个站后相加

### Requirement: Trade station sell targets

玩家出售且所选对象为中转站时，系统 SHALL 只在组内各站领域主产物（resolved priority level 2）与各自已建模块实际产出的交集并集中，逐商品计算 max(0, C组 - D组)。数量 SHALL 使用现有库存而非生产速率；某商品库存可来自组内任意普通仓库。

#### Scenario: Group stock exceeds construction reserve

**前提** 某商品为组内已建模块主产物，D组=8000、C组=11000
**当** 自动填充中转站出售
**那么** 该商品出售数量为 3000
**并且** 明细说明其库存分布在组内各站，不表示都在中转站

#### Scenario: Purchased stock is not locally produced

**前提** 组内有某商品普通库存，但没有任何已建模块产出该商品
**当** 自动填充中转站出售
**那么** 该商品不自动加入
**并且** 用户仍可通过原商品搜索手动添加

#### Scenario: Secondary output inventory is excluded

**前提** 组内某商品有已建模块产出和现货库存，但在各站均只被分类为副产物
**当** 自动填充中转站出售
**那么** 该商品不自动加入；若任何一个实际生产站将其分类为主产物，则按全组普通库存减全组建材计算
**并且** 仅未建成模块的未来主产物不能据此加入

### Requirement: Ordinary station buy targets

玩家购买且所选对象为普通空间站时，系统 SHALL 对本站建筑材料逐商品计算 max(0, D本站 - C组)，不将其他站建筑需求加到本站目标。

#### Scenario: Group stock can cover station demand

**前提** 本站 R=8000、B=3000、C本站=4000、C组=6000
**当** 自动填充本站购买
**那么** 本站 D=5000，该商品不生成购买目标
**并且** 不把其他站的需求计入本站采购量

### Requirement: Ordinary station primary-product sell targets

玩家出售且所选对象为普通空间站时，系统 SHALL 将本站领域主产物分类（resolved priority level 2）与存档已建模块产出相交，仅对该集合逐商品计算 max(0, C本站 - D本站)。

#### Scenario: Reserve station construction materials

**前提** 某商品为本站已建模块主产物，D本站=5000、C本站=7000
**当** 自动填充本站出售
**那么** 数量为 2000
**并且** 不加上其他站库存，不额外扣除其他站建材

#### Scenario: Exclude secondary or future outputs

**前提** 某商品是副产物、纯输入材料或仅由尚未建成模块产出
**当** 自动填充本站出售
**那么** 不自动加入该商品，即使当前有普通库存

### Requirement: Manual fill button

系统 SHALL 在商品搜索框上方提供自动填充按钮、checkbox 与范围说明。按钮 SHALL 在有效上下文中执行一次填充，不受 checkbox 开关限制；无有效选择或必要数据不完整时 MUST 禁用并解释原因。

#### Scenario: Button works in both modes

**前提** 已选有效站点且所需数据完整
**当** 用户在 checkbox 开启或关闭时点击按钮
**那么** 都按当前条件执行一次填充并更新市场报价目标

### Requirement: Follow-selection checkbox triggers

checkbox SHALL 默认关闭；开启时立即请求当前有效上下文的填充，开启后的站点、方向或有效快照切换 SHALL 请求新填充。组切换清理下级选择，待选择有效且数据完整后执行。相同值重选、目标编辑及报价筛选变化 MUST NOT 触发填充。

#### Scenario: Enable before context is ready

**前提** 尚未选站或所需数据加载中
**当** 用户开启 checkbox
**那么** 不清空现有列表
**并且** 当前选择与数据变为完整后只执行当前上下文的待处理填充

#### Scenario: Change station or direction while enabled

**前提** checkbox 开启，当前目标包含手动调整
**当** 用户切换有效站点或购买/出售方向
**那么** 按新的上下文替换整个目标列表
**并且** 不沿用上一次站点或方向的数量

#### Scenario: Group selection temporarily clears station

**前提** checkbox 开启
**当** 用户更换星区组
**那么** 先清除失效的下级选择，不用旧站和新组混算
**并且** 新站点选择有效后填充一次

#### Scenario: Disable preserves targets

**前提** 已存在填充结果
**当** 取消勾选
**那么** 保留当前商品、手动调整与数量，停止随选择填充

#### Scenario: Non-trigger changes preserve edits

**前提** checkbox 开启且有手动调整
**当** 修改目标、搜索、跳数、主商品、排序、分页或发生报价派生变化
**那么** 不触发回填、不恢复删除项
**并且** 重选同一站点、同一方向或同一快照也不触发

### Requirement: Editable replacement targets

每次成功填充 SHALL 替换整份目标，不追加、不累加。自动来源商品 SHALL 与手动商品一样允许改数量、删除和手动添加；手动操作 MUST NOT 关闭 checkbox 或立即重新生成目标。

#### Scenario: Removed auto target stays removed

**前提** checkbox 开启，某商品由自动填充生成
**当** 用户删除该商品
**那么** 该商品保持移除，checkbox 保持开启
**并且** 只有下一次按钮点击或合法条件切换才重新计算它是否应加入

#### Scenario: Edited quantity is preserved

**前提** 自动填充建议数量为 2000
**当** 用户修改为 1200
**那么** 现有报价查询使用 1200，并显示已调整提示
**并且** 普通响应式派生、重渲染或重挂载不覆盖该数量

#### Scenario: Edit while previous fill is waiting

**前提** 先前填充请求正在等待完整数据
**当** 用户手动修改数量、移除或添加商品
**那么** 该先前待处理请求失效，晚到结果不能覆盖新编辑
**并且** checkbox 保持原状态，下次合法触发仍可填充

#### Scenario: Manual empty quantity uses existing validation

**前提** 用户将某目标改为零或未填写
**当** 应用该编辑
**那么** 沿用现有空目标及排序可用性规则，不以原建议数量补回

#### Scenario: Repeated fill is not cumulative

**前提** 相同上下文和事实的建议数量为 2000，列表中已存在该商品
**当** 再次填充
**那么** 该商品只出现一次，目标仍为 2000

### Requirement: Empty and unavailable results

系统 SHALL 区分有效空结果和不可用结果。有效空结果 MUST 替换为空并清理主商品；不可用结果 MUST 保留目标并标记未更新，不能用零库存 fallback。快速切换期间过期结果 MUST NOT 写入。

#### Scenario: Valid result contains no targets

**前提** 当前完整事实显示购买已无缺口或出售已无盈余
**当** 发生合法填充
**那么** 清空当前目标和主商品，分别提示“建筑材料已满足”或“没有可出售盈余”
**并且** 不保留上一站目标冒充本次结果

#### Scenario: Required facts are unavailable

**前提** 实际站映射失败、建材未知或当前 archive 数据尚未完整
**当** 请求填充
**那么** 保留目标，显示具体不可用原因并标记未更新
**并且** 不把缺失实际站、未知库存或未加载数据当零

#### Scenario: Context changes during data loading

**前提** A 上下文的填充请求等待数据，用户已改选 B
**当** A 的结果或数据到达
**那么** A 的结果被丢弃，仅允许 B 的有效最新触发应用

### Requirement: Session ownership and freshness

自动模式、目标和填充归属 SHALL 在当前 binding 应用会话中保留，不写持久化 schema。离开返回页面 SHALL 保留手动修改，不因 presenter 重建再次填充。关闭模式下上下文变化 SHALL 标记结果需要更新。binding 切换 SHALL 隔离自动归属并清理撤销。

#### Scenario: Return to same context after editing

**前提** 用户已手动删改，离开市场报价后返回同一 binding 和上下文
**当** presenter 重建
**那么** 保留 checkbox 和编辑结果，不再次自动填充
**并且** 应用刷新后自动模式默认关闭

#### Scenario: Context changes while checkbox is off

**前提** 有已应用填充结果且 checkbox 关闭
**当** 更换站点、方向或有效快照
**那么** 目标不被替换，但显示条件变化及需重新填充提示

#### Scenario: Switch binding

**前提** 当前 binding 的 checkbox 开启且有填充和撤销状态
**当** 切换到另一 binding
**那么** 清理旧填充归属与撤销，自动模式恢复关闭
**并且** 旧绑定结果不能作为新 binding 的自动结果

### Requirement: Single-context undo and primary target validity

系统 SHALL 保存同一上下文最近一次成功替换前的目标与主商品以供一次撤销。目标编辑或上下文改变后撤销 SHALL 失效。替换后主商品 SHALL 保留仍存在的原主商品，否则使用稳定顺序首项，空列表设为 null。

#### Scenario: Undo successful replacement

**前提** 在同一上下文执行过一次有效填充，之后没有编辑目标
**当** 点击撤销本次填充
**那么** 恢复填充前目标和主商品，checkbox 不变
**并且** 不再因此次恢复触发填充

#### Scenario: Edit or context change invalidates undo

**前提** 存在可撤销结果
**当** 用户编辑目标或切换交易上下文
**那么** 撤销入口失效，不能恢复旧上下文列表覆盖当前内容

#### Scenario: Primary target no longer exists

**前提** 原主商品不在新的非空结果中
**当** 应用填充结果
**那么** 选择确定顺序的第一项为主商品
**并且** 原排序模式和指标不自动改写，继续按现有规则校验

### Requirement: Explainable results and market independence

presenter SHALL 提供来源、已调整、范围与逐商品计算明细，组级明细可展开各站库存和建材。填充目标 MUST NOT 根据 NPC 报价存在性、报价量或船只容量截断；不新增生产缓冲扣减或实际预留。

#### Scenario: Valid target has no NPC match

**前提** 计算产生正数目标但无 NPC 匹配报价，或数量大于单艘船载量
**当** 应用填充
**那么** 保留完整目标，并沿用原报价空状态和船只载量展示

#### Scenario: Show adjusted source and accounting

**前提** 有自动填充结果，部分数量已手动改动
**当** 展示目标及明细
**那么** 显示原计算建议与当前已调整数量，删除项不复活
**并且** 明细中的 R、B、D、C、建议数量来源清楚且不重复扣减

### Requirement: Three-layer implementation

实现 MUST 严格遵循 store -> presenter -> vue。领域状态和可复用计算属于 store/logic；UI DTO、文案与交互编排属于 presenter；Vue MUST 只读取 presenter 和转发事件，不引入额外适配层或直接依赖 store。

#### Scenario: Render auto-fill controls

**当** 实现控件、明细和事件
**那么** Vue 只消费 presenter props/emits
**并且** 新逻辑不修改 parser、Rust/WASM 或持久化 schema，应用中英文文案保持一致

### Requirement: 商品名称优先显示

商品卡片 SHALL 使用两行布局，第一行显示完整可换行名称及移除按钮，第二行显示来源及右对齐数量输入。系统 SHALL NOT 显示“目标数量”说明字样，但 SHALL 保留包含商品名的可访问数量标签。

#### Scenario: 窄侧栏展示较长商品名

**当** 窄侧栏列出长名称及六位数量的自动填充商品
**那么** 名称可以换行且不省略，数量与来源不挤占名称行；数量编辑与移除仍调用原 presenter 动作
