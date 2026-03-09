# 飞船蓝图预载入需求设计

## 目标

在飞船配装页面提供可直接载入的预制蓝图，并统一"当前蓝图状态"显示与交互。区分"预制蓝图"和"用户已保存蓝图"，并保证删除、载入、修改后的状态一致可预期。

## 核心数据结构

### ShipBlueprint 扩展

```typescript
interface ShipBlueprint {
  id: string
  name: string
  shipId: string
  connections: ShipBlueprintConnection[]
  hull?: ShipBlueprintHull
  storage?: ShipBlueprintStorage
  lastUpdated: number
  // 新增字段
  presetType?: 'empty' | 'low' | 'medium' | 'high'  // 预制类型
}
```

### 预制蓝图列表结构

```typescript
type BlueprintListItem =
  | { type: 'preset', presetType: 'empty' | 'low' | 'medium' | 'high', name: string }
  | { type: 'saved', id: string, name: string }
```

## 预制生成规则

### 槽位装配策略

| 预制类型 | 装备选择规则 |
|----------|--------------|
| 空配 | 不装配任何装备，仅保留船体 |
| 低配 | 优先 MK1 |
| 中配 | 优先 MK2，缺失时回退 MK1 |
| 高配 | 选择最高 MK |

### 种族匹配规则

1. 先按飞船种族匹配装备
2. 若无匹配，放宽种族限制（选择无种族限制装备）

### 引擎优先级

- `purposePrimary = fight`：战斗引擎 > 全能引擎 > 巡航引擎
- 其他：巡航引擎 > 全能引擎 > 战斗引擎

### 采矿炮塔规则

- 采矿船（`purposePrimary = mine`）：优先选择带采矿标签（mine/mining）的炮塔

### U 槽无人机规则

| 飞船类型 | U 槽配置 |
|----------|----------|
| L/XL 采矿船 | 1 运输无人机 + 9 采矿无人机（受槽位容量约束） |
| 运输向飞船 | 全部运输无人机 |
| 建造向飞船 | 全部建造无人机 |
| 其他舰船 | 全部防御无人机 |

## UI 组件设计

### ShipBuildWorkspaceView.vue 顶部栏

- **左侧控件**：
  - 飞船名称 + 更换飞船按钮合并为整体
  - 左对齐，宽度匹配文字内容
  - hover 时整体高亮
  - 中间分割线为原高度的一半
  - 使用当前版本更换飞船图标

- **右侧控件**：
  - 蓝图选择按钮右对齐
  - 按钮上显示当前蓝图状态

### BlueprintDropdown.vue（新增）

- 点击后向 Fit 区域右侧弹出列表
- 列表内容：
  - 4 个预制蓝图（空配/低配/中配/高配）
  - 当前飞船下所有已保存蓝图

- 列表项显示规则：
  - 空配置显示"空配"
  - 已保存蓝图显示蓝图名称
  - 载入预制后显示对应预制名
  - 载入预制后发生实际装备变更时显示"自定义"

- 脏状态红点：
  - 预制刚载入时不显示红点
  - 发生实际装备变化后显示红点
  - 保存后取消红点

- 列表项交互：
  - 非预制蓝图支持删除
  - 删除按钮仅在该行 hover 时显示
  - 行高不变、hover 不抖动
  - 删除后自动关闭下拉框

- 高亮规则：
  - 若当前使用的是"已保存蓝图"，其在列表中高亮为绿色

### LoadShipBlueprintModal.vue

- 紧凑三行结构：
  - 第一行：蓝图名称 + 槽位数（预制不显示时间）
  - 第二行：装备统计摘要
  - 第三行：载入/删除操作行
- 不显示飞船名称
- 预制项不显示删除按钮
- 装备统计按真实槽位类型聚合显示（引擎、推进器、护盾、武器、炮塔）

## 状态管理

### BlueprintListItem 显示规则

```typescript
function getBlueprintDisplayName(blueprint: ShipBlueprint, presetType?: string): string {
  if (presetType) {
    return t(`ship_build.preset.${presetType}`)
  }
  if (!blueprint.name && presetType) {
    return t(`ship_build.preset.${presetType}`)
  }
  if (!blueprint.name && !presetType) {
    return t('ship_build.blueprint_custom')
  }
  return blueprint.name
}
```

### 脏状态与红点规则

| 场景 | 蓝图名称 | 状态显示 | isDirty | 红点 |
|------|----------|----------|----------|------|
| 载入预制 | `''` | 预制名 | true | 不显示 |
| 预制后修改装备 | `''` | 自定义 | true | 显示 |
| 载入已保存蓝图 | 蓝图名 | 蓝图名 | true | 不显示 |
| 已保存蓝图后修改 | 蓝图名 | 蓝图名 | true | 显示 |
| 删除当前蓝图 | `''` | 自定义 | true | 显示 |
| 保存蓝图 | 蓝图名 | 蓝图名 | false | 不显示 |

### 删除当前蓝图行为

- 不允许工作区消失
- 当前内容转为未保存状态继续编辑
- 蓝图名称置为 `''`
- 状态显示为"自定义"
- 标记为 dirty

## 工具栏修改

- Ship 界面隐藏"加载"按钮

## 文案与国际化

所有新增用户可见文案接入 i18n：

```json
{
  "ship_build": {
    "preset": {
      "empty": "空配",
      "low": "低配",
      "medium": "中配",
      "high": "高配"
    },
    "blueprint_custom": "自定义",
    "change_ship": "更换飞船"
  }
}
```

## 关键文件清单

1. `src/store/logic/blueprintPresets.ts` - 新增，预制生成逻辑
2. `src/store/useShipBuildStore.ts` - 修改，添加预制蓝图支持
3. `src/components/ship-build/ShipBuildWorkspaceView.vue` - 修改，顶部栏
4. `src/components/ship-build/BlueprintDropdown.vue` - 新增，蓝图下拉组件
5. `src/components/ship-build/LoadShipBlueprintModal.vue` - 修改，紧凑布局
6. `src/locales/en.json` - 修改，新增 i18n 文案
7. `src/locales/zh-CN.json` - 修改，新增 i18n 文案
