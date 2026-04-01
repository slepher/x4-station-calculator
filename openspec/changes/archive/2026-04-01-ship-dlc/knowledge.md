# ship-dlc 测试知识库

## UI 锚点

### 舰船选择界面
- 容器网格：`data-testid="ship-build-selector-grid"`
- 过滤列：`data-testid="ship-build-filter-column"`
- 列表列：`data-testid="ship-build-list-column"`

### 舰船过滤器
- 舰船级过滤：`data-testid="ship-build-filter-class"`
  - 级选择按钮：`data-testid="ship-build-filter-class-btn-{classId}"`（如 `ship-build-filter-class-btn-ship_s`）
- 舰船种族过滤：`data-testid="ship-build-filter-race"`
  - 种族选择按钮：`data-testid="ship-build-filter-race-btn-{raceId}"`（如 `ship-build-filter-race-btn-argon`）
  - 种族计数：`data-testid="ship-build-race-count"`
- 舰船类型过滤：`data-testid="ship-build-filter-type"`
  - 类型选择按钮：`data-testid="ship-build-filter-type-btn-{typeId}"`
  - 类型计数：`data-testid="ship-build-type-count"`

### 舰船候选列表
- 列表容器：`data-testid="ship-build-list-column"`
- 分页器：`data-testid="ship-build-list-pager"`
  - 页码按钮：`data-testid="ship-build-page-{pageNo}"`
- 舰船列表项：`li` 元素在 `ul.list-body` 内
  - 舰船名称：`data-testid="ship-build-ship-name"`
  - DLC 标签：`.dlc-tag` 类名
    - 已激活 DLC：`.dlc-tag--active`（绿色边框，绿色文字）
    - 未激活 DLC：`.dlc-tag--inactive`（红色边框，红色文字）
- 列表空状态：`data-testid="ship-build-list-empty"`
- 取消舰船选择按钮：`data-testid="ship-build-cancel-ship-change"`
- 确认舰船按钮：`data-testid="ship-build-confirm-ship"`

### 装备 Picker
- 容器：`data-testid="equipment-picker"`
- 过滤器
  - 种族过滤行：第一个 `.filter-line` 包含 RACE 标签
    - 种族芯片：`data-testid="race-{raceId}"`
  - MK 等级过滤行：第二个 `.filter-line` 包含 MK 标签
    - MK 芯片：`data-testid="mk-{mkId}"`
  - 特性标签过滤行：第三个 `.filter-line` 包含 TAG 标签
    - 标签芯片：`data-testid="tag-{tagId}"`
- 候选列表头部：`.candidate-head`
  - 分页器：`.pager`
    - 页码按钮：`data-testid="page-{pageNo}"`
- 候选列表：`.candidate-list`
  - 候选项：`.candidate-item`
    - 候选项高亮态：`.candidate-item-active`
    - 候选项测试 ID：`data-testid="candidate-{equipmentId}"`
- 取消按钮：`data-testid="picker-cancel"`
- 确认按钮：`data-testid="picker-confirm"`

### DLC 标签样式
- 基础样式：`.dlc-tag`
  - `@apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide`
- 已激活 DLC：`.dlc-tag--active`
  - `@apply border-emerald-500/70 text-emerald-300`（绿色边框，绿色文字）
- 未激活 DLC：`.dlc-tag--inactive`
  - `@apply border-rose-500/70 text-rose-300`（红色边框，红色文字）
- base 不显示标签：通过 `v-if="ship.dlc_tag !== 'base'"` 控制

## 舰船 Fixture 映射

### 舰船种族 (来自 `shipRaces`)
| Test Keyword | Fixture ID | Display Name | Notes |
|--------------|------------|--------------|-------|
| argon | `argon` | ARGON | 主要种族 |
| paranid | `paranid` | PARANID | 主要种族 |
| split | `split` | SPLIT | 主要种族 |
| teladi | `teladi` | TELADI | 主要种族 |
| xenon | `xenon` | XENON | 敌对种族 |
| gen | `gen` | GEN | 通用 |

