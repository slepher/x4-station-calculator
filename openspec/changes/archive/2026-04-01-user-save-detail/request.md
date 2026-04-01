# User Save Detail - request.md

## 目标

重构 SaveDetailPanel.vue，将单一平铺列表改为 5 Tab 结构，按类型分类展示存档数据。

## 已确认方案

### Tab 结构（顺序）

| Tab Key | Tab 名称 | 数据来源 | 过滤条件 |
|---------|---------|---------|---------|
| `player-stations` | 用户空间站 | `stations` | `owner === 'player'` |
| `npc-stations` | NPC据点 | `stations` | `owner !== 'player' && is_headquarter === true` |
| `abandoned-ships` | 弃船 | `abandonedShips` | 全部 |
| `datavaults` | 数据保险箱 | `datavaults` | 全部 |
| `erlking-vaults` | 妖王保险箱 | `erlkingVaults` | 全部 |

### Tab 内组织方式

- 每个 Tab 内条目按 Sector 分组显示
- Sector 为分组标题，条目为列表

### 条目显示字段

| Tab | 显示字段 |
|-----|---------|
| 用户空间站 | code + 坐标(km) + HQ 标记 |
| NPC据点 | owner + 坐标 + sector 名称 |
| 弃船 | class + 坐标 + sector 名称 |
| 数据保险箱 | 坐标 + has_blueprints/wares/signalleak 标记 + sector 名称 |
| 妖王保险箱 | 坐标 + has_blueprints/wares/signalleak 标记 + sector 名称 |

### 坐标格式

- 游戏内单位：米
- 显示格式：`(value / 1000).toFixed(1) + 'km'`

### UI 集成

- 使用 `ViewTabUI.vue` 组件
- 放置位置：标题栏右侧
- Tab 状态在 SaveDetailPanel 组件内部管理（ref）

### 特殊标记

- HQ 标记：`is_headquarter === true` 时显示
- Datavault 标记：`has_blueprints`, `has_wares`, `has_signalleak`

## 边界

### In Scope

- SaveDetailPanel.vue 重构（Tab 结构）
- ViewTabUI 组件集成
- 按 Sector 分组逻辑
- 条目显示字段调整
- i18n 文本新增

### Out of Scope

- modules 详情展示
- 搜索/过滤功能
- 排序选项
- 地图可视化
- 与 empire 数据联动

## 验收标准（DoD）

1. SaveDetailPanel 显示 5 个 Tab，顺序为：用户空间站 → NPC据点 → 弃船 → 数据保险箱 → 妖王保险箱
2. 使用 ViewTabUI 组件，放置在标题栏右侧
3. Tab 切换正常工作
4. 每个 Tab 内条目按 Sector 分组显示
5. 用户空间站条目显示：code + 坐标(km) + HQ 标记
6. NPC据点条目显示：owner + 坐标 + sector 名称
7. 弃船条目显示：class + 坐标 + sector 名称
8. 数据保险箱条目显示：坐标 + 特殊标记 + sector 名称
9. 妖王保险箱条目显示：坐标 + 特殊标记 + sector 名称
10. 坐标格式正确（km 单位）
11. 未选中存档时显示空状态提示
12. 构建成功，无编译错误

## 未决项

无