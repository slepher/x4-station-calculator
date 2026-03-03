# UI Knowledge: ship-build-storage

## 本轮测试执行备注

- 本 change 为飞船建造持久化功能，新增：
  - `x4_ship_blueprints` localStorage key
  - LoadShipBlueprintModal 对话框组件
  - SmartSaveDialog 对话框扩展支持 ship-build 类型

## 页面区域与交互实体

### 工具栏按钮（在 ShipBuildView.vue）

- New 按钮：`.btn-tool` + i18n 文本 "新建" 或 "New"
- Save 按钮：`.btn-tool` + i18n 文本 "保存" 或 "Save"
- Save As 按钮：`.btn-tool` + i18n 文本 "另存为" 或 "Save As"
- Load 按钮：`.btn-tool` + i18n 文本 "载入" 或 "Load"

### 配装区槽位类型切换（ShipBuildFitCandidate.vue）

- 槽位类型按钮容器：`.left-rail`
- 槽位类型按钮：`.slot-type-btn`
  - E (engine): `button.slot-type-btn:has-text("^E$")`
  - S (shield): `button.slot-type-btn:has-text("^S$")`
  - W (weapon): `button.slot-type-btn:has-text("^W$")`
  - T (turret): `button.slot-type-btn:has-text("^T$")`
  - R (thruster): `button.slot-type-btn:has-text("^R$")`
- 激活状态：`.slot-type-btn-active`
- 分组标签：`.group-tabs .group-tab`
- 装备卡片：`.option-card`
- 选中数量显示：`.picked` 或 `.wall-header span:nth-child(2)`
- 选中高亮：`.option-card-active`

### Save As 对话框（复用 SmartSaveDialog）

- 容器：`[data-testid="smart-save-dialog"]` 或 `.smart-save-dialog`
- 输入框：`.dialog-input` 或 `input[type="text"]`
- 确认按钮：`.dialog-confirm` 或 `.btn-primary`
- 取消按钮：`.dialog-cancel` 或 `.btn-secondary`

### Load 对话框（新建 LoadShipBlueprintModal）

- 容器：`[data-testid="load-blueprint-modal"]`
- 弹窗遮罩：`.modal-overlay`
- 弹窗内容：`.modal-content`
- 标题：`h2` 或 `.modal-title` 包含 "载入Blueprint" 或 "Load Blueprint"
- blueprint 列表：`.blueprint-list`
- blueprint 项：`.blueprint-item`
- blueprint 名称：`.blueprint-name`
- blueprint 飞船名：`.blueprint-ship-name`
- blueprint 更新时间：`.blueprint-updated`
- 删除按钮：`.blueprint-delete-btn`
- 确认加载按钮：`.btn-primary` 或 `.load-btn`
- 取消按钮：`.btn-secondary` 或 `.cancel-btn`

## Store 暴露方式

在 dev/test 模式下，store 暴露在 window 对象上：

```typescript
// 访问 shipBuild store
window.shipBuildStore

// 关键属性和方法
- shipBuildStore.blueprint           // 当前 blueprint 源数据
- shipBuildStore.savedBlueprints     // localStorage 中的全部 blueprint
- shipBuildStore.activeBlueprintId   // 当前 active blueprint ID
- shipBuildStore.isDirty            // 是否有未保存修改
- shipBuildStore.selectedShipId     // 当前选中的飞船 ID
- shipBuildStore.selectedClass      // 当前筛选的 class
- shipBuildStore.selectedRaces     // 当前筛选的 race
- shipBuildStore.selectedTypes     // 当前筛选的 type
- shipBuildStore.selectedByConnection // computed view 数据

// 方法
- shipBuildStore.saveBlueprint()
- shipBuildStore.saveAsBlueprint(name)
- shipBuildStore.loadBlueprint(id)
- shipBuildStore.deleteBlueprint(id)
- shipBuildStore.setEquipment(slotType, group, equipmentId, count)
- shipBuildStore.setShield(slotType, group, equipmentId, count)
```

## localStorage 操作

