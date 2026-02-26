# Test Tasks: ship-build-storage

## 0. 执行结果

- [ ] 已创建并执行本 change 专属测试目录：
  - [ ] `tests/unit/ship-build-storage/ship-build-storage.spec.ts`
  - [ ] `tests/e2e/ship-build-storage/ship-build-storage.spec.ts`

## 1. Unit Tests（Vitest）

### 1.1 数据结构类型

- [ ] 1.1.1 ShipBlueprintGroup 字段完整性
  - 步骤 1：构造包含 group, equipment_id, count, shield 的 ShipBlueprintGroup。
  - 步骤 2：验证各字段类型正确。

- [ ] 1.1.2 ShipBlueprintConnection 字段完整性
  - 步骤 1：构造包含 slot_type, group[] 的 ShipBlueprintConnection。
  - 步骤 2：验证字段类型正确。

- [ ] 1.1.3 selectedByConnection computed 格式
  - 步骤 1：构造包含 blueprint 的 store 状态。
  - 步骤 2：验证 selectedByConnection 输出格式为 Record<string, { equipmentId, count }>。

### 1.2 setEquipment 方法

- [ ] 1.2.1 设置新装备
  - 步骤 1：初始化空 blueprint。
  - 步骤 2：调用 setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)。
  - 步骤 3：断言 blueprint.connections 包含对应条目。

- [ ] 1.2.2 更新已有装备
  - 步骤 1：blueprint 已有装备配置。
  - 步骤 2：调用 setEquipment 更换装备 ID 或数量。
  - 步骤 3：断言 blueprint 中对应条目已更新。

- [ ] 1.2.3 取消装备（equipmentId = null）
  - 步骤 1：blueprint 已有装备配置。
  - 步骤 2：调用 setEquipment('engine', 'group_back_up_mid', null, 0)。
  - 步骤 3：断言该 group 条目已从 blueprint 中删除，不是保留为 null。

### 1.3 setShield 方法

- [ ] 1.3.1 设置盾位装备
  - 步骤 1：blueprint 已有主槽位装备。
  - 步骤 2：调用 setShield('engine', 'group_back_up_mid', 'shield_gen_m', 1)。
  - 步骤 3：断言对应 group 的 shield 字段已设置。

- [ ] 1.3.2 取消盾位装备
  - 步骤 1：blueprint 已有盾位配置。
  - 步骤 2：调用 setShield('engine', 'group_back_up_mid', null, 0)。
  - 步骤 3：断言 shield 字段已从 group 中删除。

### 1.4 setGroupEquipment 批量修改

- [ ] 1.4.1 批量设置装备
  - 步骤 1：blueprint 包含多个同 group 的 connection。
  - 步骤 2：调用 setGroupEquipment。
  - 步骤 3：断言全部 connection 都更新为同一装备。

### 1.5 selectedByConnection computed

- [ ] 1.5.1 从 blueprint 计算 selectedByConnection
  - 步骤 1：构造包含多个 slot_type 和 group 的 blueprint。
  - 步骤 2：验证 selectedByConnection 包含正确的 connectionKey 映射。

- [ ] 1.5.2 无装备时返回 null
  - 步骤 1：blueprint 中某 group 无装备（条目不存在）。
  - 步骤 2：验证 selectedByConnection 对应 key 的 equipmentId 为 null。

### 1.6 持久化 CRUD

- [ ] 1.6.1 saveBlueprint 更新现有
  - 步骤 1：load 已有 blueprint，修改装备。
  - 步骤 2：调用 saveBlueprint。
  - 步骤 3：验证 localStorage 中对应 blueprint 已更新。

- [ ] 1.6.2 saveAsBlueprint 创建新 blueprint
  - 步骤 1：当前有 active blueprint。
  - 步骤 2：调用 saveAsBlueprint('New Name')。
  - 步骤 3：验证 localStorage 中新增一条 blueprint，activeId 指向新 blueprint。

- [ ] 1.6.3 deleteBlueprint 删除
  - 步骤 1：localStorage 中有多条 blueprint。
  - 步骤 2：调用 deleteBlueprint 删除其中一条。
  - 步骤 3：验证 localStorage 中该 blueprint 已删除。

- [ ] 1.6.4 loadBlueprint 自动设置筛选
  - 步骤 1：构造特定 shipId 的 blueprint。
  - 步骤 2：调用 loadBlueprint。
  - 步骤 3：验证 selectedClass/selectedRaces/selectedTypes/selectedShipId 已自动设置。

### 1.7 Dirty State

