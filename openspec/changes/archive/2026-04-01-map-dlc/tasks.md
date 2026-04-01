# map-dlc 任务清单

## Task Group: 核心过滤实现

### Task: MapSvgCanvas Cluster 过滤
- **文件**: `src/components/empire/MapSvgCanvas.vue`
- **描述**: 修改 `clusters` computed 属性，当 `enforceDlcActivation = true` 时过滤未激活 DLC 的星系
- **状态**: ✅ 已完成

### Task: MapSvgCanvas 布局稳定性（方案 A）
- **文件**: `src/components/empire/MapSvgCanvas.vue`
- **描述**: 使用 `allClusters` 计算布局边界，保持剩余 cluster 位置稳定
- **状态**: ✅ 已完成

### Task: MapSvgCanvas 未激活 DLC 虚线边框
- **文件**: `src/components/empire/MapSvgCanvas.vue`
- **描述**:
  - 当 `enforceDlcActivation = false` 时，未激活 DLC 的 cluster 使用虚线边框 (`stroke-dasharray: '6,4'`)
  - 对应的 sector 也使用虚线边框，并通过 `stroke-dashoffset` 对齐重叠部分的虚线
- **状态**: ✅ 已完成

### Task: MapSvgCanvas 多 Sector 内层边框与 Sector 边距
- **文件**: `src/components/empire/MapSvgCanvas.vue`
- **描述**:
  - 2-sector cluster: 内层虚拟边框 0.96，sector 0.96 紧贴内层
  - 3-sector cluster: 内层虚拟边框 0.98，sector 0.97 紧贴内层
  - 1-sector cluster: 保持填满，无内层边框
  - 统一在 `clipDefs` 和 `highwayPaths` 中应用相同的缩放逻辑
- **状态**: ✅ 已完成

### Task: MapWorkbenchView SectorsById 过滤
- **文件**: `src/components/empire/MapWorkbenchView.vue`
- **描述**: 修改 `sectorsById` computed 属性，遍历 clusters 时过滤未激活 DLC 的星系
- **状态**: ✅ 已完成

### Task: MapResourceFilterSimplePanel 资源统计过滤
- **文件**: `src/components/empire/MapResourceFilterSimplePanel.vue`
- **描述**: 在遍历 clusters 进行资源统计时，跳过未激活 DLC 的星系
- **状态**: ✅ 已完成

### Task: MapResourceFilterAdvancedPanel 高级筛选过滤
- **文件**: `src/components/empire/MapResourceFilterAdvancedPanel.vue`
- **描述**: 在遍历 clusters 进行高级资源筛选时，跳过未激活 DLC 的星系
- **状态**: ✅ 已完成

## Task Group: 空间站地址标红

### Task: 扩展 MapStationPanelItem 类型
- **文件**: `src/components/empire/MapStationPanel.vue`
- **描述**: 在类型定义中添加 `isAddressInactive?: boolean` 字段
- **状态**: ✅ 已完成

### Task: StationPanelItems 添加标红标记
- **文件**: `src/components/empire/MapWorkbenchView.vue`
- **描述**: 修改 `stationPanelItems` computed，为每个 item 判断地址是否位于未激活 DLC 星区
- **状态**: ✅ 已完成

### Task: MapStationPanel 地址标红样式
- **文件**: `src/components/empire/MapStationPanel.vue`
- **描述**: 根据 `isAddressInactive` 为地址元素添加红色样式类
- **状态**: ✅ 已完成

## Task Group: 依赖检查

### Task: 确认 Cluster 类型包含 dlc_tag
- **检查**: `src/types/x4.ts` 中 `X4MapCluster` 接口
- **预期**: 已包含 `dlc_tag: string` 字段
- **状态**: ✅ 已确认存在

### Task: 确认 useGameDataStore 提供必要方法
- **检查**: `src/store/useGameDataStore.ts`
- **预期**: 提供 `enforceDlcActivation` computed 和 `isDlcActive(dlcTag)` 方法
- **状态**: ✅ 已确认存在

## 任务依赖图

```
核心过滤实现:
  ├─ MapSvgCanvas Cluster 过滤 (独立)
  ├─ MapWorkbenchView SectorsById 过滤 (独立)
  ├─ MapResourceFilterSimplePanel 资源统计过滤 (独立)
  └─ MapResourceFilterAdvancedPanel 高级筛选过滤 (独立)

空间站地址标红:
  ├─ 扩展 MapStationPanelItem 类型 (必须在标记任务之前)
  ├─ StationPanelItems 添加标红标记 (依赖类型扩展)
  └─ MapStationPanel 地址标红样式 (依赖标记任务)
```

## 验收检查点

- [x] `enforceDlcActivation = true` 时地图不显示未激活 DLC 星系
- [x] `enforceDlcActivation = true` 时资源统计不包含未激活 DLC 星区
- [x] 星门保持显示（即使目标星系被过滤）
- [x] 位于未激活 DLC 星区的空间站地址显示为红色
- [x] `enforceDlcActivation = false` 时所有功能保持原有行为
- [x] 过滤 DLC 后剩余 cluster 位置保持不变（方案 A）
- [x] `enforceDlcActivation = false` 时未激活 DLC cluster 显示虚线边框
