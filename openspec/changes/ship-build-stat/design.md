## Context

当前“船只建造”中列属性区需要承接两类信息密度：快速浏览（简略）与完整观察（详细）。
你提供的两张截图已经定义了这两个档位的目标字段集合：截图 2 对应简略、截图 1 对应详细。
项目内已有 XML 抽取产物（`ships.json`、`equipments.json`）可覆盖部分详细字段，但武器/炮塔精确输出仍缺少弹体层参数。

## Decisions

1. **双档位模型**：中列属性区采用 `summary/detail` 两态切换，默认 `summary`。
2. **字段矩阵对齐**：
   - `summary` 字段矩阵对齐截图 2；
   - `detail` 字段矩阵对齐截图 1；
   - `detail` 必须覆盖 `summary`。
3. **分层数据策略**：
   - 船体基础（`hull/crew/storage/physics/slots`）来自 `ships.json`；
   - 装备参数（`engine/shield` 统计项）来自 `equipments.json`；
   - 优先显示可计算真实值，无法计算字段才占位。
4. **高度自适应**：中列属性容器与已选详情容器取消固定高度，避免字段增加时信息被裁切。
5. **可测试设计**：为属性区和两档位按钮提供独立 `data-testid`，保证回归可定位。
6. **i18n 先行**：档位名称、待接入提示与新增字段标签先加入 locale 键，减少后续改动面。
7. **样本回归锚点**：将 Heron Vanguard（`ship_tel_l_trans_container_02_a`）作为数据链路验证样本，确保字段来源可追溯。

## Data Mapping (Key Fields)

- `船体(MJ)`：`ship.hull`
- `船员`：`ship.crew.capacity`
- `单位/导弹`：`ship.storage.unit` / `ship.storage.missile`
- `雷达范围(km)`：`ship.radarRange`
- `可投放设备`：`ship.storage.deployable`
- `干扰弹`：`ship.storage.countermeasure`
- `M/S 泊位数量、M/S 飞船容量`：由 `ship.slots` 中对应连接点统计
- **`护盾(MJ)`：从 `blueprint.connections` 中查找 `slot_type='shield'` 的已装备设备，聚合 `shield.stats.recharge.max`**
- **`再充率/再充延迟`：从 `blueprint.connections` 中查找 `slot_type='shield'` 的已装备设备，聚合 `shield.stats.recharge.rate/delay`**
- **`速度/助推/巡航`：从 `blueprint.connections` 中查找 `slot_type='engine'` 的已装备设备，基于 `ship.physics` 与 `engine.stats.thrust/boost/travel` 计算**
- **`武器爆发输出值(MW)`**：从 `blueprint.connections` 获取已装备设备，根据 `equipment.class` 决定弹药：
  - `class=weapon` → `equipment.bullet` → `bullets.json` → `damage * count`
  - `class=missilelauncher` → `equipment.bullet` → `missiles.json` → `explosive * count`
- **`武器持续输出值(MW)`**：同上，根据 `equipment.class`：
  - `class=weapon` → `damage / reload * count`
  - `class=missilelauncher` → `explosive / reload * count`
- **`炮塔平均输出值(MW)`**：从 `blueprint.connections` 获取已装备设备，根据 `equipment.class`：
  - `class=turret` → `bullets.json` → `damage / reload`
  - `class=missileturret` → `missiles.json` → `explosive / reload`
- **注**：根据 equipment.class 决定使用 bullets.json 还是 missiles.json

### 数据源架构

```
blueprint.connections (数据源)
    │
    ├── slot_type: "shield"
    │     └── group[]
    │           ├── equipment_id → equipments.json → stats.recharge
    │           └── shield { equipment_id, count }
    │
    ├── slot_type: "engine"
    │     └── group[]
    │           └── equipment_id → equipments.json → stats.thrust/boost/travel
    │
    └── 武器/炮台/导弹发射器（根据 equipment.class 决定弹药）
          │
          ├── equipment.class = "weapon" → bullet → bullets.json → damage
          ├── equipment.class = "turret"  → bullet → bullets.json → damage
          ├── equipment.class = "missilelauncher" → bullet → missiles.json → explosive
          └── equipment.class = "missileturret" → bullet → missiles.json → explosive

（不再使用 selectedByConnection ref 计算属性）
```

## Non-Goals

- 本 change 不补充新的原始弹体资产包。
- 本 change 使用 `damage / reload` 近似 DPS，精确公式待后续校准。

## Risks

- 速度链路存在口径差异风险（游戏内显示值与公式结果可能需校准系数）。
- 武器/炮塔输出使用 `damage / reload` 近似 DPS，与游戏内显示值可能有偏差。
- 取消固定高度后，极端字段数量下需要关注小屏阅读性（可后续再加折叠策略）。

---

## 实现方案

### 5.1 修正占位字段（tasks 5.1-5.3）

修改 `ShipBuildView.vue` 中 `buildSummaryStats()` 和 `buildDetailStats()` 函数：