- [ ] 1.7.1 修改后 isDirty = true
  - 步骤 1：load 已有 blueprint。
  - 步骤 2：调用 setEquipment 修改装备。
  - 步骤 3：验证 isDirty 为 true。

- [ ] 1.7.2 保存后 isDirty = false
  - 步骤 1：修改后 isDirty 为 true。
  - 步骤 2：调用 saveBlueprint。
  - 步骤 3：验证 isDirty 为 false。

## 2. Bootstrapping & State（E2E）

- [ ] 2.1 状态：持久化-初始状态
  - 步骤 1：启动应用并切换到“船只建造”视图。
  - 步骤 2：清除 localStorage 中的 `x4_ship_blueprints`。
  - 步骤 3：断言 New/Save/Save As/Load 按钮可用。

- [ ] 2.2 状态：持久化-已选飞船（进入配装区）
  - 步骤 1：启动应用并切换到“船只建造”视图。
  - 步骤 2：若当前已在“船只建造”且已选中其他飞船，先点击“更换飞船”返回选船列表。
  - 步骤 3：`class` 选择 `M`，`race` 选择 `terran`，`type` 选择“轻型护卫舰”。
  - 步骤 4：在结果列表选择“大太刀”。
  - 步骤 5：断言进入配装区，且可见引擎/护盾/武器/炮塔四类配装区块。

- [ ] 2.3 状态：持久化-已配置装备
  - 步骤 1：进入“状态：持久化-已选飞船（进入配装区）”。
  - 步骤 2：点击左侧 `slotType` 的 `engine` 标签。
  - 步骤 3：选择 `group_back_up_mid` 分组，在候选列表选择任意引擎装备。
  - 步骤 4：切换到 `shield` 标签，选择 `con_shield_01` 分组，配置护盾装备。
  - 步骤 5：断言已配置装备的区块显示已选装备。

- [ ] 2.4 状态：持久化-已保存 Blueprint
  - 步骤 1：进入“状态：持久化-已配置装备”。
  - 步骤 2：点击工具栏 Save 按钮。
  - 步骤 3：验证 localStorage 包含 `x4_ship_blueprints` key。
  - 步骤 4：验证 `shipBuildStore.activeBlueprintId` 有值且 `isDirty = false`。

- [ ] 2.5 状态：持久化-已另存为新 Blueprint
  - 步骤 1：进入“状态：持久化-已保存 Blueprint”。
  - 步骤 2：修改装备配置（如更换引擎）。
  - 步骤 3：点击 Save As 按钮。
  - 步骤 4：在弹窗输入框输入“测试 blueprint 2”并确认。
  - 步骤 5：验证 localStorage 包含 2 条 blueprint，新名称的为 active。

- [ ] 2.6 状态：持久化-有未保存修改
  - 步骤 1：进入“状态：持久化-已保存 Blueprint”。
  - 步骤 2：修改装备配置（如更换护盾）。
  - 步骤 3：验证 `shipBuildStore.isDirty = true`。

## 3. Scenario Content（E2E）

- [ ] 3.1 场景：保存飞船配装
  - 步骤 1：进入“状态：持久化-已选飞船（进入配装区）”。
  - 步骤 2：点击左侧 `slotType` 的 `engine` 标签。
  - 步骤 3：选择 `group_back_up_mid` 分组，在候选列表选择 `engine_am`。
  - 步骤 4：切换到 `shield` 标签，选择 `con_shield_01`，选择 `shield_gen_m`。
  - 步骤 5：点击工具栏 Save 按钮。
  - 步骤 6：断言 localStorage 包含 blueprint 数据，shipId 为“大太刀”的 ID，connections 包含 engine 和 shield 配置。

- [ ] 3.2 场景：另存为新 blueprint
  - 步骤 1：进入“状态：持久化-已保存 Blueprint”。
  - 步骤 2：切换到 `weapon` 标签，修改武器装备。
  - 步骤 3：点击 Save As 按钮。
  - 步骤 4：在弹窗输入“另存为测试”并确认。
  - 步骤 5：断言 localStorage 包含 2 条 blueprint，新 blueprint name 为“另存为测试”。

- [ ] 3.3 场景：载入 blueprint 并自动设置筛选条件
  - 步骤 1：localStorage 已包含多条 blueprint（如大太刀和大阪的配装）。
  - 步骤 2：进入飞船建造视图，当前无选中飞船。
  - 步骤 3：点击 Load 按钮。
  - 步骤 4：在弹窗列表选择“大太刀”的 blueprint。
  - 步骤 5：断言已自动选中“大太刀”飞船。
  - 步骤 6：断言筛选区 class=M, race=terran, type=轻型护卫舰 已自动选中。
  - 步骤 7：断言配装区显示之前保存的 engine 和 shield 装备。

