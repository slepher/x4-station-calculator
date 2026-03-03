# Tasks: build-ship-equipment-panel

## 1. 类型定义

- [x] 1.1 确认 `EngineSummary` 类型已修改为 `speed: number, travelSpeed: number`（在 `useEquipmentStats.ts` 中）
- [x] 1.2 确认各装备类型的 Summary 类型定义正确

## 2. 组件创建

- [x] 2.1 创建 `ShipBuildPanelEquipment.vue` 组件文件
- [x] 2.2 在 `ShipBuildView.vue` 中引入并放置在 `ShipBuildPanelStats` 上方

## 3. 数据获取

- [x] 3.1 从 `ShipBuildPanelFit` 获取 Picker 状态（展开/收起）
- [x] 3.2 从 `pickerTarget.connectionKeys` 获取当前已装备的 `equipment_id`
- [x] 3.3 从 `highlightedEquipmentId` 获取候选装备 ID
- [x] 3.4 使用 `useEquipmentStats` composable 获取装备详细数据

## 4. 叠加显示（进度条）

- [x] 4.1 计算所有候选装备各项数值的最大值
- [x] 4.2 渲染进度条，当前值显示为基准刻度
- [x] 4.3 渲染候选值，基于差值显示蓝色或粉色
- [x] 4.4 数字格式：`候选值(+正数|-负数)`

## 5. Picker 候选 Summary 显示

- [x] 5.1 Picker 卡片根据装备类型渲染对应的 summary 信息（2 项关键数据）
- [x] 5.2 Weapon: burstDPS, range
- [x] 5.3 Turret: sustainedDPS, range
- [x] 5.4 Shield: shieldMax, shieldDelay
- [x] 5.5 Engine: speed, travelSpeed
- [x] 5.6 Thruster: strafeSpeed, yawRate

## 6. Panel Details 显示（对比面板）

- [x] 6.1 Panel 根据装备类型渲染对应的 details 信息（完整属性列表）
- [x] 6.2 Weapon/Turret: burstDPS, sustainedDPS, range, singleDamage, singleShotTime, avgShotTime, ammo, ammoReload, chargetime, timeToOverheat, cooldelay, coolTime, cycleTime
- [x] 6.3 Shield: shieldMax, shieldRate, shieldDelay
- [x] 6.4 Engine: thrustForward, speed, acceleration, boostMultiplier, boostSpeed, boostAccel, boostDuration, boostRecharge, travelThrust, travelSpeed, travelCharge, travelAcceleration, travelAttack, boostAcceleration
- [x] 6.5 Thruster: pitch, yaw, roll, strafe, pitchRate, yawRate, rollRate, strafeSpeed, strafeAcceleration

## 7. 布局要求

- [x] 7.1 Header 直接显示候选装备名称（无前缀）
- [x] 7.2 内容区使用两列布局 (`grid-cols-2`)
- [x] 7.3 样式与 ShipBuildPanelStats 一致
- [x] 7.4 不显示 Summary 区块
- [x] 7.5 ShipBuildView 布局：展开前 1:1:1，展开后 2:1（右边上下的 flex-col）

## 8. 显示/隐藏逻辑

- [x] 8.1 Picker 展开时显示面板
- [x] 8.2 Picker 收起时隐藏面板
- [x] 8.3 当前装备和候选装备都为空时隐藏面板

## 9. 集成测试

- [ ] 9.1 在 Picker 展开时验证面板显示
- [ ] 9.2 在 Picker 收起时验证面板隐藏
- [ ] 9.3 验证 Panel Header 显示候选装备名称
- [ ] 9.4 验证 Panel 内容区为两列布局
- [ ] 9.5 验证 Picker 候选卡片显示 summary 信息（两列布局：左边装备信息，右边 Label Value Unit）
- [ ] 9.6 验证布局比例：展开前 1:1:1，展开后 2:1

## 10. 构建验证

- [x] 10.1 运行 `npm run build` 确认无编译错误

## 11. 待完成任务

- [x] 11.1 Equipment 面板 labels 添加 i18n（当前使用硬编码中文）
- [x] 11.2 Picker 候选卡片添加 summary 显示（2 项关键数据）

## 12. 第3节"叠加显示"未实现

- [ ] 12.1 显示候选值与当前值的对比
- [ ] 12.2 数字格式：`候选值(+正数|-负数)`，如 `100(+20|-10)`
- [ ] 12.3 颜色标识：蓝色表示正差值（候选 > 当前），粉色表示负差值（候选 < 当前）
- [ ] 12.4 进度条同时显示候选值和当前值

## 13. 已完成确认

- [x] 13.1 布局修复：使用 grid 布局与 Stats 保持一致
- [x] 13.2 间距修复：Equipment 与 Stats 之间 gap-4
- [x] 13.3 装备名称 i18n：使用 translateEquipment()
- [x] 13.4 单位显示：与 Stats 风格一致
- [x] 13.5 进度条：数值都为0时显示空条
- [x] 13.6 字段补充：Engine 补充 4 项缺失字段 (boostDuration, boostRecharge, travelAttack, boostAcceleration)，Weapon 补充 1 项 (singleShotTime)
- [x] 13.7 i18n 更新：所有 label 添加 labelKey，使用 t() 翻译
- [x] 13.8 EngineSummary 接口修改：`speed: number, travelSpeed: number`（替代原 `travel: string`）
- [x] 13.9 Picker 候选卡片两列布局：左边装备信息（名称+tag），右边 Summary（Label Value Unit 格式）
- [x] 13.10 Summary Label/Value/Unit 颜色字体与 PanelEquipment 一致：
  - Label: `text-xs text-slate-300`
  - Value: `text-xs text-emerald-300 tabular-nums`
  - Unit: `text-[10px] text-slate-400`
- [x] 13.11 i18n 与 Stats 统一（除 burst_dps/sustained_dps 保持较短形式外，其他字段使用 Stats i18n）