```typescript
// 读取
const data = localStorage.getItem('x4_ship_blueprints')
const parsed = data ? JSON.parse(data) : { version: 1, activeId: null, list: [] }

// 写入
localStorage.setItem('x4_ship_blueprints', JSON.stringify({
  version: 1,
  activeId: 'uuid',
  list: [...]
}))

// 清除（测试用）
localStorage.removeItem('x4_ship_blueprints')
```

## 状态语义（供自动化与调试）

- `shipBuildStore.blueprint`：当前 blueprint 源数据（ShipBlueprint | null）
- `shipBuildStore.savedBlueprints`：localStorage 中全部 blueprint（SavedShipBlueprintsState）
- `shipBuildStore.activeBlueprintId`：当前 active blueprint ID（string | null）
- `shipBuildStore.isDirty`：是否有未保存修改（boolean）
- `shipBuildStore.selectedByConnection`：computed view 数据（Record<string, { equipmentId, count }>）

## 标准测试状态

### 状态：持久化-初始状态

- 建立动作（state-switch actions）：
  - 清除 localStorage 中的 `x4_ship_blueprints`
  - 切换到 `ship-build` 视图
- 到位探针（state probes）：
  - `shipBuildStore.blueprint === null`
  - `shipBuildStore.savedBlueprints.list.length === 0`
  - New/Save/Save As/Load 按钮可见

### 状态：持久化-已选飞船（进入配装区）

- 建立动作（state-switch actions）：
  - 切换到 `ship-build` 视图
  - 若当前已选中其他飞船，先点击"选船列表
  - 在筛选更换飞船"回到区选择：`class=M`、`race=terran`、`type=轻型护卫舰`
  - 在结果列表选择"大太刀"
- 到位探针：
  - `shipBuildStore.selectedShipId` 为大太刀 ID
  - 配装区容器可见

### 状态：持久化-已配置装备

- 建立动作（state-switch actions）：
  - 进入"持久化-已选飞船"状态
  - 点击左侧 `slotType` 的 `engine` 标签
  - 选择 `group_back_up_mid` 分组，在候选列表选择 `engine_am`
  - 切换到 `shield` 标签，选择 `con_shield_01`，选择 `shield_gen_m`
- 到位探针：
  - `shipBuildStore.blueprint.connections` 包含 engine 和 shield 配置

### 状态：持久化-已保存 Blueprint

- 建立动作（state-switch actions）：
  - 进入"持久化-已配置装备"
  - 点击工具栏 Save 按钮
- 到位探针：
  - localStorage 包含 `x4_ship_blueprints` key
  - `shipBuildStore.activeBlueprintId` 有值
  - `shipBuildStore.isDirty === false`

### 状态：持久化-有未保存修改

- 建立动作（state-switch actions）：
  - 进入"持久化-已保存 Blueprint"
  - 修改装备配置（如更换引擎）
- 到位探针：
  - `shipBuildStore.isDirty === true`

## 样本船语义映射

- `大太刀`（ship_ter_m_corvette_02_a）：
  - 用途：测试飞船，M 级，terran，轻型护卫舰
  - slot_type：engine, shield, weapon, turret
- `大阪`（ship_ter_l_destroyer_01_a）：
  - 用途：测试飞船，L 级，terran，驱逐舰
  - 特点：高炮塔数量，多分组

## 定位器建议

### 工具栏按钮

```typescript
// 工具栏按钮
'.btn-tool:has-text("新建")'  // New
'.btn-tool:has-text("保存")'  // Save
'.btn-tool:has-text("另存为")' // Save As
'.btn-tool:has-text("载入")'  // Load

// 或英文
'.btn-tool:has-text("New")'
'.btn-tool:has-text("Save")'
'.btn-tool:has-text("Save As")'
'.btn-tool:has-text("Load")'
```

### Save As 对话框

```typescript
// 对话框容器
'[data-testid="smart-save-dialog"]'
'.smart-save-dialog'

// 输入框
'[data-testid="smart-save-dialog"] input[type="text"]'
'.dialog-input'

// 按钮
'[data-testid="smart-save-dialog"] .btn-primary'  // 确认
'[data-testid="smart-save-dialog"] .btn-secondary' // 取消
```

### Load 对话框

