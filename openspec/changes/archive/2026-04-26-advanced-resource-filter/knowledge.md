# advanced-resource-filter 测试知识库

## UI 锚点

### 资源过滤面板
- 入口按钮: `data-testid="map-resource-entry-button"`
- 面板头部: `data-testid="map-resource-panel-header"`
- 关闭按钮: `data-testid="map-resource-close-panel"`
- 简单模式 Tab: `data-testid="map-resource-tab-simple"`
- 高级模式 Tab: `data-testid="map-resource-tab-advanced"`

### 简单模式
- 资源 tag: `data-testid="map-resource-tag-{wareId}"` (如 `map-resource-tag-ore`)
- 丰度下拉: `data-testid="map-resource-yield-{wareId}"` (如 `map-resource-yield-ore`)
- 日光输入: `data-testid="map-resource-sunlight"`
- 候选项: `data-testid="map-resource-candidate-{sectorId}"`

### 高级模式
- 跳数输入: `data-testid="map-resource-advanced-jump-limit"`
- 允许中转: `data-testid="map-resource-advanced-allow-transit"`
- 刷新按钮: `data-testid="map-resource-advanced-refresh"`
- 添加组按钮: `data-testid="map-resource-advanced-add-group"`
- tag 选择: `data-testid="map-resource-advanced-tag-{groupId}-{wareId}"`
- 日光阈值: `data-testid="map-resource-advanced-sunlight-{groupId}"`
- 候选列表: `data-testid="map-resource-advanced-candidate-list"`
- 候选项: `data-testid="map-resource-advanced-candidate-{key}"`

## 资源 Fixture 映射

### 基础资源 (来自 `tests/fixtures/ware_fixtures.yaml`)

| Test Keyword | Fixture ID | EN Name | CN Name | Notes |
|--------------|------------|---------|---------|-------|
| ore | `ore` | Ore | 金属矿石 | 基础矿物，tier 0 |
| silicon | `silicon` | Silicon | 硅 | 基础矿物，tier 0 |
| methane | `methane` | Methane | 甲烷 | 气体资源，tier 0 |
| hydrogen | `hydrogen` | Hydrogen | 氢 | 气体资源，tier 0 |
| helium | `helium` | Helium | 氦 | 气体资源，tier 0 |
| ice | `ice` | Ice | 冰 | 水资源，tier 0 |

### 日光资源
- ID: `sunlight` (ADVANCED_SUNLIGHT_TAG_ID)
- 非标准 ware，用于日光过滤条件
- 单位: 百分比 (0-200+)
- 颜色: `#F7D24B`

## 丰度等级

来自 `regionyields.json`:
- `lowest` - 最低丰度
- `medium` - 中等丰度
- `high` - 高丰度

Locator 使用: `t('map.yield_names.{yieldName}')`

## i18n 键值

### 模式与按钮
- `map.resource_filter_button` - "Resource" / 资源
- `map.resource_filter_mode_simple` - "简单"
- `map.resource_filter_mode_advanced` - "高级"
- `map.resource_filter_refresh` - "刷新"
- `map.resource_filter_add_group` - "添加组"
- `map.resource_filter_edit` - "编辑"
- `map.resource_filter_done` - "完成"
- `map.resource_filter_remove_group` - "删除"

### 高级模式控制
- `map.resource_filter_jump_limit` - "跳数"
- `map.resource_filter_jump_suffix` - "跳"
- `map.resource_filter_allow_transit` - "允许中转"
- `map.resource_filter_pending_refresh` - "待刷新"
- `map.resource_filter_empty_group` - "空组"

### 候选显示
- `map.resource_filter_candidates` - "候选"
- `map.resource_filter_hubs` - "中转"
- `map.resource_filter_no_match` - "无匹配"
- `map.resource_filter_all` - "所有项"
- `map.resource_filter_mixed` - "混合"

### 日光
- `map.resource_filter_sunlight` - "日光"
- `map.resource_filter_sunlight_suffix` - "%"

