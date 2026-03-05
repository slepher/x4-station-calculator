# UI Knowledge: build-ship-equipment-panel

本文档记录装备对比面板相关的 UI 知识和测试定位信息。

## 组件结构

### 组件层级

```
ShipBuildView
  └── ShipBuildPanelFit (Picker 控制)
        └── Picker 候选卡片（显示 summary 信息）
  └── ShipBuildPanelEquipment (新增对比面板，显示 details 信息)
  └── ShipBuildPanelStats
  └── ShipBuildPanelMaterials
```

### 组件名称

- `ShipBuildPanelEquipment` - 装备对比面板组件

### UI 区域划分

1. **Picker 候选卡片**：右侧固定信息区显示 `summary`（2 项关键数据）
2. **Panel Details**：对比面板显示完整属性列表（详细数据）

## 数据属性映射

### Summary 字段（Picker 候选卡片，2 项）

| 装备类型 | Summary 字段 | 示例值 |
|----------|--------------|--------|
| weapon | burstDPS, range | `1500, 800m` |
| turret | sustainedDPS, range | `800, 600m` |
| shield | shieldMax, shieldDelay | `5000, 5s` |
| engine | speed, travelSpeed | `580, 450` |
| thruster | strafeSpeed, yawRate | `120, 45` |

### Details 字段（Panel 对比面板，完整属性列表）

| 装备类型 | Details 字段数量 | 示例字段 |
|----------|------------------|----------|
| weapon | 13 项 | burstDPS, sustainedDPS, range, singleDamage, singleShotTime, avgShotTime, ammo, ammoReload, chargetime, timeToOverheat, cooldelay, coolTime, cycleTime |
| turret | 13 项 | 同 weapon |
| shield | 3 项 | shieldMax, shieldRate, shieldDelay |
| engine | 14 项 | thrustForward, boostMultiplier, boostAcceleration, boostDuration, boostRecharge, travelThrust, travelAttack, travelCharge, travelSpeed, travelAcceleration, speed, acceleration, boostSpeed, boostAccel |
| thruster | 9 项 | pitch, yaw, roll, strafe, pitchRate, yawRate, rollRate, strafeSpeed, strafeAcceleration |

## UI 定位器

### 面板可见性

- **Picker 展开状态**: 检测 Picker 容器是否可见
- **对比面板可见**: 检测 `ShipBuildPanelEquipment` 组件根元素 `visible` 状态
- **无装备时隐藏**: 对比面板 `display: none` 或从 DOM 移除

### Picker 候选卡片 Summary

- **容器**: `.candidate-summary`
- **Weapon 项**: `.summary-weapon`
- **Turret 项**: `.summary-turret`
- **Shield 项**: `.summary-shield`
- **Engine 项**: `.summary-engine`
- **Thruster 项**: `.summary-thruster`

### Panel 对比面板 Details

- **容器**: `.equipment-details`
- **进度条容器**: `.equipment-comparison-progress`
- **当前值标记**: `.progress-current`
- **候选值标记**: `.progress-candidate`
- **正差值样式**: 蓝色 (`text-blue-500` 或 CSS 类)
- **无比较时**: 只显示当前装备信息，无进度条

### 数值显示

- **数字格式**: 包含 `(+` 或 `(-` 的文本节点
- **示例**: `100(+20)`, `80(-20)`

## 测试数据

### 测试飞船

| 飞船名称 | class | race | type | 用途 |
|----------|-------|------|------|------|
| 大太刀 | M | terran | 轻型护卫舰 | 标准测试状态 |
| 大阪 | L | terran | 驱逐舰 | 多炮塔测试 |
| 苍鹭 | L | teladi | 货船 | 跨种族测试 |

### 测试 Slot/Connection

| 飞船 | slotType | connection | 用途 |
|------|----------|------------|------|
| 大太刀 | engine | con_engine_01 | 引擎测试 |
| 大太刀 | shield | con_shield_01 | 护盾测试 |
| 大太刀 | weapon | con_weapon_01 | 武器测试 |
| 大太刀 | turret | con_turret_m_01 | 炮塔测试 |
| 大太刀 | thruster | con_thruster_xx | 推进器测试 |

## 状态定义

### 2.1 equipment-panel-visible-turret-picker-open
- 船只建造视图已选择大太刀
- 切换到 turret 标签
- 点击 con_turret_m_01 打开 Picker
- 点击选中某个候选装备
- ShipBuildPanelEquipment 面板显示

### 2.2 equipment-panel-visible-engine-picker-open
- 船只建造视图已选择大太刀
- 点击 con_engine_01 打开 Picker
- 点击选中候选引擎
- 面板显示且显示引擎 summary

### 2.3 equipment-panel-visible-shield-picker-open
- 船只建造视图已选择大太刀
- 点击 con_shield_01 打开 Picker
- 点击选中候选护盾
- 面板显示且显示护盾 summary

