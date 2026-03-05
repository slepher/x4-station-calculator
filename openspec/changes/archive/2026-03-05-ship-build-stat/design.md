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
- **`武器持续输出值(MW)`**：根据精确公式计算（见下方 5.2.3）
- **`炮塔平均输出值(MW)`**：根据精确公式计算（见下方 5.2.3）
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

### 5.2.3 子弹/Beam 数据结构与伤害计算公式

#### 区分 Beam vs 子弹
- **Beam**：`speed ≈ 299792500` (光速)
- **子弹**：`speed < 299792500`

#### X4Bullet 数据模型

```typescript
interface X4Bullet {
  id: string;
  class: 'bullet' | 'beam';   // 根据 speed ≈ 光速区分
  speed: number;
  lifetime: number;
  range: number;              // 子弹=lifetime×speed, beam=直接使用range
  reload: number;
  damage: number;             // 子弹=单发伤害, beam=DPS
  repair: number;
  chargetime: number;         // 默认 0，必选
  amount: number;             // 默认 1，必选（霰弹弹片数）
  shotHeat: number;           // 子弹=heat.value(单发热量), beam=heat.initial(初始热量)
  heat: number;               // 子弹=0, beam=每秒持续热量
}
```

#### X4Equipment 热数据（外层）

```typescript
interface X4Equipment {
  // ... 现有字段 ...
  heat?: {
    overheat: number;   // 过热阈值，通常 10000
    cooldelay: number;  // 冷却延迟时间
    coolrate: number;   // 冷却速率（每秒）
  };
}
```

#### 武器伤害计算公式

**通用常量：**
- `overheatThreshold = 10000` (过热阈值)

##### Beam 类

```
range = range (来自XML)
实际伤害 = damage × lifetime              // damage 是 DPS，lifetime 是照射秒数
实际热量 = shotHeat + (heat × lifetime)  // shotHeat=初始热量, heat=每秒热量
单次射击时间 = chargetime + max(lifetime, reload)
爆发DPS = 实际伤害 / 单次射击时间

// 持续DPS计算
shotsInCycle = max(1, floor(overheatThreshold / 实际热量))
totalShotTime = shotsInCycle × 单次射击时间
totalHeat = max(overheatThreshold, 实际热量)
cycleTime = totalShotTime + cooldelay + (totalHeat / coolrate)
cycleDamage = 实际伤害 × shotsInCycle
sustainedDPS = cycleDamage / cycleTime
```

##### 子弹 类（标准/霰弹）

```
range = lifetime × speed
单发伤害 = damage × amount              // 单发伤害 × 弹片数
单发热量 = shotHeat                      // heat 为 0
单次射击时间 = chargetime + reload

// 爆发DPS（统一公式：换弹时间平摊到每发）
avgShotTime = (ammo × 单次射击时间 + ammoReload) / max(ammo, 1)  // 无弹匣时ammo=0, 用1避免除零
avgBurstDPS = 单发伤害 / avgShotTime

// 持续DPS（近似计算：换弹时间平摊）
avgHeatPerSec = avgBurstDPS / 单发伤害 × 单发热量
timeToOverheat = overheatThreshold / avgHeatPerSec
cycleTime = timeToOverheat + cooldelay + ammoReload
sustainedDPS = avgBurstDPS × (timeToOverheat / cycleTime)
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

  // 计算挂载护盾（shield on equipment）：非专用 shield 槽位上挂载的护盾
  // 护盾：保护船体的护盾，装在专用 shield 槽位上
  // 挂载护盾：装在其他槽位（engine、weapon 等）上，保护被挂载的装备
  let mountedShieldMax = 0
  let mountedShieldGroups = 0

  blueprint.value.connections.forEach(conn => {
    // 跳过专用 shield 槽
    if (conn.slot_type === 'shield') return
    conn.group.forEach(g => {
      if (!g.shield) return
      const shieldEquipment = equipmentMap.get(g.shield.equipment_id)
      if (!shieldEquipment?.stats?.recharge) return
      mountedShieldMax += (shieldEquipment.stats.recharge.max || 0) * (g.shield.count || 0)
      mountedShieldGroups++
    })
  })

  // 编组平均护盾容量 = 非护盾槽位上挂载的护盾容量总和 / 有护盾挂载的非护盾槽位 group 数量
  const groupAvg = mountedShieldGroups > 0 ? mountedShieldMax / mountedShieldGroups : 0
  return { max, rate, delay, groupAvg, mountedShieldMax }
}
```

#### 5.3.2 修改 getEngineStats

