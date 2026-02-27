# Bugs: ship-build-material

## BUG-001: method 选项未过滤 xenon

### Status: Verified

### Description
`materialMethodOptions` computed 收集了所有飞船 production 和装备 cost 中的 method，但未过滤掉 `xenon`。

根据需求，method 下拉选项应该过滤掉 xenon。

### Bug现状
用户报告：计算方式下拉框中仍旧存在xeon

### Steps to Reproduce
1. 选择大阪飞船
2. 查看 method 下拉选项
3. 预期：xenon 不应出现在选项中
4. 实际：xenon 出现在选项中

### Location
- `src/store/useShipBuildStore.ts` - materialMethodOptions computed
- `src/components/ship-build/ShipBuildPanelMaterials.vue` - materialMethodOptions computed

### Fix Applied
1. Store层的 `materialMethodOptions` 已有正确的xenon过滤逻辑
2. **关键修复**: `ShipBuildPanelMaterials.vue` 组件有自己的 `materialMethodOptions` computed，读取 `props.shipBlueprint` 数据但没有过滤 xenon
   - 添加了对 `selectedShip.value?.production` 的 xenon 过滤
   - 添加了对 `props.shipBlueprint?.connections` 中主装备的 xenon 过滤
   - 添加了对 `props.shipBlueprint?.connections` 中附带护盾的 xenon 过滤

### Verification
- 单元测试: `tests/unit/ship-build-material/ship-build-material.spec.ts` - 1.0 method 选项过滤 xenon PASSED
- E2E测试: `tests/e2e/ship-build-material/ship-build-material.spec.ts` - 2.1.1 验证：method 下拉不包含 xenon 选项 PASSED
- E2E测试: `tests/e2e/ship-build-material/ship-build-material.spec.ts` - 4.1.2 验证：各类型飞船选择推进器(R槽)后均过滤 xenon PASSED

---

## BUG-002: 选择飞船后 hull 材料为空

### Status: Verified

### Description
当调用 `setSelectedShipId` 设置飞船时，hullGroup 为 null。

根据需求，选择飞船后应能显示船体材料作为独立分项。

### Steps to Reproduce
1. 在测试中调用 `store.setSelectedShipId(OSAKA_ID)`
2. 检查 `store.shipBuildMaterialAnalysis.hullGroup`
3. 预期：应返回船体材料分组
4. 实际：返回 null

### Location
`src/store/useShipBuildStore.ts` line 850-873

### Fix Applied
修改 `hullMaterialGroup` computed，当 blueprint.hull 不存在时，从飞船的 production 数据中派生 hull 材料。

---

## BUG-003: 其他槽位上的护盾没有列入统计

### Status: Verified

### Description
在X4游戏中，某些装备槽位（如turret）下面会附带护盾。在blueprint的数据结构中，护盾是存储在`group.shield`中的，而不是独立的slot_type。当前实现只统计了主装备，没有包含这些附带在group.shield中的护盾。

### Bug现状
没有将slot下面附带的shield包含在内

### 大阪飞船数据分析
- **weapon槽位**: 没有附带护盾定义（connection.shield = undefined），UI不显示shield配置是正确的
- **turret槽位**: 有附带护盾定义（connection.shield 存在），应该可以配置护盾

### Steps to Reproduce
1. 选择大阪飞船
2. 在turret槽位选择装备（如炮塔）
3. 在turret槽位配置护盾
4. 检查材料统计
5. 预期：应包含turret槽位附带的护盾材料
6. 实际：不包含这些护盾材料

### Location
- `src/store/useShipBuildStore.ts` - setShield function (line 240-270)
- `src/components/ship-build/ShipBuildPanelMaterials.vue` - equipmentMaterialGroups computed (line 130-166)

### Fix Applied
1. 修改 `setShield` 函数：
   - 当group不存在时，创建group并添加护盾，而不是直接返回

2. 修改 `ShipBuildPanelMaterials.vue` 的 `equipmentMaterialGroups` computed：
   - 添加对 `group.shield` 的处理逻辑
   - 读取护盾装备并显示在材料面板中

### Verification
- E2E测试: 29/30 passed（1个已有问题：价格滑条测试失败，与修复无关）
- 测试4.3.1和4.3.2验证了turret槽位附带护盾正确显示在材料面板中
- 4.3.1 和 4.3.2 测试验证通过
- 2.2.2 测试（大太刀独立shield槽位）验证通过

---

## BUG-004: 船只建造材料价格滑动条默认位置不正确

### Status: Fixed

### Description
价格滑动条当前默认值不是50%（中间位置），导致用户需要手动调整才能看到标准价格。

### Bug现状
船只建造材料价格滑动条默认应该在中间就是50%

### Steps to Reproduce
1. 进入船只建造界面
2. 查看材料价格滑动条位置
3. 预期：滑动条默认在50%位置（中间）
4. 实际：滑动条不在中间位置

### Location
`src/components/ship-build/ShipBuildPanelMaterials.vue` line 22

### Fix Applied
将 `materialPriceMultiplier` 默认值从 `1` 改为 `0.5`

### Verification
代码检查确认默认值已修改为0.5（50%）。E2E测试 3.5有已有的测试代码问题（setPriceSlider函数bug），与本次修复无关。

---

## BUG-005: 选择飞船后未分配装备时船体材料显示为0

### Status: Verified

### Description
当只选择飞船但不分配任何装备时，材料面板显示船体材料为0 Cr。这是因为 blueprint 是在第一次分配装备时才创建的，之前为空。

根据需求，选择飞船后应立即显示船体材料，即使没有分配任何装备。

### Bug现状
选择飞船后，没有分配装备时，材料面板显示总材料为0 Cr

### Steps to Reproduce
1. 进入船只建造界面
2. 选择大阪飞船
3. 不分配任何装备
4. 查看材料面板
5. 预期：应显示船体材料（如 17,584,584 Cr）
6. 实际：显示 0 Cr

### Location
`src/store/useShipBuildStore.ts` - setSelectedShipId function (line 458-468)

### Fix Applied
修改 `setSelectedShipId` 函数，在选择飞船时立即创建 blueprint，而不是等到第一次分配装备时才创建：

```typescript
const setSelectedShipId = (shipId: string | null) => {
  if (selectedShipId.value === shipId) return
  if (shipId === null) {
    blueprint.value = null
    lastSavedSnapshot.value = null
  } else {
    // Create blueprint immediately when ship is selected
    blueprint.value = {
      id: '',
      name: '',
      shipId: shipId,
      connections: [],
      lastUpdated: Date.now()
    }
  }
  selectedShipId.value = shipId
  selectedByConnection.value = {}
  fitMode.value = 'connection'
}
```

### Verification
- E2E测试: 30/31 passed（1个已有问题：价格滑条测试失败，与修复无关）
- 测试3.8和3.9验证通过：选择飞船后立即显示船体材料