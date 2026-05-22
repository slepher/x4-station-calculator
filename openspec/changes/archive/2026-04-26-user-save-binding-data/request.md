# user-save-binding-data Change Request

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
- 已复制到 binding 的规划模块与原 empire station 没有任何同步关系。

### 3. Binding 星区和补给范围

- 用户在 binding 内决定星区怎么分、每个星区锚定哪个存档星区、覆盖哪些范围。
- `BindingSectorGroup` 保存名称、顺序、定位星区、jump range、coverage 和 connected groups。
- save station 属于哪个 binding group 由当前 archive 与 group coverage 自动派生。
- 用户不需要逐个把现有 save station 绑定到 binding；覆盖范围内的 save stations 自动出现在 binding 视图中。

### 4. Binding station 与规划模块

- save station 本体来自 save archive，是派生视图，不应在进入 binding 时自动物化为 `SaveStationPlan`。
- `SaveStationPlan` 只表示用户维护过的 save station 规划层数据。
- save station 的规划模块按需创建：
  - 用户从 empire station 导入规划模块到某个 save station 时创建或更新。
  - 用户在量化生产界面修改某个 save station 的规划模块时创建或更新。
  - 用户清空规划模块时可以删除对应 plan，使该 save station 回到"规划 modules 为空"的派生状态。
- `SaveStationPlan.modules` 与 `BindingSectorGroup.virtualStation.modules` 永远表示"规划 modules / 建设目标 modules"，是量化生产唯一读取的 binding 模块来源。

### 5. Virtual station 语义

- `virtual-station` 是用户明确创建的"当前存档还没有建好的空间站占位"，存放在所属 `BindingSectorGroup.virtualStation` 单体字段中。
- virtual station 不来自解绑残留；解绑或换绑不应生成 virtual station。
- virtual station 自身有名称、类型、规划 modules、settings、定位信息，并参与量化生产。

### 6. 空间站蓝图导入

- binding 可以记住一个 `blueprintEmpireId` 作为 UI 上的"空间站蓝图"来源。
- 从 blueprint empire station 导入时，只复制当时的 `name`、`type`、`modules`、`settings` 作为 binding 的规划目标。
- 复制完成后，修改 binding station 不影响 blueprint empire；修改 blueprint empire 也不影响已复制的 binding station。

### 7. 量化生产数据源

- 量化生产界面需要支持两类数据源：
  - `empire`：使用普通 empire stations。
  - `save-binding`：使用某个 `SaveBindingPlan` 派生出的规划 stations。
- 当数据源为 binding 时，量化生产只读取规划 modules；save modules 不参与本次计算。
- binding 下覆盖范围内的 save station 必须映射为空间站；即使没有 `BindingStationPlan` 或 planned modules，也作为空规划空间站进入量化生产，对生产计算贡献为 0。
- virtual station 必须映射为空间站。
- 星区中转站必须映射为量化生产中的星区中转站 / transit hub，而不是普通生产空间站。
- 没有归属任何 binding 星区组的 save station 不映射到量化生产。

### 8. Empire Store Production Source 路由

- `useEmpireStore` 添加 `productionSource` ref，支持 `'empire' | 'save-binding'`。
- 重构 `useEmpireStore.stations` / `sectors` / `activeStation` 根据 `productionSource` 路由到 empire 或 binding 数据。
- 添加 `switchToBinding(gameGuid)` 方法处理切换逻辑和 dirty 确认。

### 9. Modules/Equipments 聚合逻辑迁移

将 modules 和 equipments 的聚合逻辑从 rust-parser 迁移到 saveParser.post.ts：

#### 9.1 rust-parser 变更

- **仅针对 Player 站点移除聚合**：
  - `PlayerStationEntry` 和 `BuildStorageEntry` 不再包含 `modules` 和 `equipments` 聚合结果
  - 只保留 `constructions` 数组，供 post.ts 做聚合
- **NPC/Xenon/Khaak 站点保留聚合**：
  - `NpcStationEntry` 和 `FactionStationEntry` 继续在 rust-parser 中聚合
  - 因为这些站点不保留原始 `constructions` 数据
  - `modules` 和 `equipments` 字段保留

#### 9.2 saveParser.post.ts 聚合逻辑

遍历 `constructions` 数组，统计 modules 和 equipments（返回 **Array 格式**）：
- **modules**：按 `ref` 聚合计数 → `[{ref, amount}]`
- **equipments**：按 `(type, ref)` 聚合计数 → `[{type, ref, amount}]`

**注意**：rust-parser 对所有站点（包括 NPC/Xenon/Khaak）也使用 Array 格式输出 `modules` 和 `equipments`。

#### 9.3 BuildStorage progress 处理

如果 `buildstorage.progress.sequenceindex` 存在：
- `sequenceindex` 表示正在建造的 module 在 `buildstorage.constructions` 数组中的**位置索引**（从 0 开始）
- 通过 `sequenceindex` 找到 `buildstorage.constructions[sequenceindex]`
- 用该 construction 的 `id` 在 `station.constructions` 中找到对应项
- **从聚合中排除该 construction**（不计入聚合结果，原始 construction 数据保持不变）

**注意**：不修改原 construction 对象，只在聚合计算时排除。

#### 9.4 BuildStorage 聚合结果差值

`buildstorage.modules/equipments` 表示"新增/正在建造"的模块，需要减去 station 已有的：

```
buildstorage.modules = aggregate(buildstorage.constructions) - station.modules
buildstorage.equipments = aggregate(buildstorage.constructions) - station.equipments
```

**示例**：
```
station.modules = [{ref: A, amount: 3}, {ref: B, amount: 4}]
buildstorage.constructions 聚合 = [{ref: A, amount: 5}, {ref: B, amount: 6}, {ref: C, amount: 2}]
buildstorage.modules = [{ref: A, amount: 2}, {ref: B, amount: 2}, {ref: C, amount: 2}]  // 减去 station 已有
```

#### 9.5 Station tag 处理

如果 station 聚合后的 `modules` 为空（`[]` 或 `{}`），设置 `tag = 'constructionsite'`。

## 边界

### In Scope

- 独立 save binding storage 与 store 语义。
- 从 empire 中剥离 `saveBindings` 与星区职责。
- binding group / station plan 的新数据模型。
- 覆盖范围内 save station 自动派生为 binding 视图。
- source empire station 到 binding 规划模块的单次复制导入。
- 显式保存 binding 与 dirty UI。
- 量化生产对 `empire` / `save-binding` 两类数据源的基础支持。
- productionSource 路由与 EmpireStore 数据层重构。

### Out of Scope

- 旧 binding 数据迁移或兼容。
- save station 自身模块列表与规划 modules 的差异展示、合并、同步或比较。
- Step 1/2/3 UI 与地图交互（属于 user-save-binding-map）。
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
13. `useEmpireStore` 的 stations/sectors/activeStation 根据 productionSource 正确路由。
14. save-binding 数据源将星区中转站映射为 transit hub，不把它当作普通生产空间站。

## 未决项

无