```typescript
const getEngineStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return null

  const engineEquipments = []
  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'engine') return
    conn.group.forEach((g) => {
      if (!g.equipment_id) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (equipment) {
        engineEquipments.push({ equipment, count: g.count })
      }
    })
  })

  if (engineEquipments.length === 0) return null

  let thrustForward = 0
  let boostMultiplier = 1
  let boostAcceleration = 1
  let boostDuration = 0
  let boostRecharge = 0
  let travelThrust = 0
  let travelAttack = 0
  let travelCharge = 0
  let engineCount = 0

  engineEquipments.forEach(({ equipment, count }) => {
    if (!equipment?.stats) return
    engineCount += count
    const fwd = equipment.stats.thrust?.forward || 0
    const travelT = equipment.stats.travel?.thrust || 0
    thrustForward += fwd * count
    // 巡航推力 = 前向推力 × 巡航乘数 × 数量
    travelThrust += fwd * travelT * count
    if (equipment.stats.boost?.thrust) boostMultiplier = equipment.stats.boost.thrust
    if (equipment.stats.boost?.acceleration) boostAcceleration = equipment.stats.boost.acceleration
    if (equipment.stats.boost?.duration) boostDuration = Math.max(boostDuration, equipment.stats.boost.duration)
    if (equipment.stats.boost?.recharge) boostRecharge = Math.max(boostRecharge, equipment.stats.boost.recharge)
    if (equipment.stats.travel?.attack) travelAttack = Math.max(travelAttack, equipment.stats.travel.attack)
    if (equipment.stats.travel?.charge) travelCharge = Math.max(travelCharge, equipment.stats.travel.charge)
  })

  if (thrustForward === 0) return null
  return {
    thrustForward, boostMultiplier, boostAcceleration, boostDuration,
    boostRecharge, travelThrust, travelAttack, travelCharge, engineCount
  }
}
```

#### 5.3.3 新增 getThrusterStats

```typescript
const getThrusterStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return null

  const thrusterEquipments = []
  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'thruster') return
    conn.group.forEach((g) => {
      if (!g.equipment_id) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (equipment) {
        thrusterEquipments.push({ equipment, count: g.count })
      }
    })
  })

  if (thrusterEquipments.length === 0) return null

  let pitch = 0, yaw = 0, roll = 0, strafe = 0

  thrusterEquipments.forEach(({ equipment, count }) => {
    if (!equipment?.stats?.thrust) return
    const c = count || 1
    if (equipment.stats.thrust.pitch) pitch += equipment.stats.thrust.pitch * c
    if (equipment.stats.thrust.yaw) yaw += equipment.stats.thrust.yaw * c
    if (equipment.stats.thrust.roll) roll += equipment.stats.thrust.roll * c
    if (equipment.stats.thrust.strafe) strafe += equipment.stats.thrust.strafe * c
  })

  if (pitch === 0 && yaw === 0 && roll === 0 && strafe === 0) return null
  return { pitch, yaw, roll, strafe }
}
```

#### 5.3.4 速度与加速度计算公式

**数据来源：**
- `ship.physics.mass` - 船体质量
- `ship.physics.drag.forward/horizontal` - 船体阻力
- `ship.physics.accfactors.horizontal` - 水平加速度修正系数
- `engine.stats.thrust.forward` - 引擎前向推力
- `engine.stats.boost.acceleration` - 助推加速度乘数
- `engine.stats.travel.thrust` - 巡航推力乘数
- `engine.stats.travel.attack` - 巡航加速时间（秒）
- `engine.stats.boost.recharge` - 助推回充率（需除以100）
- `thruster.stats.thrust.strafe` - 推进器平移推力
- `ship.radarRange` - 雷达范围（单位：米，需除以1000转换为km）

**公式：**
| 指标 | 公式 |
|------|------|
| 最高速度 | `thrustForward / drag.forward` |
| 加速度 | `thrustForward / mass` |
| 助推加速度 | `加速度 × boost.acceleration` |
| 巡航速度 | `travelThrust / drag.forward` |
| 巡航加速度 | `巡航速度 / travel.attack` |
| 助推回充率 | `boost.recharge / 100` |
| 平移速度 | `thruster.strafe / drag.horizontal` |
| 平移加速度 | `thruster.strafe / mass × accfactors.horizontal` |
| 转向率 (Pitch/Yaw/Roll) | `thruster.thrust / drag` |
| 雷达范围 | `radarRange / 1000` (km) |

**示例：大阪 + L均衡推进器Mk3**
- 推进器：pitch=972, yaw=972, roll=1035
- 船体阻力：pitch=90, yaw=107, roll=70
- 俯仰：972/90 = 10.8 rad/s
- 水平转向：972/107 = 9.08 rad/s
- 翻滚：1035/70 = 14.79 rad/s

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

---

## Panel Stats 数据分组方案

### 分组原则

1. **每个组包含 1 个或多个 summary 数据**：在 summary 状态下显示
2. **每个组包含 0 个或多个 detail 数据**：在 detail 状态下额外显示
3. **同组数据按顺序显示**：summary1 → summary2 → ... → detail1 → detail2 → ... → detailN
4. **同组数据显示在同一列**

### 分组表格