```typescript
// 当前代码
{ key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', value: 0 } // 改为
{ key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', value: ship.radarRange || 0 }

// 当前代码
{ key: 'deployable', labelKey: 'ship_build.stats_deployable', unit: '', value: 0 } // 改为
{ key: 'deployable', labelKey: 'ship_build.stats_deployable', unit: '', value: ship.storage?.deployable || 0 }

// 当前代码
{ key: 'countermeasure', labelKey: 'ship_build.stats_countermeasure', unit: '', value: 0 } // 改为
{ key: 'countermeasure', labelKey: 'ship_build.stats_countermeasure', unit: '', value: ship.storage?.countermeasure || 0 }
```

### 5.2 实现武器/炮塔/导弹发射器伤害计算（tasks 5.4-5.6）

#### 5.2.0 数据源说明（根据 equipment.class 决定）

- **`class=weapon`**：从 `bullets.json` 获取 `damage` 字段
- **`class=turret`**：从 `bullets.json` 获取 `damage` 字段
- **`class=missilelauncher`**：从 `missiles.json` 获取 `explosive` 字段
- **`class=missileturret`**：从 `missiles.json` 获取 `explosive` 字段

**注意**：根据 equipment 的 `class` 属性决定弹药类型，而不是根据 slot 的 `type`。

#### 5.2.1 初始化 missiles Map

在 `ShipBuildView.vue` 中添加 missiles 数据加载：

```typescript
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'

const missiles = missilesRaw as any[]
const missileMap = new Map<string, any>()
missiles.forEach((m) => {
  // 使用 macro 作为 key（equipment.bullet 存储的是 macro 值）
  missileMap.set(m.macro, m)
})
```

#### 5.2.2 数据获取逻辑

在 `ShipBuildView.vue` 中添加伤害计算函数：

```typescript
// 新增函数：获取武器伤害统计（根据 equipment.class 决定弹药类型）
const getWeaponDamageStats = () => {
  if (!selectedShip.value) return { burst: 0, sustained: 0 }

  let totalBurst = 0
  let totalSustained = 0

  // 遍历所有已选装备槽位
  connectionRows.value.forEach(row => {
    const equipmentId = selectedByConnection.value[row.connectionKey]
    if (!equipmentId) return
    const equipment = equipmentMap.get(equipmentId)
    if (!equipment?.bullet) return

    const equipmentClass = equipment.class
    const count = row.count || 1

    // 根据 equipment.class 决定使用 bullets.json 还是 missiles.json
    if (equipmentClass === 'weapon' || equipmentClass === 'turret') {
      // 常规武器/炮台：使用 bullets.json
      const bullet = bulletMap.get(equipment.bullet)
      if (!bullet) return
      totalBurst += (bullet.damage || 0) * count * 5
      totalSustained += ((bullet.damage || 0) / (bullet.reload || 1)) * count
    } else if (equipmentClass === 'missilelauncher' || equipmentClass === 'missileturret') {
      // 导弹发射器：使用 missiles.json
      const missile = missileMap.get(equipment.bullet)
      if (!missile) return
      // 爆发：使用 explosive 作为单发伤害，假设前 5 秒
      totalBurst += (missile.explosive || 0) * count * 5
      // 持续：DPS = explosive / reload
      totalSustained += ((missile.explosive || 0) / (missile.reload || 1)) * count
    }
  })

  return { burst: totalBurst, sustained: totalSustained }
}
    totalBurst += (missile.explosive || 0) * count * 5
    // 持续：DPS = explosive / reload
    totalSustained += ((missile.explosive || 0) / (missile.reload || 1)) * count
  })

  return { burst: totalBurst, sustained: totalSustained }
}

// 新增函数：获取炮塔平均伤害（根据 equipment.class 决定弹药类型）
const getTurretDamageStats = () => {
  if (!selectedShip.value) return 0

  // 遍历所有槽位，筛选 turret 和 missileturret class 的装备
  let totalDamage = 0
  let turretCount = 0

  connectionRows.value.forEach(row => {
    const equipmentId = selectedByConnection.value[row.connectionKey]
    if (!equipmentId) return
    const equipment = equipmentMap.get(equipmentId)
    if (!equipment?.bullet) return

    const equipmentClass = equipment.class
    // 只计算 turret 和 missileturret class
    if (equipmentClass !== 'turret' && equipmentClass !== 'missileturret') return

    const count = row.count || 1

    if (equipmentClass === 'turret') {
      // 常规炮台：使用 bullets.json
      const bullet = bulletMap.get(equipment.bullet)
      if (!bullet) return
      totalDamage += ((bullet.damage || 0) / (bullet.reload || 1)) * count
      turretCount += count
    } else if (equipmentClass === 'missileturret') {
      // 导弹发射器：使用 missiles.json
      const missile = missileMap.get(equipment.bullet)
      if (!missile) return
      totalDamage += ((missile.explosive || 0) / (missile.reload || 1)) * count
      turretCount += count
    }
  })
      const count = row.count || 1
      totalDamage += ((missile.explosive || 0) / (missile.reload || 1)) * count
      turretCount += count
    }
  })

  return turretCount > 0 ? totalDamage / turretCount : 0
}
```

#### 5.2.2 字段映射更新

