# Resource UI Unify - 设计文档

## 1. 架构概览

### 1.1 影响范围

本次变更主要影响以下组件：

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/components/empire/MapWorkbenchView.vue` | 修改 | 主容器布局、搜索框位置、tab 按钮布局 |
| `src/components/empire/MapResourceFilterPanel.vue` | 修改 | 资源面板容器（新增 tab 切换支持） |
| `src/components/empire/MapStationPanel.vue` | 修改 | 空间站面板容器（新增 tab 切换支持） |
| `src/components/empire/MapResourceFilterSimplePanel.vue` | 修改 | Yield 下拉框 5 等级改造 |
| `src/components/empire/MapResourceFilterAdvancedPanel.vue` | 修改 | Yield 下拉框 5 等级改造 |
| `src/store/useGameDataStore.ts` | 修改 | 添加 res.json 颜色数据加载 |

### 1.2 数据流

```
res.json (color_rgb) ─────────────┐
                                   ▼
useGameDataStore ──> resourceColorByWare ──> MapResourceFilterSimplePanel ──> 资源标签颜色
                                           ──> MapResourceFilterAdvancedPanel
```

---

## 2. UI 设计决策

### 2.1 布局结构

**当前布局**：
```
┌─────────────────────────────────────────┐
│  [搜索]                    [资源按钮]    │  <- top-5
│     地图区域                              │
│                                         │
│  [空间站按钮]              [缩放]        │  <- bottom-5
└─────────────────────────────────────────┘
```

**目标布局**：
```
┌─────────────────────────────────────────┐
│  [搜索]                      [缩放]      │  <- top-5
│     地图区域                              │
│                                         │
│                            [资源][空间]  │  <- bottom-5
└─────────────────────────────────────────┘
```

### 2.2 Tab 按钮高亮样式

使用与 `resource-mode-tab.active` 一致的样式：
- `border-amber-200/70`
- `bg-amber-200/15`
- `text-amber-50`

### 2.3 按钮常显

移除 `v-if="!isResourcePanelOpen"` 和 `v-if="!isStationPanelOpen"` 条件，改为始终显示。

---

## 3. 数据设计

### 3.1 资源颜色数据源

**当前实现**（MapWorkbenchView.vue:158-160）：
```typescript
const resourceColorByWare = computed(() => Object.fromEntries(
  (gameDataStore.regionyields || []).map((entry: any) => [entry.ware, entry.color || '#fbbf24'])
) as Record<string, string>)
```

**目标实现**：
```typescript
const resourceColorByWare = computed(() => Object.fromEntries(
  (gameDataStore.res || []).map((entry: any) => [entry.id, entry.color_rgb || '#fbbf24'])
) as Record<string, string>)
```

### 3.2 Yield 5 等级映射

#### 空间站资源（普通）

| 等级 Key | 显示文本 | 阈值 (respawn <) |
|----------|----------|-----------------|
| `low` | 低 (<3000) | 3,000 |
| `low_medium` | 中低 (<10000) | 10,000 |
| `medium` | 中 (<30000) | 30,000 |
| `medium_high` | 中高 (<100000) | 100,000 |
| `high` | 高 (<300000) | 300,000 |

#### N 矿（Nividium）

| 等级 Key | 显示文本 | 阈值 (respawn <) |
|----------|----------|-----------------|
| `low` | 低 (<30) | 30 |
| `low_medium` | 中低 (<100) | 100 |
| `medium` | 中 (<300) | 300 |
| `medium_high` | 中高 (<1000) | 1,000 |
| `high` | 高 (<3000) | 3,000 |

### 3.3 i18n Key

新增 i18n key（`src/locales/en.json` 和 `src/locales/zh-CN.json`）：

```json
{
  "map": {
    "yield_level_low": "低 (<{threshold})",
    "yield_level_low_medium": "中低 (<{threshold})",
    "yield_level_medium": "中 (<{threshold})",
    "yield_level_medium_high": "中高 (<{threshold})",
    "yield_level_high": "高 (<{threshold})"
  }
}
```

---

## 4. Tooltip 数字格式化

### 4.1 格式化规则

所有数值统一使用**保留 2 位有效数字**的规则（仅针对 <1 的数值），其他范围保持固定格式：

| 数值范围 | 格式化规则 | 示例 |
|--------|-----------|------|
| < 1 | 保留 2 位有效数字 | `0.000045223` → `0.000045` |
| ≥ 1 且 < 10 | 保留 2 位小数 | `9.876` → `9.87` |
| ≥ 10 且 < 1,000 | 显示整数 | `123.45` → `123` |
| ≥ 1,000 且 < 1,000,000 | 保留 2 位小数 + K | `12345` → `12.34K` |
| ≥ 1,000,000 且 < 1,000,000,000 | 保留 2 位小数 + M | `12345678` → `12.34M` |
| ≥ 1,000,000,000 且 < 1,000,000,000,000 | 保留 2 位小数 + B | `12345678901` → `12.34B` |
| ≥ 1,000,000,000,000 且 < 1,000,000,000,000,000 | 保留 2 位小数 + T | `12345678901234` → `12.34T` |
| ≥ 1,000,000,000,000,000 | 保留 2 位小数 + P | `12345678901234567` → `12.34P` |

### 4.2 实现方式

在 `MapSectorTooltip.vue` 或工具函数中添加数字格式化函数：

```typescript
function formatNumber(value: number): string {
  const absValue = Math.abs(value)
  if (absValue < 1) {
    // 保留 2 位有效数字
    return value.toPrecision(2)
  }
  if (absValue < 10) {
    // 保留 2 位小数
    return value.toFixed(2)
  }
  if (absValue < 1000) {
    // 显示整数
    return Math.floor(value).toString()
  }
  if (absValue < 1_000_000) {
    return (value / 1_000).toFixed(2) + 'K'
  }
  if (absValue < 1_000_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M'
  }
  if (absValue < 1_000_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + 'B'
  }
  if (absValue < 1_000_000_000_000_000) {
    return (value / 1_000_000_000_000).toFixed(2) + 'T'
  }
  return (value / 1_000_000_000_000_000).toFixed(2) + 'P'
}
```

### 4.3 数据源变更

Tooltip 显示的资源数值从 yield 改为 respawn：

**当前**：显示 `entry.level` 或 `entry.yield`
**目标**：显示 `entry.respawn` 值

---

## 7. 跳数计算逻辑

### 7.1 BFS 跳数算法

高级资源过滤器使用 BFS（广度优先搜索）计算从枢纽 sector 可达的资源 sector。

**核心逻辑**（`src/store/logic/mapAdvancedResourceFilter.ts`）：

```typescript
const breadthFirstReachable = (
  graph: Record<string, string[]>,
  start: string,
  maxDepth: number,
  sectorClusterMap: Record<string, string>
) => {
  const distances: Record<string, number> = { [start]: 0 }
  const queue = [start]
  let index = 0
  const startClusterId = sectorClusterMap[start]

  while (index < queue.length) {
    const current = queue[index++]!
    const currentDepth = distances[current] || 0
    const currentClusterId = sectorClusterMap[current]

    ;(graph[current] || []).forEach((next) => {
      if (distances[next] !== undefined) return
      const nextClusterId = sectorClusterMap[next]
      // 同一 cluster 内移动不增加跳数，跨 cluster 移动跳数 +1
      const depthIncrease = (currentClusterId && nextClusterId && currentClusterId !== nextClusterId) ? 1 : 0
      const newDepth = currentDepth + depthIncrease
      if (newDepth > maxDepth) return
      distances[next] = newDepth
      queue.push(next)
    })
  }

  return distances
}
```

### 7.2 Cluster 连通性

跨 cluster 的连通性通过 `cluster_gates` 建立：

1. 如果 sector A 有 gate 指向 cluster B
2. 并且 cluster B 中有 sector C 有 gate 指向 cluster A
3. 则 A 和 C 之间建立双向连接

**实现**（`buildSectorGraph` 函数）：
- 构建 sector 邻接图
- 记录每个 sector 所属的 cluster
- 双向检查 cluster gates 建立跨 cluster 连接

---

## 8. 评分逻辑

### 8.1 Rating 等级

资源 yield 等级映射到 rating（1-5）：

| Yield 名称 | Rating |
|------------|--------|
| low | 1 |
| midlow | 2 |
| medium | 3 |
| midhigh | 4 |
| high | 5 |

### 8.2 组匹配逻辑

`matchSectorToTagGroup` 函数判定 sector 是否满足 tag group：

1. 对每个普通资源 tag，检查 sector 中是否存在该资源且 rating >= 最低要求
2. 如果包含日光 tag，检查 sector.sunlight >= sunlightMinimum
3. 所有条件满足时返回 `matched=true`

### 8.3 候选评分计算

`buildCandidateScore` 函数计算候选方案的评分：

```typescript
const buildCandidateScore = (resourceSectorIds: string[]) => {
  // 1. 对每个 tag group，取候选中所有 sector 在该 group 上的最高平均分
  const groupScores = tagGroups
    .map((group) => resourceSectorIds
      .map((sectorId) => groupScoresBySector[sectorId]?.[group.id] ?? null)
      .filter((value): value is number => value !== null)
    )
    .filter((scores) => scores.length > 0)
    .map((scores) => Math.max(...scores))

  if (!groupScores.length) return 0
  // 2. 取所有组分数中的最低分（瓶颈）
  return Math.min(...groupScores)
}
```

**评分规则**：
- 每个 tag group 的分数 = 该组匹配资源的平均 rating
- 候选的某 group 分数 = 所有 sector 中该 group 的最高分
- 最终评分 = 所有 group 分数的最小值（木桶原理）

---

## 9. 测试用例

### 9.1 跳数逻辑测试

| 测试用例 | 描述 | 期望 |
|----------|------|------|
| 1.7 | 同一 cluster 内的 sector 移动不计跳数 | jumpLimit=0 时，同一 cluster 内所有 sector 可达 |
| 1.8 | 跨 cluster 的 sector 移动计跳数 | jumpLimit=0 时，跨 cluster 的 sector 不可达 |

### 9.2 评分逻辑测试

| 测试用例 | 描述 | 期望 |
|----------|------|------|
| 1.4 | 传入多个 tag 组配置 | score = 各组最佳 sector 平均 rating 的最小值 |
| 1.4.2 | 仅日光命中的 sector | 不参与评分计算（score=0 或被过滤） |

---

## 10. 待确认项

无

---

## 11. 受影响的文件清单

#### 核心组件
1. `src/components/empire/MapWorkbenchView.vue`
2. `src/components/empire/MapResourceFilterPanel.vue`
3. `src/components/empire/MapStationPanel.vue`
4. `src/components/empire/MapResourceFilterSimplePanel.vue`
5. `src/components/empire/MapResourceFilterAdvancedPanel.vue`
6. `src/components/empire/MapSectorTooltip.vue`（新增：数字格式化）

#### 数据存储
7. `src/store/useGameDataStore.ts`
8. `src/store/logic/useGameData.ts`

#### 游戏数据
9. `src/assets/x4_game_data/8.0-Diplomacy/data/res.json`
10. `src/assets/x4_game_data/9.0-Empire/data/res.json`

#### 国际化
11. `src/locales/en.json`
12. `src/locales/zh-CN.json`

#### 工具函数
13. `src/utils/numberFormatter.ts`（新增：数字格式化通用函数）

#### 高级过滤器逻辑
14. `src/store/logic/mapAdvancedResourceFilter.ts`（跳数计算、评分逻辑）

### 11.1 版本兼容

- 8.0 Diplomacy 和 9.0 Empire 的 `res.json` 都需要同步更新
- 通过 `useGameDataStore` 的 game version 检测自动切换数据源

#### 国际化
11. `src/locales/en.json`
12. `src/locales/zh-CN.json`

#### 工具函数
13. `src/utils/numberFormatter.ts`（新增：数字格式化通用函数）

### 5.2 版本兼容

- 8.0 Diplomacy 和 9.0 Empire 的 `res.json` 都需要同步更新
- 通过 `useGameDataStore` 的 game version 检测自动切换数据源

---

## 6. 待确认项

无
