import { computed } from 'vue'
import type { X4Equipment, X4Ship } from '@/types/x4'
import bulletsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'

// Bullet map - use id as key
const bulletMap = new Map<string, any>()
bulletsRaw.forEach((b: any) => {
  bulletMap.set(b.id, b)
})

// Missile map - use macro as key
const missileMap = new Map<string, any>()
missilesRaw.forEach((m: any) => {
  missileMap.set(m.macro, m)
})

// ============ 类型定义 ============

export interface WeaponSummary {
  burstDPS: number
  range: number
}

export interface TurretSummary {
  sustainedDPS: number
  range: number
}

export interface ShieldSummary {
  shieldMax: number
  shieldDelay: number
}

export interface EngineSummary {
  speed: number
  travelSpeed: number
}

export interface ThrusterSummary {
  strafeSpeed: number
  yawRate: number
}

export interface EquipmentSummary {
  weapon?: WeaponSummary
  turret?: TurretSummary
  shield?: ShieldSummary
  engine?: EngineSummary
  thruster?: ThrusterSummary
}

// Details types
export interface WeaponDetail {
  burstDPS: number
  sustainedDPS: number
  range: number
  singleDamage: number
  singleShotTime: number
  avgShotTime: number
  ammo: number
  barrelamount: number
  ammoReload: number
  chargetime: number
  timeToOverheat: number
  cooldelay: number
  coolTime: number
  cycleTime: number
}

export interface TurretDetail extends WeaponDetail {}

export interface ShieldDetail {
  shieldMax: number
  shieldRate: number
  shieldDelay: number
}

export interface EngineDetail {
  thrustForward: number
  boostMultiplier: number
  boostAcceleration: number
  boostDuration: number
  boostRecharge: number
  travelThrust: number
  travelAttack: number
  travelCharge: number
  travelSpeed: number
  travelAcceleration: number
  speed: number
  acceleration: number
  boostSpeed: number
  boostAccel: number
}

export interface ThrusterDetail {
  pitch: number
  yaw: number
  roll: number
  strafe: number
  pitchRate: number
  yawRate: number
  rollRate: number
  strafeSpeed: number
  strafeAcceleration: number
}

export interface EquipmentDetail {
  weapon?: WeaponDetail
  turret?: TurretDetail
  shield?: ShieldDetail
  engine?: EngineDetail
  thruster?: ThrusterDetail
}

// ============ 工具函数 ============

// 判断是否为 Beam 武器
function isBeamWeapon(bullet: any): boolean {
  return bullet.type === 'beam'
}

// 持久 DPS 计算函数
function calculateSustainedDPS(
  burstDPS: number,
  singleHeat: number,
  weaponHeat: any,
  salvosPerSecond: number
): number {
  const overheatThreshold = 10000

  if (!weaponHeat?.overheat || !weaponHeat?.coolrate || singleHeat <= 0) {
    return burstDPS
  }

  const avgHeatPerSec = salvosPerSecond * singleHeat
  const timeToOverheat = avgHeatPerSec > 0 ? overheatThreshold / avgHeatPerSec : 0
  const cycleTime = timeToOverheat + weaponHeat.cooldelay + (overheatThreshold / weaponHeat.coolrate)
  return cycleTime > 0 ? burstDPS * (timeToOverheat / cycleTime) : 0
}