- [ ] 3.4 场景：载入 blueprint 恢复装备配装
  - 步骤 1：进入“状态：持久化-已配置装备”并保存。
  - 步骤 2：点击“更换飞船”返回选船列表，重新选择其他飞船（如大阪）后再返回。
  - 步骤 3：点击 Load 按钮，选择大太刀的 blueprint。
  - 步骤 4：断言配装区恢复之前保存的 engine 和 shield 装备配置。

- [ ] 3.5 场景：删除 blueprint
  - 步骤 1：localStorage 包含多条 blueprint。
  - 步骤 2：点击 Load 按钮。
  - 步骤 3：在弹窗列表找到目标 blueprint，点击删除按钮。
  - 步骤 4：确认删除。
  - 步骤 5：断言该 blueprint 已从列表中移除。
  - 步骤 6：断言 localStorage 中已删除。

- [ ] 3.6 场景：取消装备从 blueprint 删除（非 null）
  - 步骤 1：进入“状态：持久化-已保存 Blueprint”（已配置 engine 和 shield）。
  - 步骤 2：点击 `engine` 标签，将 `group_back_up_mid` 的装备选择为空。
  - 步骤 3：保存 blueprint。
  - 步骤 4：重新载入该 blueprint。
  - 步骤 5：断言 engine 配置已清除（对应 group 条目不存在于 blueprint 中）。

- [ ] 3.7 场景：修改后 New 提示未保存
  - 步骤 1：进入“状态：持久化-已保存 Blueprint”。
  - 步骤 2：修改装备配置，使 `isDirty = true`。
  - 步骤 3：点击 New 按钮。
  - 步骤 4：断言弹出未保存确认对话框。

- [ ] 3.8 场景：切换视图提示未保存
  - 步骤 1：进入“状态：持久化-已保存 Blueprint”。
  - 步骤 2：修改装备配置，使 `isDirty = true`。
  - 步骤 3：点击顶部视图切换（如切换到“生产”视图）。
  - 步骤 4：断言弹出未保存确认对话框。

- [ ] 3.9 场景：保存后清除 dirty 状态
  - 步骤 1：进入“状态：持久化-已保存 Blueprint”。
  - 步骤 2：修改装备配置，断言 `isDirty = true`。
  - 步骤 3：点击 Save 按钮。
  - 步骤 4：断言 `isDirty = false`。

- [ ] 3.10 场景：简略模式批量修改后保存
  - 步骤 1：进入”状态：持久化-已选飞船（进入配装区）”。
  - 步骤 2：切换到简略模式。
  - 步骤 3：在 `M` 分组选择统一引擎装备。
  - 步骤 4：保存 blueprint。
  - 步骤 5：重新载入，断言所有同组 connection 都配置了同一装备。

- [ ] 3.11 Bug修复验证 BUG-SBS-001（点击shield标签切换时无反应）
  - 步骤 1：进入ship-build，选择一艘飞船进入配装区。
  - 步骤 2：点击”S”（shield）标签切换到护盾槽位。
  - 步骤 3：观察group tabs区域是否有shield相关的分组。
  - 步骤 4：点击第一个shield group。
  - 步骤 5：观察option cards是否显示护盾装备选项。
  - 步骤 6：点击第一个护盾装备选项。
  - 步骤 7：断言选中数量从0/1变为1/1（高亮显示）。

## 4. State & Transition

### 状态列表
- `状态：持久化-初始状态` - 无 blueprint 存在
- `状态：持久化-已选飞船（进入配装区）` - 已选择飞船但未保存
- `状态：持久化-已配置装备` - 已选择飞船并配置装备但未保存
- `状态：持久化-已保存 Blueprint` - 已保存 blueprint，isDirty=false
- `状态：持久化-已另存为新 Blueprint` - 已另存为新 blueprint
- `状态：持久化-有未保存修改` - 已保存过但有未保存修改

### 状态切换
- `切换：持久化-初始状态->持久化-已选飞船` - 选择飞船
- `切换：持久化-已选飞船->持久化-已配置装备` - 配置装备
- `切换：持久化-已配置装备->持久化-已保存 Blueprint` - saveBlueprint
- `切换：持久化-已保存 Blueprint->持久化-已另存为新 Blueprint` - saveAsBlueprint
- `切换：持久化-已保存 Blueprint->持久化-有未保存修改` - setEquipment/setShield
- `切换：持久化-有未保存修改->持久化-已保存 Blueprint` - saveBlueprint
- `切换：持久化-有未保存修改->持久化-初始状态` - New 确认清空