| 序号 | 组名 | 中文名称 | Summary 数据 (摘要显示) | Detail 数据 (详情额外显示) |
|------|------|----------|------------------------|--------------------------|
| 1 | Defense | 防御 | 护盾 (Shield) | 护盾充能率 (Shield Recharge Rate), 护盾充能延迟 (Shield Recharge Delay), 护盾组平均 (Shield Group Avg) |
| 2 | Weapons | 武器 | 武器爆发伤害 (Weapon Burst), 炮塔平均伤害 (Turret Avg) | 武器持续伤害 (Weapon Sustained) |
| 3 | Storage | 存储 | 容器存储 (Container Storage) | 固体存储 (Solid Storage), 液体存储 (Liquid Storage), 压缩存储 (Condensed Storage) |
| 4 | Docks | 船坞 | M船坞数量 (M Dock Count), M船坞容量 (M Dock Capacity), S船坞数量 (S Dock Count), S船坞容量 (S Dock Capacity) | — |
| 5 | Speed | 基础速度 | 速度 (Speed) | 加速度 (Acceleration) |
| 6 | Boost | 助推 | 助推速度 (Boost Speed) | 助推加速度 (Boost Acceleration), 助推持续时间 (Boost Duration), 助推回充率 (Boost Recharge) |
| 7 | Travel | 巡航 | 巡航速度 (Travel Speed) | 巡航加速度 (Travel Acceleration), 巡航充能时间 (Travel Charge Time) |
| 8 | Maneuver | 机动 | — | 平移速度 (Strafe Speed), 平移加速度 (Strafe Acceleration), 偏航 (Yaw), 俯仰 (Pitch), 翻滚 (Roll) |
| 9 | Crew | 乘员 | 船员 (Crew) | — |
| 10 | Hull | 船体 | 船体 (Hull) | — |
| 11 | Radar | 雷达 | 雷达范围 (Radar Range) | — |
| 12 | Cargo | 装载 | 动态决定（见下表） | 动态决定（见下表） |

### Cargo 组动态逻辑

Cargo 组的 summary/detail 分配根据实际值动态决定：

| 条件 | Summary (摘要显示) | Detail (详情额外显示) |
|------|-------------------|----------------------|
| 所有值都为 0 | Container Storage | Solid, Liquid, Condensed |
| Container > 0 | Container Storage | Solid, Liquid, Condensed |
| Container = 0, Solid > 0 | Solid Storage | Container, Liquid, Condensed |
| Container = 0, Solid = 0, Liquid > 0 | Liquid Storage | Container, Solid, Condensed |
| Container = 0, Solid = 0, Liquid = 0, Condensed > 0 | Condensed Storage | Container, Solid, Liquid |
| Container = 0, Solid = 0, Liquid = 0, Condensed = 0 | Container Storage | Solid, Liquid, Condensed |

**优先顺序**：Container → Solid → Liquid → Condensed

### 预期列布局

#### 18x2 排布（Summary + Detail 模式，四列表格 - 组名不重复）

| 行 | 左列组名 | 左列数据 | 右列数据 | 右列组名 |
|----|---------|----------|----------|---------|
| 1 | Hull | Hull | Weapon Burst | Weapons |
| 2 | Defense | Shield | Turret Avg | |
| 3 | | Recharge Rate | Sustained | |
| 4 | | Recharge Delay | Speed | Speed |
| 5 | | Group Avg | Acceleration | |
| 6 | Storage | Container | Boost Speed | Boost |
| 7 | | Solid | Acceleration | |
| 8 | | Liquid | Duration | |
| 9 | | Condensed | Recharge | |
| 10 | Attitude | Yaw | Travel Speed | Travel |
| 11 | | Pitch | Acceleration | |
| 12 | | Roll | Charge Time | |
| 13 | Radar | Radar Range | Strafe Speed | Maneuver |
| 14 | Crew | Crew | Strafe Accel | |
| 15 | Cargo | Unit Storage | M Dock Count | Docks |
| 16 | | Missile | M Dock Capacity | |
| 17 | | Deployable | S Dock Count | |
| 18 | | Countermeasure | S Dock Capacity | |

#### 9x2 排布（Summary 模式）

| 行 | 左列组名 | 左列数据 | 右列数据 | 右列组名 |
|----|---------|----------|----------|---------|
| 1 | Hull | Hull | Weapon Burst | Weapons |
| 2 | Defense | Shield | Turret Avg | |
| 3 | Storage | Container | Speed | Speed |
| 4 | Radar | Radar Range | Boost Speed | Boost |
| 5 | Crew | Crew | Travel Speed | Travel |
| 6 | Cargo | Unit Storage | M Dock Count | Docks |
| 7 | | Missile | M Dock Capacity | |
| 8 | | Deployable | S Dock Count | |
| 9 | | Countermeasure | S Dock Capacity | |

注：Attitude 和 Maneuver 在 Summary 模式下无数据，不显示。