```typescript
// buildSummaryStats / buildDetailStats 中
const weaponStats = getWeaponDamageStats()
const turretAvg = getTurretDamageStats()

{ key: 'weapon_burst', labelKey: 'ship_build.stats_weapon_burst', unit: 'MW', value: weaponStats.burst },
{ key: 'weapon_sustained', labelKey: 'ship_build.stats_weapon_sustained', unit: 'MW', value: weaponStats.sustained },
{ key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: turretAvg },
```

### 5.3 Blueprint 数据源重构（tasks 6.1-6.3）

#### 5.3.1 修改 getShieldStats

```typescript
// 当前：从 connectionRows + selectedByConnection 获取
// 改为：从 blueprint.connections 获取

const getShieldStats = () => {
  if (!selectedShip.value || !blueprint.value) return { max: 0, rate: 0, delay: 0, groupAvg: 0 }

  let max = 0
  let rate = 0
  let delay = 0

  // 从 blueprint.connections 获取 shield 装备
  const shieldConnection = blueprint.value.connections.find(c => c.slot_type === 'shield')
  if (shieldConnection) {
    shieldConnection.group.forEach(g => {
      const equipment = equipmentMap.get(g.equipment_id)
      if (!equipment?.stats?.recharge) return
      const count = g.count || 1
      max += (equipment.stats.recharge.max || 0) * count
      rate += (equipment.stats.recharge.rate || 0) * count
      delay = Math.max(delay, equipment.stats.recharge.delay || 0)
    })
  }

  // 计算 totalShieldSlots（从 ship.slots）
  let totalShieldSlots = 0
  selectedShip.value.slots.forEach(slot => {
    slot.groups.forEach(group => {
      // 查找 blueprint 中的 shield 配置
      const shieldConn = blueprint.value?.connections.find(c => c.slot_type === slot.type)
      const groupData = shieldConn?.group.find(g => g.group === group.group)
      if (groupData?.shield) {
        totalShieldSlots += groupData.shield.count || 0
      }
    })
  })

  const groupAvg = totalShieldSlots > 0 ? max / totalShieldSlots : 0
  return { max, rate, delay, groupAvg }
}
```

#### 5.3.2 修改 getEngineStats

```typescript
// 当前：从 connectionRows + selectedByConnection 获取
// 改为：从 blueprint.connections 获取

const getEngineStats = () => {
  if (!selectedShip.value || !blueprint.value) return null

  const engineConnection = blueprint.value.connections.find(c => c.slot_type === 'engine')
  if (!engineConnection || engineConnection.group.length === 0) return null

  let thrustForward = 0
  let boostMultiplier = 1
  let boostDuration = 0
  let boostRecharge = 0
  let travelMultiplier = 1
  let travelCharge = 0

  engineConnection.group.forEach(g => {
    const equipment = equipmentMap.get(g.equipment_id)
    if (!equipment?.stats) return

    const count = g.count || 1
    if (equipment.stats.thrust?.forward) thrustForward += equipment.stats.thrust.forward * count
    if (equipment.stats.boost?.thrust) boostMultiplier = equipment.stats.boost.thrust
    if (equipment.stats.boost?.duration) boostDuration = Math.max(boostDuration, equipment.stats.boost.duration)
    if (equipment.stats.boost?.recharge) boostRecharge = Math.max(boostRecharge, equipment.stats.boost.recharge)
    if (equipment.stats.travel?.thrust) travelMultiplier = equipment.stats.travel.thrust
    if (equipment.stats.travel?.charge) travelCharge = Math.max(travelCharge, equipment.stats.travel.charge)
  })

  if (thrustForward === 0) return null
  return { thrustForward, boostMultiplier, boostDuration, boostRecharge, travelMultiplier, travelCharge }
}
```

#### 5.3.3 移除 selectedByConnection 依赖

属性计算函数（getShieldStats、getEngineStats、getWeaponDamageStats、getTurretDamageStats）全部改为从 `blueprint.value.connections` 获取数据，不再使用 `selectedByConnection`。

### 6. Store 层暴露 blueprint

确保 `useShipBuildStore` 已导出 `blueprint` 供组件使用：

```typescript
// src/store/useShipBuildStore.ts
return {
  // ... existing exports
  blueprint,  // 已存在
}
```

#### ShipBuildView.vue 引用 blueprint

在 `storeToRefs` 中添加 `blueprint`：

```typescript
const {
  // ... existing refs
  blueprint,  // 新增
} = storeToRefs(shipBuildStore)
```

### 实现顺序建议

1. **第一步**：修正占位字段（radar_range, deployable, countermeasure）
2. **第二步**：实现武器/炮塔伤害计算
3. **第三步**：Blueprint 数据源重构（getShieldStats, getEngineStats）
4. **第四步**：验证 build 通过

### 测试验证点

1. 选择有 radar 数据的飞船，验证雷达范围正确显示
2. 选择有 deployable/countermeasure 数据的飞船，验证数值正确
3. 为飞船装备武器，验证 weapon_burst / weapon_sustained 正确计算
4. 为飞船装备炮塔，验证 turret_avg 正确计算
5. 保存 blueprint 后重新加载，验证属性值保持一致