## 组件层次

```
MapResourceFilterPanel.vue (容器)
├── MapResourceFilterSimplePanel.vue (简单模式)
│   ├── 资源 tag 列表
│   ├── 丰度配置行
│   ├── 日光配置
│   └── 候选列表
└── MapResourceFilterAdvancedPanel.vue (高级模式)
    ├── 工具栏 (跳数、允许中转、刷新)
    ├── tag 组列表
    │   └── 每个 tag 组卡片
    │       ├── 摘要态: tag 标签 + 编辑按钮
    │       └── 展开态: tag 选择器 + 丰度配置 + 日光配置
    ├── 添加组按钮
    └── 候选列表
```

## 状态模型

### 简单模式状态
- `selectedTags: string[]` - 选中的资源 ID 列表
- `minYieldByWare: Record<string, string>` - 各资源的最低丰度
- `sunlightMinimum: number` - 日光阈值
- `sunlightEnabled: boolean` - 是否启用日光过滤

### 高级模式状态
- `draftTagGroups: AdvancedResourceTagGroup[]` - 编辑中的 tag 组
- `appliedTagGroups: AdvancedResourceTagGroup[]` - 已应用的 tag 组
- `jumpLimitDraft: number` - 编辑中的跳数 (1-5)
- `jumpLimitApplied: number` - 已应用的跳数
- `allowTransitDraft: boolean` - 编辑中的允许中转
- `allowTransitApplied: boolean` - 已应用的允许中转
- `expandedGroupId: string | null` - 当前展开的组 ID
- `hasPendingRefresh: boolean` - 是否有待刷新的更改
- `selectedCandidateKey: string | null` - 当前选中的候选 key

### Tag 组结构
```typescript
type AdvancedResourceTagGroup = {
  id: string           // 组 ID (group_1, group_2, ...)
  tagIds: string[]     // tag ID 列表 (包含资源 ID 或 'sunlight')
  minYieldByWare: Record<string, string>  // 各资源的最低丰度
  sunlightMinimum: number  // 日光阈值 (0-200+)
}
```

### 候选结构
```typescript
type AdvancedCandidate = {
  resourceSectorIds: string[]    // 资源星区 ID 列表
  hubCandidateSectorIds: string[] // 中转核心候选 ID 列表
  coveredGroupIds: string[]      // 覆盖的组 ID 列表
  score: number                  // 评分
}
```

## 计算逻辑摘要

### 组内 AND 语义
- 一个星区命中某个 tag 组，必须同时满足该组内全部 tag 条件
- 日光条件与普通资源条件独立判定

### 组间 AND 语义
- 一个候选有效，当且仅当其资源星区集合合起来覆盖全部 tag 组
- 单个星区可同时覆盖多个组

### 候选生成流程
1. 计算每个星区命中的 tag 组集合
2. 根据 `allowTransit` 确定中转核心候选池
3. 对每个核心 BFS 计算可达星区
4. 筛选出覆盖全部组的候选
5. 按资源星区集合合并核心
6. 过滤严格子集候选

### 评分规则
1. 对每个 tag 组，在候选资源星区中找最佳星区
2. 最佳星区 = 该组内普通资源 level 平均值最高
3. 候选分数 = 所有组分数的最小值
4. 日光不参与评分

## 星区图构建

### 跨 cluster 连通
- `buildSectorGraph()` 同时使用 `sector_links` 和 `cluster_gates`
- `cluster_gates.target_cluster_id` 建立跨 cluster 边
- 双向连通: 只有双方都有对方的 gate 才建立边

## 已知 Bug 记录

### BUG-001: 跨 cluster 候选缺失
- 发现时间: 2026-03-13
- 现象: 高级资源过滤在 2 跳和允许中转条件下，跨 cluster 的候选组合未进入结果
- 原因: `buildSectorGraph()` 遗漏了 `cluster_gates` 对应的跨 cluster 连通关系
- 状态: 待验证