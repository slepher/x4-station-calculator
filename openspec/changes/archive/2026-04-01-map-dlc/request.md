# map-dlc 需求说明

## 目标
为地图界面（Map Workbench View）增加 DLC 过滤能力，与 ship-dlc change 保持一致的消费语义：当启用"限制未激活 DLC 物品"策略后，地图不显示未激活 DLC 的星系，资源统计不包含未激活 DLC 星区，且对已放置在不活跃 DLC 星区的空间站进行视觉提示。

## 已确认方案（审核重点）

### 1. 作用范围
- 本次 change 只处理地图界面（Empire 页面的地图视图）。
- 目标区域包括：
  - 地图 SVG 渲染的星系（clusters）和星区（sectors）
  - 资源筛选面板的统计与搜索结果
  - 空间站面板的地址/位置显示
- 不扩展到舰船建造页、空间站规划页或其他业务页面。

### 2. 星系过滤行为
- 当 `enforceDlcActivation = false` 时：
  - 地图继续显示全部星系
  - 资源统计包含全部星区
- 当 `enforceDlcActivation = true` 时：
  - 地图不渲染未激活 DLC 的星系（clusters）
  - 这些星系的星区（sectors）不显示在地图上
  - 资源搜索统计不计算未激活 DLC 星区的资源

### 3. 星门显示策略
- 即使星门连接的目标星系因 DLC 未激活被隐藏，星门本身**仍然显示**
- 不进行额外的视觉处理（如置灰、虚线等）
- 保持地图拓扑结构完整性

### 4. 空间站地址标红
- 在空间站面板（MapStationPanel）中，如果某空间站位于**未激活 DLC 的星区**：
  - 其地址/位置标签显示为红色
  - 作为视觉提示：该空间站位置当前不可在地图上交互
- 不进行自动移除或迁移，仅做视觉标记

### 5. DLC 状态来源
- 地图界面不直接读取 `localStorage`
- 统一消费 `useGameDataStore` 已提供的 DLC 状态与 helper：
  - `enforceDlcActivation`
  - `isDlcActive(dlcTag)`
  - `filterActiveDlcItems(items)`

## 边界

### In Scope
- 根据 `enforceDlcActivation` 过滤地图渲染的星系
- 资源搜索/统计时过滤未激活 DLC 的星区
- 星门保持显示（即使目标星系被过滤）
- 空间站面板中，位于未激活 DLC 星区的地址标红

### Out of Scope
- 修改 DLC setting modal 本身的交互或存储结构
- 为未激活 DLC 星门添加置灰/虚线等视觉处理
- 自动移除或迁移未激活 DLC 空间站
- 编写测试代码或运行测试

## 验收标准（DoD）
- 当 `enforceDlcActivation = true` 时，地图不显示未激活 DLC 的星系
- 当 `enforceDlcActivation = true` 时，资源搜索统计不包含未激活 DLC 星区
- 星门连接保持显示，即使目标星系因 DLC 未激活被过滤
- 当 `enforceDlcActivation = true` 且空间站位于未激活 DLC 星区时，其地址标签显示为红色
- 地图界面的 DLC 判断统一来自 `useGameDataStore` 暴露的状态与 helper

## 未决项
无。
