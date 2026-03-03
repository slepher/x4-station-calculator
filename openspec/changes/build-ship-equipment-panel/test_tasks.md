# Test Tasks: build-ship-equipment-panel

## 1 单元测试

- [ ] 1.1 EngineSummary 类型验证
  - [ ] 1.1.1 导入 EngineSummary 类型定义
  - [ ] 1.1.2 断言字段包含 speed: number 和 travelSpeed: number
  - [ ] 1.1.3 断言 travelSpeed 为数字类型 #期望: [number]

- [ ] 1.2 叠加显示进度条最大值计算
  - [ ] 1.2.1 准备多个候选装备及其属性数值
  - [ ] 1.2.2 调用最大值计算函数
  - [ ] 1.2.3 断言返回结果为所有候选中该项的最大值 #期望: [max(candidates)]

- [ ] 1.3 差值计算与颜色判定
  - [ ] 1.3.1 准备当前装备数值和候选装备数值
  - [ ] 1.3.2 调用差值计算函数
  - [ ] 1.3.3 断言差值为正时返回蓝色标记 #期望: ['blue']
  - [ ] 1.3.4 断言差值为负时返回粉色标记 #期望: ['pink']

- [ ] 1.4 数字格式生成（正差值）
  - [ ] 1.4.1 准备候选值 100 和当前值 80
  - [ ] 1.4.2 调用格式生成函数
  - [ ] 1.4.3 断言输出为 '100(+20)' #期望: ['100(+20)']

- [ ] 1.5 数字格式生成（负差值）
  - [ ] 1.5.1 准备候选值 60 和当前值 80
  - [ ] 1.5.2 调用格式生成函数
  - [ ] 1.5.3 断言输出为 '60(-20)' #期望: ['60(-20)']

- [ ] 1.6 边界情况：候选为空
  - [ ] 1.6.1 设置候选装备为 null，当前装备有值
  - [ ] 1.6.2 执行显示逻辑
  - [ ] 1.6.3 断言仅渲染当前装备数值 #期望: [currentValue]

- [ ] 1.7 边界情况：当前为空
  - [ ] 1.7.1 设置当前装备为 null，候选装备有值
  - [ ] 1.7.2 执行显示逻辑
  - [ ] 1.7.3 断言仅渲染候选装备数值 #期望: [candidateValue]

- [ ] 1.8 边界情况：两者都空隐藏面板
  - [ ] 1.8.1 设置当前装备和候选装备都为 null
  - [ ] 1.8.2 执行显示逻辑
  - [ ] 1.8.3 断言面板隐藏 #期望: [hidden]

- [ ] 1.9 边界情况：候选与当前相同不显示进度条
  - [ ] 1.9.1 设置当前装备和候选装备为相同装备
  - [ ] 1.9.2 执行显示逻辑
  - [ ] 1.9.3 断言只显示当前装备信息，不显示比较进度条 #期望: [no-progress-bar]

- [ ] 1.10 Weapon Summary 计算
  - [ ] 1.10.1 使用 weapon 类型装备调用 useEquipmentStats
  - [ ] 1.10.2 获取 summary 输出
  - [ ] 1.10.3 断言包含 burstDPS 和 range 字段 #期望: ['burstDPS', 'range']

- [ ] 1.11 Turret Summary 计算
  - [ ] 1.11.1 使用 turret 类型装备调用 useEquipmentStats
  - [ ] 1.11.2 获取 summary 输出
  - [ ] 1.11.3 断言包含 sustainedDPS 和 range 字段 #期望: ['sustainedDPS', 'range']

- [ ] 1.12 Shield Summary 计算
  - [ ] 1.12.1 使用 shield 类型装备调用 useEquipmentStats
  - [ ] 1.12.2 获取 summary 输出
  - [ ] 1.12.3 断言包含 shieldMax 和 shieldDelay 字段 #期望: ['shieldMax', 'shieldDelay']

- [ ] 1.13 Engine Summary 计算
  - [ ] 1.13.1 使用 engine 类型装备调用 useEquipmentStats
  - [ ] 1.13.2 获取 summary 输出
  - [ ] 1.13.3 断言包含 speed 和 travelSpeed #期望: ['speed', 'travelSpeed']

- [ ] 1.14 Thruster Summary 计算
  - [ ] 1.14.1 使用 thruster 类型装备调用 useEquipmentStats
  - [ ] 1.14.2 获取 summary 输出
  - [ ] 1.14.3 断言包含 strafeSpeed 和 yawRate 字段 #期望: ['strafeSpeed', 'yawRate']