// 计算武器 DPS
function calculateWeaponDPS(equipment: X4Equipment, bullet: any, missile: any, count: number) {
  const weaponHeat = equipment.heat

  if (bullet) {
    const isBeam = isBeamWeapon(bullet)
    const amount = Math.max(1, Number(bullet.amount || 1))
    const barrelAmount = Math.max(1, Number(bullet.barrelamount || 1))
    const damageMultiplier = amount * barrelAmount
    let singleDamage: number
    let singleHeat: number
    let singleShotTime: number

    if (isBeam) {
      const lifetime = bullet.lifetime
      const damage = bullet.damage
      const reload = bullet.reload
      const chargetime = bullet.chargetime
      const ammo = bullet.ammo
      const ammoReload = bullet.ammoreload

      singleDamage = damage * lifetime
      singleShotTime = chargetime + Math.max(lifetime, reload)
      const avgShotTime = (ammo * singleShotTime + ammoReload) / Math.max(ammo, 1)
      const salvosPerSecond = avgShotTime > 0 ? (damageMultiplier * count) / avgShotTime : 0
      const burstDPS = salvosPerSecond * singleDamage

      singleHeat = bullet.shotHeat + bullet.heat * lifetime
      const sustainedDPS = calculateSustainedDPS(burstDPS, singleHeat, weaponHeat, salvosPerSecond)

      // 计算详细字段
      const overheatThreshold = 10000
      const avgHeatPerSec = salvosPerSecond * singleHeat
      const timeToOverheat = avgHeatPerSec > 0 ? overheatThreshold / avgHeatPerSec : 0
      const coolTime = weaponHeat?.coolrate ? overheatThreshold / weaponHeat.coolrate : 0
      const cycleTime = timeToOverheat + (weaponHeat?.cooldelay || 0) + coolTime

      return {
        burstDPS,
        sustainedDPS,
        range: bullet.range || 0,
        singleDamage,
        singleShotTime,
        avgShotTime,
        ammo,
        barrelamount: barrelAmount,
        ammoReload,
        chargetime,
        timeToOverheat,
        cooldelay: weaponHeat?.cooldelay || 0,
        coolTime,
        cycleTime
      }
    } else {
      const damage = bullet.damage
      const reload = bullet.reload
      const chargetime = bullet.chargetime
      const ammo = bullet.ammo
      const ammoReload = bullet.ammoreload

      singleDamage = damage
      singleHeat = bullet.shotHeat
      singleShotTime = chargetime + reload

      const avgShotTime = (ammo * singleShotTime + ammoReload) / Math.max(ammo, 1)
      const salvosPerSecond = avgShotTime > 0 ? (damageMultiplier * count) / avgShotTime : 0
      const burstDPS = salvosPerSecond * singleDamage
      const sustainedDPS = calculateSustainedDPS(burstDPS, singleHeat, weaponHeat, salvosPerSecond)

      // 计算详细字段
      const overheatThreshold = 10000
      const avgHeatPerSec2 = salvosPerSecond * singleHeat
      const timeToOverheat2 = avgHeatPerSec2 > 0 ? overheatThreshold / avgHeatPerSec2 : 0
      const coolTime = weaponHeat?.coolrate ? overheatThreshold / weaponHeat.coolrate : 0
      const cycleTime = timeToOverheat2 + (weaponHeat?.cooldelay || 0) + coolTime

      return {
        burstDPS,
        sustainedDPS,
        range: bullet.range || 0,
        singleDamage,
        singleShotTime,
        avgShotTime,
        ammo,
        barrelamount: barrelAmount,
        ammoReload,
        chargetime,
        timeToOverheat: timeToOverheat2,
        cooldelay: weaponHeat?.cooldelay || 0,
        coolTime,
        cycleTime
      }
    }
  }

  if (missile) {
    const explosive = missile.explosive || 0
    const reload = missile.reload || 1
    const dps = (explosive / reload) * count
    return {
      burstDPS: dps,
      sustainedDPS: dps,
      range: missile.range || 0,
      singleDamage: explosive,
      singleShotTime: reload,
      avgShotTime: reload,
      ammo: missile.ammo || 1,
      barrelamount: 1,
      ammoReload: 0,
      chargetime: 0,
      timeToOverheat: 0,
      cooldelay: 0,
      coolTime: 0,
      cycleTime: 0
    }
  }

  return null
}

// 计算护盾详情
function calculateShieldDetail(equipment: X4Equipment): ShieldDetail {
  return {
    shieldMax: equipment.recharge?.max || 0,
    shieldRate: equipment.recharge?.rate || 0,
    shieldDelay: equipment.recharge?.delay || 0
  }
}

// 计算引擎详情
function calculateEngineDetail(equipment: X4Equipment, ship: X4Ship): EngineDetail {
  const thrustForward = equipment.thrust?.forward || 0
  const mass = ship.physics?.mass || 1
  const dragForward = ship.physics?.drag?.forward || 1

  // 速度 = 推力 / 阻力
  const speed = dragForward > 0 ? Math.round(thrustForward / dragForward) : 0

  // 加速度 = 推力 / 质量
  const acceleration = mass > 0 ? Math.round(thrustForward / mass) : 0

  // 巡航推力 = 前向推力 × 巡航乘数
  const travelT = equipment.travel?.thrust || 0
  const travelThrust = thrustForward * travelT

  // 巡航速度
  const travelSpeed = dragForward > 0 ? Math.round(travelThrust / dragForward) : 0

  // 巡航加速度 = 巡航速度 / travel.attack
  const travelAttack = equipment.travel?.attack || 1
  const travelAcceleration = travelAttack > 0 ? Math.round(travelSpeed / travelAttack) : 0

  // 助推
  const boostMultiplier = equipment.boost?.thrust || 1
  const boostAcceleration = equipment.boost?.acceleration || 1
  const boostDuration = equipment.boost?.duration || 0
  const boostRecharge = equipment.boost?.recharge || 0

  const boostSpeed = Math.round(speed * boostMultiplier)
  const boostAccel = Math.round(acceleration * boostAcceleration)

  return {
    thrustForward,
    boostMultiplier,
    boostAcceleration,
    boostDuration,
    boostRecharge,
    travelThrust,
    travelAttack: travelAttack,
    travelCharge: equipment.travel?.charge || 0,
    travelSpeed,
    travelAcceleration,
    speed,
    acceleration,
    boostSpeed,
    boostAccel
  }
}