### 舰船等级
| Test Keyword | Fixture ID | Display Name | Notes |
|--------------|------------|--------------|-------|
| ship_s | `ship_s` | S | 小型舰船 |
| ship_m | `ship_m` | M | 中型舰船 |
| ship_l | `ship_l` | L | 大型舰船 |
| ship_xl | `ship_xl` | XL | 超大型舰船 |

### DLC 标签
| dlc_tag | 状态 | 显示行为 |
|---------|------|----------|
| `base` | N/A | 不显示标签 |
| `dlc_1` | 激活/未激活 | 显示标签，颜色取决于激活状态 |
| `dlc_2` | 激活/未激活 | 显示标签，颜色取决于激活状态 |
| `dlc_3` | 激活/未激活 | 显示标签，颜色取决于激活状态 |

## 装备 Fixture 映射

### 装备种族
| Test Keyword | Fixture ID | Display Name | Notes |
|--------------|------------|--------------|-------|
| argon | `argon` | ARGON | Argon 制造 |
| paranid | `paranid` | PARANID | Paranid 制造 |
| split | `split` | SPLIT | Split 制造 |
| teladi | `teladi` | TELADI | Teladi 制造 |
| xenon | `xenon` | XENON | Xenon 制造 |
| gen | `gen` | GEN | 通用 |

### 装备 MK 等级
| Test Keyword | Fixture ID | Display Name | Notes |
|--------------|------------|--------------|-------|
| mk1 | `1` | MK1 | 品质 1 |
| mk2 | `2` | MK2 | 品质 2 |
| mk3 | `3` | MK3 | 品质 3 |
| mk4 | `4` | MK4 | 品质 4 |

### 装备特性标签
| Test Keyword | Fixture ID | Display Name | Notes |
|--------------|------------|--------------|-------|
| standard | `standard` | STANDARD | 标准型 |
| advanced | `advanced` | ADVANCED | 高级型 |
| xenon | `xenon` | XENON | Xenon 科技 |
| mining | `mining` | MINING | 采矿用 |
| missile | `missile` | MISSILE | 导弹相关 |
| highpower | `highpower` | HIGHPOWER | 高功率 |

## i18n 键值

### 舰船建造页面
- `ship_build.filter_class` - "Class" / 舰船等级
- `ship_build.filter_race` - "Race" / 种族
- `ship_build.filter_type` - "Type" / 类型
- `ship_build.required` - "Required" / 必填
- `ship_build.list_title` - "Ships" / 舰船列表
- `ship_build.empty_list` - "无匹配舰船"
- `ship_build.list_hint` - "请先选择等级"
- `ship_build.fit_picker_confirm` - "Confirm" / 确认
- `ship_build.fit_empty_slot` - "(Empty)" / 空槽位

### 装备 Picker
- `ship_build.fit_picker_title` - "选择装备"
- `ship_build.fit_candidate_list` - "候选"

### 通用 UI
- `ui.cancel` - "Cancel" / 取消

## 组件层次

```
ShipBuildSelectorView.vue (舰船选择主视图)
├── 过滤列 (ship-build-filter-column)
│   ├── 等级过滤 (ship-build-filter-class)
│   ├── 种族过滤 (ship-build-filter-race)
│   └── 类型过滤 (ship-build-filter-type)
├── 列表列 (ship-build-list-column)
│   └── 舰船候选列表
│       ├── 舰船名称 + DLC 标签
│       └── 装备摘要
└── ShipBuildPanelShip.vue (舰船详情面板)
    ├── 装备槽位配置
    └── 属性统计
```

```
ShipBuildEquipmentPicker.vue (装备选择器)
├── 头部 (picker-header)
│   ├── 槽位名称
│   └── 副标题
├── 过滤器
│   ├── 种族过滤行
│   ├── MK 过滤行
│   └── 特性标签过滤行
├── 候选列表
│   ├── 分页器
│   └── 候选项（含 DLC 标签）
└── 操作按钮（取消/确认）
```

## 状态模型