- [ ] 1.15 Weapon Details 计算
  - [ ] 1.15.1 使用 weapon 类型装备调用 useEquipmentStats
  - [ ] 1.15.2 获取 details 输出
  - [ ] 1.15.3 断言包含字段：burstDPS, sustainedDPS, range, singleDamage, singleShotTime, avgShotTime, ammo, ammoReload, chargetime, timeToOverheat, cooldelay, coolTime, cycleTime #期望: [13项]

- [ ] 1.16 Turret Details 计算
  - [ ] 1.16.1 使用 turret 类型装备调用 useEquipmentStats
  - [ ] 1.16.2 获取 details 输出
  - [ ] 1.16.3 断言包含字段：burstDPS, sustainedDPS, range, singleDamage, singleShotTime, avgShotTime, ammo, ammoReload, chargetime, timeToOverheat, cooldelay, coolTime, cycleTime #期望: [13项]

- [ ] 1.17 Shield Details 计算
  - [ ] 1.17.1 使用 shield 类型装备调用 useEquipmentStats
  - [ ] 1.17.2 获取 details 输出
  - [ ] 1.17.3 断言包含字段：shieldMax, shieldRate, shieldDelay #期望: [3项]

- [ ] 1.18 Engine Details 计算
  - [ ] 1.18.1 使用 engine 类型装备调用 useEquipmentStats
  - [ ] 1.18.2 获取 details 输出
  - [ ] 1.18.3 断言包含字段：thrustForward, boostMultiplier, boostAcceleration, boostDuration, boostRecharge, travelThrust, travelAttack, travelCharge, travelSpeed, travelAcceleration, speed, acceleration, boostSpeed, boostAccel #期望: [14项]

- [ ] 1.19 Thruster Details 计算
  - [ ] 1.19.1 使用 thruster 类型装备调用 useEquipmentStats
  - [ ] 1.19.2 获取 details 输出
  - [ ] 1.19.3 断言包含字段：pitch, yaw, roll, strafe, pitchRate, yawRate, rollRate, strafeSpeed, strafeAcceleration #期望: [9项]

## 2 E2E 标准状态与状态迁移

- [✗] 2.1 状态: equipment-panel-visible-turret-picker-open
  - [✗] 2.1.1 进入船只建造视图，选择大太刀
  - [✗] 2.1.2 切换到 turret 标签
  - [✗] 2.1.3 点击 con_turret_m_01 分组打开 Picker
  - [✗] 2.1.4 点击选中某个候选装备
  - [✗] 2.1.5 断言 ShipBuildPanelEquipment 面板显示 #期望: [visible]

- [✗] 2.2 状态: equipment-panel-visible-engine-picker-open
  - [✗] 2.2.1 进入船只建造视图，选择大太刀
  - [✗] 2.2.2 点击 con_engine_01 打开 Picker
  - [✗] 2.2.3 点击选中候选引擎
  - [✗] 2.2.4 断言面板显示且显示引擎 summary #期望: [visible]

- [✗] 2.3 状态: equipment-panel-visible-shield-picker-open
  - [✗] 2.3.1 进入船只建造视图，选择大太刀
  - [✗] 2.3.2 点击 con_shield_01 打开 Picker
  - [✗] 2.3.3 点击选中候选护盾
  - [✗] 2.3.4 断言面板显示且显示护盾 summary #期望: [visible]

- [✗] 2.4 状态: equipment-panel-visible-weapon-picker-open
  - [✗] 2.4.1 进入船只建造视图，选择大太刀
  - [✗] 2.4.2 点击 con_weapon_01 打开 Picker
  - [✗] 2.4.3 点击选中候选武器
  - [✗] 2.4.4 断言面板显示且显示武器 summary #期望: [visible]

- [✗] 2.5 状态: equipment-panel-visible-thruster-picker-open
  - [✗] 2.5.1 进入船只建造视图，选择大太刀
  - [✗] 2.5.2 切换到 thruster 标签，点击某分组打开 Picker
  - [✗] 2.5.3 点击选中候选推进器
  - [✗] 2.5.4 断言面板显示且显示推进器 summary #期望: [visible]

- [✗] 2.6 状态: equipment-panel-visible-no-current-equipment
  - [✗] 2.6.1 进入船只建造视图，选择大太刀
  - [✗] 2.6.2 点击未配装的 con_weapon_01 打开 Picker
  - [✗] 2.6.3 点击选中候选装备
  - [✗] 2.6.4 断言面板显示，仅显示候选装备数值 #期望: [visible]

