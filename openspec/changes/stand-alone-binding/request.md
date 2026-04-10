# stand-alone-binding Change Request

## 目标

将 save binding 从 empire localStorage 与 empire 星区模型中彻底剥离，改为以 `gameGuid` 为唯一身份的独立 binding 存储。binding 用于描述某个存档的星区划分、补给站定位、覆盖范围、按需规划模块，以及用户明确创建的未来占位站；量化生产界面可以在普通 empire 与 save binding 两类生产数据源之间切换。

## 已确认方案（审核重点）

### 1. Binding 独立存储

- 新增独立 `x4_save_bindings` localStorage 模块，保存所有 `SaveBindingPlan`。
- `SaveBindingPlan` 以 `gameGuid` 为全局唯一键；同一个 `gameGuid` 只能存在一份 binding。
- `selectedArchiveTime` 只表示当前 binding 视角，不参与 binding 身份。
- binding 改动使用独立 dirty 状态和显式 `保存绑定` 操作，不再依赖 `保存帝国`。
- 绑定功能尚未发布，本次不需要兼容或迁移旧 `EmpirePlan.saveBindings` 数据。

### 2. Empire 模型边界

- `EmpirePlan` 回到纯规划集合，只保存 empire 名称与 station 规划。
- save binding 相关字段不再写入 `EmpirePlan`。
- 星区功能从 empire 中取消；binding 星区只存在于 `SaveBindingPlan.groups`。
- 星区总览中的星区管理界面需要移除：`empire` 不再需要星区管理，`save-binding` 自带 Step 2 星区管理，也不应在该入口重复管理。
- 移除星区管理界面后，原左侧区域需要保留布局占位，避免右侧资源视图扩张导致总览布局跳变。
- 已复制到 binding 的规划模块与原 empire station 没有任何同步关系。

### 3. Binding 星区和补给范围

- 用户在 binding 内决定星区怎么分、每个星区锚定哪个存档星区、覆盖哪些范围，以及星区补给站如何定位或划给哪个范围内的空间站。
- `BindingSectorGroup` 保存名称、顺序、定位星区、jump range、coverage 和 connected groups。
- Step 2 的新建星区入口不直接创建空 group；它复用编辑星区时的定位星区选择菜单，用户点击一个可用存档星区后才创建 group。
- 新建时选中的存档星区就是 group 的定位星区，group 默认名称使用该定位星区显示名称；候选菜单的禁用逻辑与编辑定位星区完全一致。
- save station 属于哪个 binding group 由当前 archive 与 group coverage 自动派生。
- 用户不需要逐个把现有 save station 绑定到 binding；覆盖范围内的 save stations 自动出现在 binding 视图中。

### 4. Binding station 与规划模块

- save station 本体来自 save archive，是派生视图，不应在进入 binding 时自动物化为 `SaveStationPlan`。
- `SaveStationPlan` 只表示用户维护过的 save station 规划层数据。
- save station 的规划模块按需创建：
  - 用户从 empire station 导入规划模块到某个 save station 时创建或更新。
  - 用户在量化生产界面修改某个 save station 的规划模块时创建或更新。
  - 用户清空规划模块时可以删除对应 plan，使该 save station 回到“规划 modules 为空”的派生状态。
- `SaveStationPlan.modules` 与 `BindingSectorGroup.virtualStation.modules` 永远表示“规划 modules / 建设目标 modules”，是量化生产唯一读取的 binding 模块来源。
- save station 自身解析出的模块列表与规划 modules 共存，但 save modules 如何展示、比较或导入不在本次迁移方案讨论。
- 如果没有导入或修改规划模块，save station 的规划 modules 视为空列表。

### 5. Virtual station 语义

- `virtual-station` 是用户明确创建的“当前存档还没有建好的空间站占位”，存放在所属 `BindingSectorGroup.virtualStation` 单体字段中。
- virtual station 不来自解绑残留；解绑或换绑不应生成 virtual station。
- 删除、解绑或换绑 save station 规划时，相关 save station plan 应直接消失或转为无规划状态，而不是保留为 virtual station。
- virtual station 自身有名称、类型、规划 modules、settings、定位信息，并参与量化生产。

### 6. 空间站蓝图导入

