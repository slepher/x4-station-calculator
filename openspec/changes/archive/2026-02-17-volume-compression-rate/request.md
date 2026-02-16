# Volume Compression Rate Feature

## 功能概述

为逻辑流规划器中的每个模块节点显示体积压缩率，帮助用户直观了解产线的体积效率。

## 业务背景

在 X4 游戏中，空间站的仓储空间是有限资源。不同模块的生产效率不同，有些模块会将大量原材料压缩成少量高价值产品（体积压缩），而有些模块则可能产生体积膨胀。用户需要一个直观的指标来判断产线的体积效率。

## 核心需求

### 1. 计算逻辑

**计算对象**：
- 每个模块节点（排除 isolated 节点和 T0 节点）
- 只计算有输入的模块（无输入的模块如太阳能发电站不显示压缩率）

**计算公式**：
```
压缩率 = 产出体积 / 消耗体积

产出体积 = Σ(module.outputs[wareId] * waresMap[wareId].volume)
消耗体积 = Σ(module.inputs[wareId] * waresMap[wareId].volume)  // 忽略 energycells
```

**计算周期**：使用模块自身的 `cycleTime` 作为计算周期

**特殊处理**：
- 消耗体积计算时忽略 `energycells`（太阳能）
- 无输入的模块不显示压缩率

### 2. 颜色规则

| 压缩率 | 颜色 | 含义 |
|--------|------|------|
| ≤100% | 绿色 | 体积压缩效果好，产出体积小于等于消耗体积 |
| >100% | 红色 | 体积膨胀，产出体积大于消耗体积 |

### 3. 数据存储

在 `useGameDataStore.ts` 中新增独立的 Map：

```typescript
const volumeCompressionMap = ref<Record<string, number>>({})
```

**初始化时机**：在 `initialize()` 函数中，`buildModulesMap()` 之后调用 `buildVolumeCompressionMap()`

**计算函数**：
```typescript
function buildVolumeCompressionMap() {
  const map: Record<string, number> = {}
  
  Object.values(modulesMap.value).forEach(module => {
    // 计算产出体积
    let outputVolume = 0
    if (module.outputs) {
      Object.entries(module.outputs).forEach(([wareId, amount]) => {
        const ware = waresMap.value[wareId]
        if (ware) {
          outputVolume += amount * ware.volume
        }
      })
    }
    
    // 计算消耗体积（忽略 energycells）
    let inputVolume = 0
    if (module.inputs) {
      Object.entries(module.inputs).forEach(([wareId, amount]) => {
        if (wareId === 'energycells') return // 忽略太阳能
        const ware = waresMap.value[wareId]
        if (ware) {
          inputVolume += amount * ware.volume
        }
      })
    }
    
    // 只有有输入的模块才计算压缩率
    if (inputVolume > 0) {
      map[module.id] = outputVolume / inputVolume
    }
  })
  
  volumeCompressionMap.value = map
}
```

### 4. 显示位置

**组件**：`FlowNode.vue`

**位置**：节点底部 Subtitle 区域，与 Race/Status 标签同行

**格式**：
- 百分比数字 + 体积图标 SVG
- 示例：`85%` + 立方体图标

**SVG 图标**（参考 StationWareFlow 中的体积图标）：
```svg
<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
  <path d="m3.3 7 8.7 5 8.7-5"/>
  <path d="M12 22V12"/>
</svg>
```

### 5. 显示条件

在 FlowNode.vue 中，压缩率仅在以下条件全部满足时显示：
1. 节点有 `moduleId`（是模块节点）
2. 节点不是 isolated 状态
3. 节点不是 T0 资源（column !== 0）
4. 模块有输入（`volumeCompressionMap[moduleId]` 存在）

## 技术设计

### 数据流

```
useGameDataStore.ts
  ├── initialize()
  │     ├── buildWaresMap()
  │     ├── buildModulesMap()
  │     ├── buildVolumeCompressionMap()  // 新增
  │     └── ...
  └── volumeCompressionMap  // 新增导出
```

### 组件更新

**FlowNode.vue**：
1. 从 `useGameDataStore` 获取 `volumeCompressionMap`
2. 计算当前节点的压缩率
3. 在 Subtitle 区域显示压缩率 + 图标

### 类型定义

无需新增类型，使用现有的 `Record<string, number>` 类型。

## 验收标准

1. **数据准备**：`useGameDataStore` 初始化后，`volumeCompressionMap` 包含所有有输入的模块的压缩率
2. **显示正确**：FlowNode 组件正确显示压缩率百分比和图标
3. **颜色正确**：≤100% 显示绿色，>100% 显示红色
4. **条件过滤**：isolated 节点、T0 节点、无输入模块不显示压缩率
5. **忽略太阳能**：消耗体积计算时正确忽略 energycells

## 边界情况

1. **无输入模块**：如太阳能发电站，不显示压缩率
2. **纯输出模块**：如采矿站，不显示压缩率（inputVolume = 0）
3. **energycells 节点**：T0 资源，不显示压缩率
4. **isolated 节点**：不显示压缩率
