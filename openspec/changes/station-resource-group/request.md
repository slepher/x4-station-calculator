# station-resource-group

## 目标

在资源高级筛选器的"新增组"按钮右侧增加一个"载入"组件，允许用户从星区空间站或逻辑组网存档载入资源组配置。

## 已确认方案（审核重点）

### 入口与位置

- 位置：资源高级筛选器面板顶部，"新增组"按钮右侧
- 组件形式：类似 ShipBuildPanelFit 中的蓝图选择器（按钮 + 下拉菜单）
- 弹出菜单位置：使用 fixed 定位，在面板外部显示，与面板右侧保持 8px 间距

### 数据来源

**星区分组**：
- 星区列表：`useEmpireStore().sectors`
- 每个星区的空间站：`activeEmpire.value.stations.filter(s => s.sectorId === sectorId)`
- 每个空间站的资源：`stationStateMap.getGroupedFlows(station.id).rateGroups.resources.map(f => f.wareId)`

**逻辑组网分组**：
- 存档列表：`useLogicFlowStore().savedPlans.list`
- 每个存档的组：`SavedFlowGroup[]`
- 每个组的 tier0 资源：通过 `computeExpandUpstream` 算法展开获取

### 分组逻辑

- 下拉菜单显示两个分组标题："星区"和"逻辑组网"
- 每个分组下显示对应的可载入项列表

**星区分组**：
- 点击星区名称后，为该星区下**每个空间站**创建一个资源组
- 每个组的资源 = 该空间站的 `rateGroups.resources` 中的 wareId

**逻辑组网分组**：
- 点击存档名称后，为该存档中**每个 SavedFlowGroup** 创建一个资源组
- 每个组的资源 = 该组展开后的 tier0 资源（不包括能量电池）

### tier0 资源获取流程

1. 遍历 `SavedFlowGroup.nodes`：
   - `isolated`: `node.isolated` 就是 wareId
   - `module`: 从 `gameData.modulesMap[node.module]` 获取第一个输出 wareId

2. 构建展开上下文：
   - `ExpandContext`: `{ waresMap, modulesMap, modulesByOutputMap }`（从 `useGameDataStore`）
   - `GroupSnapshot`: 从 `SavedFlowGroup` 转换

3. 调用展开算法：
   - 对每个初始 wareId 调用 `computeExpandUpstream(ctx, groupSnapshot, wareId, 'manual')`
   - 收集所有 `result.newNodes`

4. 过滤 tier0 资源：
   - `ware.tier === 0 && wareId !== 'energycells'`

### 载入行为

- 载入后**替换**当前所有组
- 载入后自动刷新候选

### 显示规则

- 未载入时：按钮显示"自定义"
- 载入后：按钮显示载入项名称（星区名或存档名）
- 下拉菜单：分组标题 + 可载入项列表

### 载入后的组设置

**星区**：
- 组名称：空间站名称
- 组资源标签：该空间站消耗的资源

**逻辑组网**：
- 组名称：`SavedFlowGroup.name`
- 组资源标签：该组的 tier0 资源

### 过滤规则

**星区**：
- 如果某个空间站没有资源需求，则不为该空间站创建组
- 如果某个星区的所有空间站都没有资源需求，则该星区不出现在载入列表中

**逻辑组网**：
- 如果某个组展开后没有 tier0 资源，则不为该组创建资源组
- 如果某个存档的所有组都没有 tier0 资源，则该存档不出现在载入列表中

## 边界

### In Scope

- 载入组件的 UI 实现
- 下拉菜单的 fixed 定位逻辑
- 从 EmpireStore 和 StationStateMap 获取星区数据
- 从 LogicFlowStore 获取存档数据
- 使用 `computeExpandUpstream` 获取 tier0 资源
- 载入时替换当前所有组

### Out of Scope

- 保存自定义配置功能（暂不支持）
- 其他分组来源（未来扩展）
- 载入前的未保存确认

## 验收标准（DoD）

1. 点击载入按钮，弹出下拉菜单，显示"星区"和"逻辑组网"两个分组
2. 星区分组显示有资源需求的星区列表
3. 逻辑组网分组显示有 tier0 资源需求的存档列表
4. 点击星区名称，替换当前所有组，每个空间站对应一个组
5. 点击存档名称，替换当前所有组，每个 SavedFlowGroup 对应一个组
6. 每个组包含正确的资源标签
7. 按钮显示当前状态（自定义/载入项名称）
8. 下拉菜单在面板右侧显示，不遮挡面板内容
9. 载入后自动刷新候选

## 未决项

无