### 2.4 equipment-panel-visible-weapon-picker-open
- 船只建造视图已选择大太刀
- 点击 con_weapon_01 打开 Picker
- 点击选中候选武器
- 面板显示且显示武器 summary

### 2.5 equipment-panel-visible-thruster-picker-open
- 船只建造视图已选择大太刀
- 切换到 thruster 标签，点击某分组打开 Picker
- 点击选中候选推进器
- 面板显示且显示推进器 summary

### 2.6 equipment-panel-visible-no-current-equipment
- 船只建造视图已选择大太刀
- 点击未配装的 con_weapon_01 打开 Picker
- 点击选中候选装备
- 面板显示，仅显示候选装备数值

### 2.7 equipment-panel-same-equipment-selected
- 船只建造视图已选择大太刀，已为某槽位配装装备
- 打开同一槽位的 Picker
- 点击选中与当前相同的装备
- 面板显示当前装备信息，不显示比较进度条

## 视觉检查点

### 显示条件

1. Picker 展开（Picker 容器可见）
2. 点击选中候选装备
3. 当前装备或候选装备至少有一个存在

### 隐藏条件

1. Picker 收起
2. 当前装备和候选装备都为空

### 比较进度条

- 蓝色表示候选 > 当前（正差值）
- 粉色表示候选 < 当前（负差值）
- 灰色表示当前值基准
- 候选与当前相同时：不显示比较进度条

### Summary vs Details

- **Summary**：Picker 候选卡片右侧显示，2 项关键数据
- **Details**：Panel 对比面板显示，完整属性列表

### Engine Summary 格式

- speed: 数字类型，如 `580`
- travelSpeed: 数字类型，如 `450`
- 错误: `[object Object]`, `undefined`, 空值

## 测试运行

### 2.x 状态测试 Selectors

| 测试步骤 | Selector | 说明 |
|---------|---------|------|
| 切换到 turret 标签 | `getByTestId('slot-type-turret')` | 使用 data-testid |
| 切换到 engine 标签 | `getByTestId('slot-type-engine')` | 同上 |
| 切换到 shield 标签 | `getByTestId('slot-type-shield')` | 同上 |
| 切换到 weapon 标签 | `getByTestId('slot-type-weapon')` | 同上 |
| 切换到 thruster 标签 | `getByTestId('slot-type-thruster')` | 同上 |
| 点击槽位打开 Picker | `locator('[data-testid^="slot-"]').filter({ hasText: /M.*T/i })` | 使用 data-testid 前缀匹配 + 文本过滤 |
| Picker 候选列表 | `.candidate-list .candidate-item` | CSS 类选择器 |
| 确认按钮 | `getByTestId('picker-confirm')` | data-testid |

### 进入船只建造视图流程

正确流程：
1. `getByRole('button', { name: /Load|载入|加载/ }).click()` - 点击 Load 按钮
2. `locator('.blueprint-item').filter({ hasText: /Odachi|odachi/i }).first().click()` - 选择大太刀蓝图
3. `odachiItem.getByRole('button', { name: /Load|载入|加载/ }).first().click()` - 点击确认加载

错误方式：直接使用 "Change Ship" 按钮，该方式在某些 fixture 状态下不工作。

### 产品功能验证

- `ShipBuildPanelEquipment` 组件已实现，状态传递正确
- 显示条件：`isPickerOpen && (currentEquipment || candidateEquipment)`
- 组件有 `data-testid="ship-build-panel-equipment"` 属性

### 测试状态

- [✗] 2.1 - 2.7 状态测试 - 需修复 selectors
- [✗] 3.1 - 3.21 场景测试 - 需修复 selectors
- [✓] 3.22 进度条颜色显示（diff > 0）
- [✓] 3.23 进度条颜色显示（diff < 0）
- [✓] 3.24 进度条颜色显示（diff = 0）

### BUG 测试运行

- [✓] 4.1 BUG-001: Picker展开后material未隐藏且宽度未变化
  - bug 测试：失败（实际 picker 已展开，宽度变为 lg:col-span-8）
  - bugfix 测试：通过
  - 结论：修复已生效
- [✓] 4.2 BUG-002: 选择空候选槽后PanelEquipment不显示
  - bug 测试：失败（面板实际显示，非 bug）
  - bugfix 测试：通过
  - 结论：功能正常，bug 不存在
- [✓] 4.3 BUG-003: 无装备槽位打开Picker后候选槽无法点击
  - bug 测试：失败（面板实际显示，非 bug）
  - bugfix 测试：通过
  - 结论：功能正常，bug 不存在
- [✓] 4.4 BUG-004: 空候选槽数值为0时样式显示错误
  - bug 描述：当前槽位有装备且某属性值为0时，选择空候选槽，PanelEquipment中该属性显示为绿色，期待显示为灰色
  - 涉及属性：boostDuration（巡航加力时间）
  - 预期样式：数值为0时显示灰色