- Step 3 的候选空间站显示为“空间站蓝图”，而不是自由空间站。
- binding 可以记住一个 `blueprintEmpireId` 作为 UI 上的“空间站蓝图”来源。
- `blueprintEmpireId` 由 Step 3 顶部的 empire 菜单选择并保存到 `x4_save_bindings` 当前 binding 顶层。
- `blueprintEmpireId` 只用于显示可导入候选，不代表 binding station 与 blueprint empire station 有持续关系。
- 从 blueprint empire station 导入时，只复制当时的 `name`、`type`、`modules`、`settings` 作为 binding 的规划目标。
- 复制完成后，修改 binding station 不影响 blueprint empire；修改 blueprint empire 也不影响已复制的 binding station。

### 7. 平铺存储与未分组

- `SaveBindingPlan` 使用 `groups[]` 与按需创建的 `stationPlans[]` 分开保存；`stationPlans[]` 只存 save-station，virtual station 存在对应 group 内部。
- station plan 可以处于未分组状态；未分组不阻塞本次迁移。
- 本次只要求数据层允许未分组，量化生产中如何把未分组显示成独立输出 bucket 可在迁移完成后另行规划。
- 全局量化汇总应包含未分组 station plans；星区/补给计算可以先只处理真实 group。

### 8. 量化生产数据源

- 量化生产界面需要支持两类数据源：
  - `empire`：使用普通 empire stations。
  - `save-binding`：使用某个 `SaveBindingPlan` 派生出的规划 stations。
- 当数据源为 binding 时，量化生产只读取规划 modules；save modules 不参与本次计算。
- binding 下覆盖范围内但没有规划 plan 的 save station 可显示为空规划，但对生产计算贡献为 0。
- virtual station 和 save station plan 在本阶段的量化生产界面不需要区别对待显示。

### 9. 保存时机 UI

- binding 使用显式保存。
- group 编辑、coverage 修改、source empire 导入、规划 modules 修改、virtual station 创建/删除都进入 binding dirty 状态。
- `保存绑定` 写入 `x4_save_bindings`；`保存帝国` 不保存 binding。
- save panel 的 binding 分支标题栏右侧显示 `取消`、`保存`、`关闭` 三个按钮；`取消` 放弃 binding draft，`保存` 写入 binding，`关闭` 只关闭面板。
- 量化生产界面不提供保存 binding 或放弃 binding 改动入口，避免把生产视图变成 binding 编辑入口。
- `activeGameGuid`、`selectedArchiveTime`、`blueprintEmpireId` 可作为 UI 视角/偏好保存，但不得让用户误以为它们会同步或修改 empire。
- 离开 dirty binding、切换 binding 或关闭相关面板时，UI 应提供保存、放弃或继续编辑的选择。

## 边界

### In Scope

- 独立 save binding storage 与 store 语义。
- 从 empire 中剥离 `saveBindings` 与星区职责。
- binding group / station plan 的新数据模型。
- 覆盖范围内 save station 自动派生为 binding 视图。
- source empire station 到 binding 规划模块的单次复制导入。
- 显式保存 binding 与 dirty UI。
- 量化生产对 `empire` / `save-binding` 两类数据源的基础支持。
- 移除星区总览中的星区管理界面，并保留原占位宽度。

### Out of Scope

- 旧 binding 数据迁移或兼容。
- save station 自身模块列表与规划 modules 的差异展示、合并、同步或比较。
- 未分组 station 在量化生产输出区的最终 UI 展示方案。
- 复杂撤销/重做历史。
- 网络或云端同步。

## 验收标准（DoD）

1. save binding 数据写入独立 `x4_save_bindings`，不写入 `x4_empire_data`。
2. 同一 `gameGuid` 只能创建或打开一份 binding。
3. `EmpirePlan` 不再包含 save binding 数据；empire 星区 UI/业务不再作为 binding 的数据来源。
4. binding group 可以保存 anchor、coverage、jump range 与 connected groups。
5. 覆盖范围内的 save stations 自动出现在 binding 视图中，而无需逐个手动绑定。
6. 未创建规划 plan 的 save station 在量化生产中视为规划 modules 为空。
7. 导入 source empire station 后，binding 只保留复制出来的规划 modules/settings，后续不与 source empire 同步。
8. virtual station 只能由用户明确创建；解绑或换绑不会生成 virtual station。
9. 修改 binding group、规划 modules 或 virtual station 后，UI 显示 binding dirty，并且只有点击 `保存绑定` 后才持久化。
10. `保存帝国` 不会保存 binding dirty 改动。
11. 量化生产可以选择 ordinary empire 或 save binding 作为数据源。
12. save-binding 数据源的生产计算只读取 binding 规划 modules。
13. 星区总览不再显示星区管理面板，但原左侧占位仍存在，右侧资源视图不会因面板移除而扩张。

## 未决项

无