// 计算推进器详情
function calculateThrusterDetail(equipment: X4Equipment, ship: X4Ship): ThrusterDetail {
  const pitch = equipment.thrust?.pitch || 0
  const yaw = equipment.thrust?.yaw || 0
  const roll = equipment.thrust?.roll || 0
  const strafe = equipment.thrust?.strafe || 0

  const mass = ship.physics?.mass || 1
  const dragHorizontal = ship.physics?.drag?.horizontal || 1
  const dragPitch = ship.physics?.drag?.pitch || 1
  const dragYaw = ship.physics?.drag?.yaw || 1
  const dragRoll = ship.physics?.drag?.roll || 1
  const accfactorsHorizontal = ship.physics?.accfactors?.horizontal || 1

  // 转向率 = 推力 / 阻力
  const pitchRate = dragPitch > 0 ? pitch / dragPitch : 0
  const yawRate = dragYaw > 0 ? yaw / dragYaw : 0
  const rollRate = dragRoll > 0 ? roll / dragRoll : 0

  // 侧移速度 = 侧移推力 / 水平阻力
  const strafeSpeed = dragHorizontal > 0 ? Math.round(strafe / dragHorizontal) : 0

  // 侧移加速度 = 侧移推力 / 质量 × 水平加速因子
  const strafeAcceleration = mass > 0 ? Math.round(strafe / mass * accfactorsHorizontal) : 0

  return {
    pitch,
    yaw,
    roll,
    strafe,
    pitchRate,
    yawRate,
    rollRate,
    strafeSpeed,
    strafeAcceleration
  }
}

// ============ Composable ============

export function useEquipmentStats(equipment: X4Equipment, ship: X4Ship) {
  // 获取 bullet/missile 数据
  const bullet = equipment.bullet ? bulletMap.get(equipment.bullet) : null
  const missile = equipment.bullet && !bullet ? missileMap.get(equipment.bullet) : null

  // 计算详情
  const details = computed(() => {
    const equipmentType = equipment.type
    const equipmentClass = equipment.class

    // 导弹发射器：type=weapon 且 class=missilelauncher (必须在普通weapon之前)
    if (equipmentType === 'weapon' && equipmentClass === 'missilelauncher') {
      if (!missile) return undefined
      return calculateWeaponDPS(equipment, null, missile, 1)
    }

    // 导弹炮塔：type=turret 且 class=missileturret (必须在普通turret之前)
    if (equipmentType === 'turret' && equipmentClass === 'missileturret') {
      if (!missile) return undefined
      return calculateWeaponDPS(equipment, null, missile, 1)
    }

    // 武器：type=weapon
    if (equipmentType === 'weapon') {
      if (!bullet) return undefined
      return calculateWeaponDPS(equipment, bullet, null, 1)
    }

    // 炮塔：type=turret
    if (equipmentType === 'turret') {
      if (!bullet) return undefined
      return calculateWeaponDPS(equipment, bullet, null, 1)
    }

    // 护盾
    if (equipmentType === 'shield') {
      return calculateShieldDetail(equipment)
    }

    // 推进器
    if (equipmentType === 'thruster') {
      return calculateThrusterDetail(equipment, ship)
    }

    // 引擎
    if (equipmentType === 'engine') {
      return calculateEngineDetail(equipment, ship)
    }

    return undefined
  })

  // 计算汇总
  const summary = computed(() => {
    const equipmentType = equipment.type

    // 武器
    if (equipmentType === 'weapon') {
      const detail = details.value as WeaponDetail | undefined
      if (!detail) return undefined
      return {
        burstDPS: detail.burstDPS,
        range: detail.range
      }
    }

    // 炮塔
    if (equipmentType === 'turret') {
      const detail = details.value as TurretDetail | undefined
      if (!detail) return undefined
      return {
        sustainedDPS: detail.sustainedDPS,
        range: detail.range
      }
    }

    // 护盾
    if (equipmentType === 'shield') {
      const detail = details.value as ShieldDetail | undefined
      if (!detail) return undefined
      return {
        shieldMax: detail.shieldMax,
        shieldDelay: detail.shieldDelay
      }
    }

    // 引擎
    if (equipmentType === 'engine') {
      const detail = details.value as EngineDetail | undefined
      if (!detail) return undefined
      return {
        speed: detail.speed,
        travelSpeed: detail.travelSpeed
      }
    }

    // 推进器
    if (equipmentType === 'thruster') {
      const detail = details.value as ThrusterDetail | undefined
      if (!detail) return undefined
      return {
        strafeSpeed: detail.strafeSpeed,
        yawRate: detail.yawRate
      }
    }

    return undefined
  })

  return {
    summary,
    details
  }
}
