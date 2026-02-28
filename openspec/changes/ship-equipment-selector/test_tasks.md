# 测试任务：船只配装装备选择器

## 1 单元测试

- [ ] 1.1 单候选点击装备/取消
  - [ ] 步骤 1: 构造 `target.options=[{id:'weapon_gen_s_plasma_01_mk1'}]` 且 `selectedForConnectionKeys=''`，触发 `handleSlotClick(target)`
  - [ ] 步骤 2: 构造同一 target 且 `selectedForConnectionKeys='weapon_gen_s_plasma_01_mk1'`，再次触发 `handleSlotClick(target)`
  - [ ] 步骤 3: 期望首次 emit `assign-connection(equipmentId='weapon_gen_s_plasma_01_mk1')`，二次 emit `assign-connection(equipmentId=null)`，expect(emits).toContainEqual(['assign-connection', { connectionKey: 'ship_ter_l_destroyer_01_a::weapon::3::0', equipmentId: null }])

- [ ] 1.2 展开态允许 group 切换
  - [ ] 步骤 1: 令 `expandedSlotKey` 有值且 `props.canSwitchToGroup=false`
  - [ ] 步骤 2: 读取 `canSwitchToGroupInCurrentState`
  - [ ] 步骤 3: 期望可切换 group，expect(canSwitchToGroupInCurrentState.value).toEqual(true)

- [ ] 1.3 关闭 picker 时 group 回退 connection
  - [ ] 步骤 1: 设置 `props.mode='group'` 且 `props.canSwitchToGroup=false`
  - [ ] 步骤 2: 调用 `closePicker()`
  - [ ] 步骤 3: 期望触发模式回退事件，expect(emits).toContainEqual(['update:mode', 'connection'])

- [ ] 1.4 Tag 来源为预置集合且走 i18n
  - [ ] 步骤 1: 设置 `availableTagIds` 包含 `standard/mining`，计算 `featureTags`
  - [ ] 步骤 2: 检查 `featureTags` 仅来自 `tagDefs`，并使用 `translateSlotTag` 结果作为 label
  - [ ] 步骤 3: 期望不在预置集合内的 tag 不出现，expect(featureTags.value.map(v => v.id)).toEqual(['standard', 'mining'])

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: osaka-selected
  - [ ] 步骤 1: 进入 ship-build 页面，若显示已选飞船卡片则点击“更换飞船”返回列表
  - [ ] 步骤 2: 在 `ship-build-filter-class` 选择 `L`，在 `ship-build-filter-race` 选择 `terran`
  - [ ] 步骤 3: 在 `ship-build-list` 点击 `Osaka/大阪`（`ship_ter_l_destroyer_01_a`）
  - [ ] 步骤 4: 读取 store 的 `selectedShipId`
  - [ ] 步骤 5: 期望 `selectedShipId` 为大阪 ID，expect(selectedShipId).toEqual('ship_ter_l_destroyer_01_a')

- [ ] 2.2 状态: osaka-picker-open-turret-4-3
  - [ ] 步骤 1: 基于 `osaka-selected` 点击槽位 `slot-ship_ter_l_destroyer_01_a::turret::4::3`
  - [ ] 步骤 2: 观察 `equipment-picker` 面板可见
  - [ ] 步骤 3: 检查第一行模式按钮与确认取消、第二行槽位签与分页可见
  - [ ] 步骤 4: 期望 picker 展开且 materials 面板隐藏，expect(pickerVisible && materialHidden).toEqual(true)

- [ ] 2.3 切换: osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped
  - [ ] 步骤 1: 基于 `osaka-picker-open-turret-4-3` 点击 `简化` 切换到 group
  - [ ] 步骤 2: 观察 picker 未关闭，且当前槽位映射到包含原 `connectionKeys` 的 group 目标
  - [ ] 步骤 3: 期望展开状态保持且过滤候选已按新目标刷新，expect(pickerStillOpen && mappedByConnectionKeys && filtersRefreshed).toEqual(true)

## 3 E2E 测试场景

- [ ] 3.1 Case: 候选=1 槽位点击装备与取消
  - [ ] 前提: 状态 osaka-selected
  - [ ] 步骤 1: 点击 `slot-ship_ter_l_destroyer_01_a::weapon::3::0`
  - [ ] 步骤 2: 读取该槽位已选装备 ID
  - [ ] 步骤 3: 再次点击 `slot-ship_ter_l_destroyer_01_a::weapon::3::0`
  - [ ] 步骤 4: 期望首次为唯一候选、二次为空槽，expect([firstSelectedId, secondSelectedId]).toEqual(['weapon_gen_l_beam_01_mk1', null])

- [ ] 3.2 Case: 候选>1 展开后三行布局与前两行高度
  - [ ] 前提: 状态 osaka-selected
  - [ ] 步骤 1: 点击 `slot-ship_ter_l_destroyer_01_a::turret::4::3` 展开 picker
  - [ ] 步骤 2: 检查第一行左侧 `标准/简化`、右侧 `确定/取消`；第二行左侧槽位签、右侧分页
  - [ ] 步骤 3: 检查第三行左侧为 `filter-block + slot-wall`，右侧为候选列表
  - [ ] 步骤 4: 期望第一二行高度均为 `25.6px` 且布局成立，expect(layoutRow12HeightPx).toEqual([25.6, 25.6])

- [ ] 3.3 Case: 展开态 group 切换保持展开并跳转到对应槽位
  - [ ] 前提: 状态 osaka-picker-open-turret-4-3
  - [ ] 步骤 1: 点击 `简化` 切换 group
  - [ ] 步骤 2: 读取当前展开槽位 key 与候选列表首项
  - [ ] 步骤 3: 切换另一个 group tab
  - [ ] 步骤 4: 期望 picker 保持展开且展开槽位按锚点重映射并刷新候选，expect(pickerOpenAfterSwitch && mappedAfterTabSwitch && candidateListUpdated).toEqual(true)

- [ ] 3.4 Case: 展开态点击 slot.type 关闭 picker
  - [ ] 前提: 状态 osaka-picker-open-turret-4-3
  - [ ] 步骤 1: 点击左侧 slot.type `W`
  - [ ] 步骤 2: 读取 picker 显隐与材料面板显隐
  - [ ] 步骤 3: 期望 picker 关闭且材料面板恢复，expect([pickerVisible, materialVisible]).toEqual([false, true])

- [ ] 3.5 Case: 关闭 picker 时 group 冲突自动回退 connection
  - [ ] 前提: 切换 osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped
  - [ ] 步骤 1: 在当前 ship 装备组合制造 `canSwitchToGroup=false` 的冲突状态
  - [ ] 步骤 2: 点击 `picker-cancel` 关闭 picker
  - [ ] 步骤 3: 读取当前 `fitMode`
  - [ ] 步骤 4: 期望关闭后自动回退到 connection，expect(fitMode).toEqual('connection')

## 4 Bug 测试

- [ ] 4.1 Bug: 展开态简化模式点击无效
  - [ ] 步骤 1: 基于 `osaka-picker-open-turret-4-3` 记录初始 `fitMode='connection'`
  - [ ] 步骤 2: 点击 `简化` 按钮
  - [ ] 步骤 3: 读取 `fitMode` 与 picker 显隐
  - [ ] 步骤 4: 期望 `fitMode='group'` 且 picker 仍展开，expect([fitMode, pickerVisible]).toEqual(['group', true])

## 5 失败原因及可能的推断
