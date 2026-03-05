## Context

当前 Ship Build 流程中，候选模块高亮只影响装备详情面板，不会驱动整船状态预演。
`ShipBuildPanelStats` 仅读取当前 `blueprint` 计算 `objCurrent`，`objTarget` 固定为空，因此用户无法在确认前看到整船属性差异。

## Decisions

1. 增加“预演蓝图（targetBlueprint）”通路
   - 在页面层（`ShipBuildView`）维护 `previewBlueprint`（可空）。
   - 当高亮候选变化时，基于当前蓝图构造预演蓝图。
   - 当高亮失效（null）或 picker 关闭时，清空预演蓝图。

2. 预演计算与正式赋值解耦
   - 预演使用纯计算函数：输入当前蓝图、目标 keys、候选 equipmentId、模式与数量；输出新蓝图副本。
   - 禁止在预演路径调用持久化或会写入正式状态的方法。

3. connection/group 替换规则分离
   - connection：仅替换单个目标 `connectionKey`。
   - group：按聚合数量替换同类 `connectionKeys`，采用容量分摊算法。

4. 复用既有 key 解析能力
   - shield 4 段/5 段 key 解析规则与 `applyConnectionAssignment` 保持一致，避免 preview 与 commit 语义分叉。

5. Stats 面板接入 target 计算
   - `ShipBuildPanelStats` 新增可选输入 `targetBlueprint`。
   - 在内部并行计算 current/target 两组 metric map，并将 target 传入 `MetricsPanel.obj-target`。

## Data Flow

1. `ShipBuildPanelFit` 产出：
   - `highlightedEquipmentId`
   - `pickerTarget.connectionKeys`
   - 当前模式对应的目标数量信息（group 下为聚合总数）
2. `ShipBuildView` 监听这些输入并触发预演构造：
   - 无高亮 -> `previewBlueprint = null`
   - 有高亮 -> `previewBlueprint = buildPreviewBlueprint(...)`
3. `ShipBuildPanelStats` 接收：
   - `shipBlueprint`（current）
   - `targetBlueprint`（preview，可空）
4. `MetricsPanel` 渲染：
   - `objCurrent = current metrics`
   - `objTarget = target metrics | null`

## Replacement Algorithm

### Connection Mode

- 输入：单个 `connectionKey`、`equipmentId`。
- 执行：在蓝图副本上仅更新该 key 对应连接。
- 输出：返回更新后的副本。

### Group Mode (Quantity-Based)

- 输入：同类 `connectionKeys`、目标总数量 `targetCount`、`equipmentId`。
- 执行：
  1. 读取每个 key 的容量上限。
  2. 使用容量分摊算法计算每个 key 的分配值。
  3. 对每个 key：
     - 分配值 > 0：设置 `equipmentId` + count。
     - 分配值 = 0：清空该 key（`equipmentId=null,count=0`）。
- 输出：返回更新后的副本。

## Risk And Mitigation

1. 风险：preview 与 commit 规则漂移。
   - 缓解：复用同一套 key 解析与 setEquipment/setShield 语义。
2. 风险：group 模式数量来源不一致导致差异误判。
   - 缓解：统一以 slot target 的聚合计数作为 `targetCount` 输入。
3. 风险：频繁高亮触发性能抖动。
   - 缓解：仅在 `highlightedEquipmentId` 或目标 keys 变化时重算，避免无效重复计算。

## Non-Goals

- 不改动 `useEquipmentStats` 的字段定义和计算公式。
- 不改动 `MetricsPanel` 的 UI 交互行为（含 summary/detail tab 机制）。
- 不在本变更引入新的 store 持久化字段。