```typescript
// 对话框容器
'[data-testid="load-blueprint-modal"]'
'.load-blueprint-modal'

// 标题
'[data-testid="load-blueprint-modal"] h2'
'.modal-title'

// blueprint 列表
'[data-testid="load-blueprint-modal"] .blueprint-list'

// blueprint 项（动态 ID）
'[data-testid="load-blueprint-modal"] .blueprint-item[data-blueprint-id="${id}"]'

// blueprint 名称
'.blueprint-item .blueprint-name'

// 飞船名称（第一行）
'.blueprint-item > div:first-child'

// 装备统计（第二行）
'.blueprint-item > div:nth-child(2)'

// 删除按钮（动态 ID）
'[data-testid="load-blueprint-modal"] .blueprint-delete-btn[data-blueprint-id="${id}"]'

// 加载按钮
'[data-testid="load-blueprint-modal"] .btn-primary'

// 取消按钮
'[data-testid="load-blueprint-modal"] .btn-secondary'
```

## Web 断言建议

### 保存 Blueprint

- 断言 localStorage 包含 `x4_ship_blueprints`
- 断言 `shipBuildStore.activeBlueprintId` 有值
- 断言 blueprint 的 `shipId` 为当前选中的飞船 ID
- 断言 blueprint 的 `connections` 包含配置的装备

### 另存为新 Blueprint

- 断言 localStorage 包含 2 条 blueprint
- 断言新 blueprint 的 name 为输入的名称
- 断言 `activeBlueprintId` 指向新 blueprint

### 载入 Blueprint

- 断言 `shipBuildStore.selectedShipId` 为 blueprint 的 shipId
- 断言 `shipBuildStore.selectedClass` 自动设置
- 断言 `shipBuildStore.selectedRaces` 自动设置
- 断言 `shipBuildStore.selectedTypes` 自动设置
- 断言 `shipBuildStore.selectedByConnection` 包含配置的装备

### 删除 Blueprint

- 断言 localStorage 中 blueprint 数量减少
- 断言删除的 blueprint 不在列表中

### Dirty State

- 修改装备后断言 `isDirty === true`
- 保存后断言 `isDirty === false`
- 点击 New/切换视图时断言弹出未保存确认对话框

## 样本 Blueprint 数据（用于测试）

```json
{
  "version": 1,
  "activeId": "test-blueprint-1",
  "list": [
    {
      "id": "test-blueprint-1",
      "name": "大太刀测试配装",
      "shipId": "ship_ter_m_corvette_02_a",
      "connections": [
        {
          "slot_type": "engine",
          "group": [
            {
              "group": "group_back_up_mid",
              "equipment_id": "engine_am",
              "count": 3
            }
          ]
        },
        {
          "slot_type": "shield",
          "group": [
            {
              "group": "con_shield_01",
              "equipment_id": "shield_gen_m",
              "count": 1,
              "shield": {
                "equipment_id": "shield_gen_m",
                "count": 1
              }
            }
          ]
        }
      ],
      "lastUpdated": 1700000000000
    }
  ]
}
```

## 与 test_tasks 对齐说明

- `test_tasks.md` 的状态项使用本文件的 store 暴露方式和定位器
- `test_tasks.md` 的场景步骤基于本文件的"建立动作"实现
- 本 change 依赖 `ship-build-equipment` 的飞船选择和配装操作基线
- 本 change 不涉及 `tests/fixtures/ware_fixtures.yaml` 与 `module_fixtures.yaml` 的产品/模块映射要求

---

## 测试运行

### LoadShipBlueprintModal 显示优化测试结果

- [✓] 3.15 Load弹窗显示本地化飞船名称
- [✓] 3.16 Load弹窗装备按类型+大小分组显示
- [✓] 3.17 Load弹窗装备大小排序XL>L>M>S
- [✓] 3.18 Load弹窗副盾单独显示且排最后
- [✓] 3.19 Load弹窗副盾按大小分组
- [✓] 3.20 保存后connections按固定顺序排列
- [✗] 3.21 载入后connections保持正确顺序（store API 访问问题）
- [✓] 3.22 Load弹窗飞船名称和装备统计分两行显示

### 历史遗留问题（与新功能无关）

- 2.4-2.6, 3.1-3.11 等测试失败：Save 按钮状态转换问题
- 3.12 Bug测试失败：shield 标签切换问题