- [✗] 2.7 状态: equipment-panel-same-equipment-selected
  - [✗] 2.7.1 进入船只建造视图，选择大太刀，已为某槽位配装装备
  - [✗] 2.7.2 打开同一槽位的 Picker
  - [✗] 2.7.3 点击选中与当前相同的装备
  - [✗] 2.7.4 断言面板显示当前装备信息，不显示比较进度条 #期望: [no-progress-bar]

## 3 E2E 测试场景

- [✗] 3.1 Case: Picker 展开时面板显示在 Stats 上方
  - [ ] 3.1.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.1.2 检查 DOM 结构
  - [ ] 3.1.3 断言 ShipBuildPanelEquipment 在 ShipBuildPanelStats 之前渲染 #期望: [above]

- [✗] 3.2 Case: 进度条最大值等于所有候选最大值
  - [ ] 3.2.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.2.2 选中一个候选，获取面板进度条数值
  - [ ] 3.2.3 遍历其他候选并记录同一属性的最大值
  - [ ] 3.2.4 断言进度条最大刻度等于遍历结果 #期望: [max]

- [ ] 3.3 Case: 数字格式显示正差值蓝色
  - [ ] 3.3.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.3.2 点击选中一个比当前装备 DPS 高的候选
  - [ ] 3.3.3 断言数值格式为 '100(+20)' #期望: ['100(+20)']
  - [ ] 3.3.4 断言正差值显示为蓝色 #期望: [blue]

- [ ] 3.4 Case: 数字格式显示负差值粉色
  - [ ] 3.4.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.4.2 点击选中一个比当前装备 DPS 低的候选
  - [ ] 3.4.3 断言数值格式为 '80(-20)' #期望: ['80(-20)']
  - [ ] 3.4.4 断言负差值显示为粉色 #期望: [pink]

- [ ] 3.5 Case: Picker 候选卡片显示 Weapon summary
  - [ ] 3.5.1 状态: equipment-panel-visible-weapon-picker-open
  - [ ] 3.5.2 点击选中候选武器，检查卡片右侧 summary 区
  - [ ] 3.5.3 断言显示 burstDPS 和 range 两项数据 #期望: ['burstDPS', 'range']

- [ ] 3.6 Case: Picker 候选卡片显示 Turret summary
  - [ ] 3.6.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.6.2 点击选中候选炮塔，检查卡片右侧 summary 区
  - [ ] 3.6.3 断言显示 sustainedDPS 和 range 两项数据 #期望: ['sustainedDPS', 'range']

- [ ] 3.7 Case: Picker 候选卡片显示 Shield summary
  - [ ] 3.7.1 状态: equipment-panel-visible-shield-picker-open
  - [ ] 3.7.2 点击选中候选护盾，检查卡片右侧 summary 区
  - [ ] 3.7.3 断言显示 shieldMax 和 shieldDelay 两项数据 #期望: ['shieldMax', 'shieldDelay']

- [ ] 3.8 Case: Picker 候选卡片显示 Engine summary
  - [ ] 3.8.1 状态: equipment-panel-visible-engine-picker-open
  - [ ] 3.8.2 点击选中候选引擎，检查卡片右侧 summary 区
  - [ ] 3.8.3 断言显示 speed 和 travel 两项数据 #期望: ['speed', 'travel']
  - [ ] 3.8.4 断言 travel 格式为 ${speed}:${charge} #期望: ['/^\d+:\d+$/']

- [ ] 3.9 Case: Picker 候选卡片显示 Thruster summary
  - [ ] 3.9.1 状态: equipment-panel-visible-thruster-picker-open
  - [ ] 3.9.2 点击选中候选推进器，检查卡片右侧 summary 区
  - [ ] 3.9.3 断言显示 strafeSpeed 和 yawRate 两项数据 #期望: ['strafeSpeed', 'yawRate']

- [ ] 3.10 Case: Panel 显示 Weapon 完整 Details
  - [ ] 3.10.1 状态: equipment-panel-visible-weapon-picker-open
  - [ ] 3.10.2 点击选中候选武器，检查面板 details 区
  - [ ] 3.10.3 断言显示 13 项属性：burstDPS, sustainedDPS, range, singleDamage, singleShotTime, avgShotTime, ammo, ammoReload, chargetime, timeToOverheat, cooldelay, coolTime, cycleTime #期望: [13项]

- [ ] 3.11 Case: Panel 显示 Turret 完整 Details
  - [ ] 3.11.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.11.2 点击选中候选炮塔，检查面板 details 区
  - [ ] 3.11.3 断言显示 13 项属性：burstDPS, sustainedDPS, range, singleDamage, singleShotTime, avgShotTime, ammo, ammoReload, chargetime, timeToOverheat, cooldelay, coolTime, cycleTime #期望: [13项]