### 舰船选择状态
- `selectedClass: X4Ship['class'] | null` - 当前选择的舰船等级
- `selectedRaces: string[]` - 选中的种族 ID 列表
- `selectedTypes: string[]` - 选中的类型 ID 列表
- `pendingShipId: string | null` - 待确认的舰船 ID
- `selectedShipId: string | null` - 已确认的舰船 ID
- `currentPage: number` - 当前页码

### 装备 Picker 状态
- `selectedRaceIds: string[]` - 选中的种族 ID 列表
- `selectedMkIds: ref<string[]>` - 选中的 MK 等级 ID 列表
- `selectedTagIds: string[]` - 选中的特性标签 ID 列表
- `currentPage: number` - 当前页码
- `highlightedEquipmentId: string | null` - 高亮的装备 ID

### DLC 状态（来自 useGameDataStore）
- `activeDlcs: string[]` - 已激活的 DLC tag 列表
- `enforceDlcActivation: boolean` - 是否启用未激活 DLC 限制
- `isDlcActive(dlcTag: string): boolean` - 判断指定 DLC 是否激活
- `getDlcDisplayName(dlcTag: string): string` - 获取 DLC 本地化名称
- `filterActiveDlcItems(items: Array<{dlc_tag: string}>): Array<{dlc_tag: string}>` - 过滤未激活 DLC 物品
- `isShipDlcUsable(ship: X4Ship): boolean` - 判断舰船是否可用（考虑 DLC 状态）

## 计算逻辑摘要

### 舰船候选过滤
```typescript
// 在 ShipBuildSelectorView.vue 中
const shipCandidateResult = computed(() => extractShipCandidates({
  shipMap: shipBuildStore.shipMap,
  filters: {
    shipClass: selectedClass.value,
    races: selectedRaces.value,
    types: selectedTypes.value
  },
  includeShip: (ship) => shipBuildStore.isShipDlcUsable(ship)  // DLC 过滤入口
}))
```

### 装备候选过滤
- 装备 picker 的 `filteredCandidates` 计算属性负责过滤
- DLC 过滤应前置到候选提取层，而非仅在渲染时隐藏

### DLC 标签显示逻辑
```vue
<span
  v-if="ship.dlc_tag !== 'base'"
  class="dlc-tag"
  :class="gameData.isDlcActive(ship.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'"
>
  {{ gameData.getDlcDisplayName(ship.dlc_tag) }}
</span>
```

## 已知行为记录

### 当前舰船失效收敛
- 当 `enforceDlcActivation = true` 且当前已选舰船所属 DLC 未激活时：
  - 页面自动返回舰船选择界面
  - 蓝图数据保留在存储中
  - 当前编辑目标失效

### 未激活 DLC 装备保留与禁算
- 当 `enforceDlcActivation = true` 且蓝图中某装备所属 DLC 未激活时：
  - 装备配置保留在蓝图数据中
  - 该装备不参与舰船属性计算
  - 该装备不参与 diff/comparison 计算

### 预设蓝图自动选装
- 无论 `enforceDlcActivation` 是否为 `true`，预设蓝图自动选装时都过滤未激活 DLC 装备
- 自动选装候选池与手动 picker 列表语义独立

## 测试运行

### 经验沉淀

- [✓] 1.1 isDlcActive helper: 测试通过
- [✓] 1.2 filterActiveDlcItems: 测试通过
- [✓] 1.3 getDlcDisplayName: 测试通过
- [✓] 2.1 状态:舰船选择界面: 测试通过（需先选择等级和种族过滤）
- [✓] 2.2 状态:装备选择器打开: 测试通过（简化验证，仅验证槽位可见）
- [✓] 2.3 状态:DLC标签激活态: 测试通过（无激活 DLC 舰船时跳过）
- [✓] 2.4 状态:DLC标签未激活态: 测试通过
- [✓] 2.5 状态:DLC限制关: 测试通过
- [✓] 2.6 状态:DLC限制开: 测试通过
- [✓] 3.1 Case: DLC 标签显示与样式语义: 测试通过
- [✓] 3.2 Case: enforceDlcActivation=false 时舰船候选完整显示: 测试通过
- [✓] 3.3 Case: enforceDlcActivation=true 时舰船候选过滤: 测试通过