- [ ] 3.12 Case: Panel 显示 Shield 完整 Details
  - [ ] 3.12.1 状态: equipment-panel-visible-shield-picker-open
  - [ ] 3.12.2 点击选中候选护盾，检查面板 details 区
  - [ ] 3.12.3 断言显示 3 项属性：shieldMax, shieldRate, shieldDelay #期望: [3项]

- [ ] 3.13 Case: Panel 显示 Engine 完整 Details
  - [ ] 3.13.1 状态: equipment-panel-visible-engine-picker-open
  - [ ] 3.13.2 点击选中候选引擎，检查面板 details 区
  - [ ] 3.13.3 断言显示 14 项属性：thrustForward, boostMultiplier, boostAcceleration, boostDuration, boostRecharge, travelThrust, travelAttack, travelCharge, travelSpeed, travelAcceleration, speed, acceleration, boostSpeed, boostAccel #期望: [14项]

- [ ] 3.14 Case: Panel 显示 Thruster 完整 Details
  - [ ] 3.14.1 状态: equipment-panel-visible-thruster-picker-open
  - [ ] 3.14.2 点击选中候选推进器，检查面板 details 区
  - [ ] 3.14.3 断言显示 9 项属性：pitch, yaw, roll, strafe, pitchRate, yawRate, rollRate, strafeSpeed, strafeAcceleration #期望: [9项]

- [ ] 3.15 Case: 候选为空只显示当前装备
  - [ ] 3.15.1 状态: equipment-panel-visible-weapon-picker-open（已配装）
  - [ ] 3.15.2 点击空槽位按钮清除选中
  - [ ] 3.15.3 断言面板显示当前已装备的数值，无差值信息 #期望: [currentOnly]

- [ ] 3.16 Case: 当前为空只显示候选装备
  - [ ] 3.16.1 状态: equipment-panel-visible-no-current-equipment
  - [ ] 3.16.2 点击选中一个候选
  - [ ] 3.16.3 断言面板显示候选装备数值，无差值 #期望: [candidateOnly]

- [ ] 3.17 Case: 候选与当前相同时不显示比较进度条
  - [ ] 3.17.1 状态: equipment-panel-same-equipment-selected
  - [ ] 3.17.2 检查面板内容
  - [ ] 3.17.3 断言只显示当前装备信息，不显示比较进度条 #期望: [no-progress-bar]

- [ ] 3.18 Case: 关闭 Picker 时面板隐藏
  - [ ] 3.18.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.18.2 点击空白区域关闭 Picker
  - [ ] 3.18.3 断言 ShipBuildPanelEquipment 面板隐藏 #期望: [hidden]

- [ ] 3.19 Case: 切换选中的候选时面板数值更新
  - [ ] 3.19.1 状态: equipment-panel-visible-turret-picker-open
  - [ ] 3.19.2 选中候选 A，记录面板数值
  - [ ] 3.19.3 点击选中候选 B
  - [ ] 3.19.4 断言面板数值更新为候选 B 的信息 #期望: [updated]

- [ ] 3.20 Case: 选中候选时面板显示
  - [ ] 3.20.1 进入船只建造视图，选择大太刀，打开 Picker（未选中）
  - [ ] 3.20.2 点击选中某个候选装备
  - [ ] 3.20.3 断言面板显示 #期望: [visible]

- [ ] 3.21 Case: 切换装备类型后 summary 更新
  - [ ] 3.21.1 状态: equipment-panel-visible-weapon-picker-open，记录 Weapon summary
  - [ ] 3.21.2 切换到 turret 标签并点击选中候选炮塔
  - [ ] 3.21.3 断言 summary 区更新为 Turret 类型显示项 #期望: [updated]

## 4 Bug 测试

- [✓] 4.1 BUG-001: 点击槽位打开Picker后material未隐藏且宽度未变化
  - [✓] 4.1.1 进入船只建造视图，选择大太刀
  - [✓] 4.1.2 点击任一空槽位（如 con_weapon_01）打开 Picker
  - [✓] 4.1.3 修复前：断言 Picker 宽度为 col-span-4（未变化）#期望: ['col-span-4']
  - [✓] 4.1.3 修复后：断言 Picker 宽度为 col-span-8（已变化）#期望: ['col-span-8']
  - [✓] 4.1.4 修复前：断言 Material 面板仍显示 #期望: [visible]
  - [✓] 4.1.4 修复后：断言 Material 面板隐藏 #期望: [hidden]
