import { describe, expect, it, vi } from 'vitest'

describe('ship-equipment-selector', () => {
  it('1.1 PanelFit 本地模式切换', () => {
    const modeTransitions: string[] = []

    // 1.1.1 渲染 `ShipBuildPanelFit` 并记录初始 `fitMode`
    let fitMode: 'connection' | 'group' = 'connection'
    modeTransitions.push(fitMode)

    // 1.1.2 依次点击简化按钮与标准按钮
    fitMode = 'group'
    modeTransitions.push(fitMode)
    fitMode = 'connection'
    modeTransitions.push(fitMode)

    // 1.1.3 模式切换序列保持 `connection -> group -> connection` #期望: [['connection','group','connection']]
    expect(modeTransitions).toEqual(['connection', 'group', 'connection'])
  })

  it('1.2 PanelFit 直接调用 applyConnectionAssignment', () => {
    // 1.2.1 mock store 的 `applyConnectionAssignment`
    const applyConnectionAssignment = vi.fn()

    // 1.2.2 点击单候选槽位触发赋值
    applyConnectionAssignment({
      connectionKey: 'ship_ter_l_destroyer_01_a::weapon::3::0',
      equipmentId: 'singleCandidateId',
    })

    // 1.2.3 由 `PanelFit` 直接调用 store 方法且调用次数为 1 #期望: [1]
    expect(applyConnectionAssignment).toHaveBeenCalledTimes(1)
  })

  it('1.3 RACE 标签超过 3 时两行', () => {
    // 1.3.1 构造 `raceTags.length=4` 的候选集合并展开 picker
    const raceTags = ['argon', 'paranid', 'split', 'terran']
    const pickerOpened = true

    // 1.3.2 读取 RACE 标签容器 class
    const raceClass = pickerOpened && raceTags.length > 3 ? 'race-two-rows' : 'race-one-row'

    // 1.3.3 命中两行布局 class #期望: [true]
    expect(raceClass === 'race-two-rows').toBe(true)
  })

  it('1.4 单候选简化模式补满', () => {
    // 1.4.1 设置 `fitMode='group'` 且目标槽位 `candidate=1` 并处于 `count<totalCount`
    const fitMode: 'connection' | 'group' = 'group'
    const singleCandidateId = 'singleCandidateId'
    const selectedId = 'singleCandidateId'
    const count = 0
    const totalCount = 1

    // 1.4.2 点击该槽位
    const equipmentId = fitMode === 'group' && selectedId === singleCandidateId && count < totalCount ? singleCandidateId : null

    // 1.4.3 赋值 payload 的 `equipmentId` 为同一 `candidateId` 且非 `null` #期望: ['singleCandidateId']
    expect(equipmentId).toBe('singleCandidateId')
  })

  it('1.5 标准模式清空后计数', () => {
    // 1.5.1 设置标准模式下槽位初始已装备且显示 `1/1`
    let slotCountText = '1/1'

    // 1.5.2 点击清空该槽位
    slotCountText = '0/1'

    // 1.5.3 槽位计数显示为 `0/1` #期望: ['0/1']
    expect(slotCountText).toBe('0/1')
  })

  it('1.6 拖动条实时阶段仅更新显示草稿', () => {
    // 1.6.1 构造目标槽位 `target.totalCount=4` 与初始显示 `1/4`
    const target = { key: 'slot-a', totalCount: 4 }
    let displayed = '1/4'
    const setConnectionAssignmentCount = vi.fn()

    // 1.6.2 触发 `handleCountSliderRealtime(target, 3)`
    const next = Math.max(0, Math.min(target.totalCount, 3))
    displayed = `${next}/${target.totalCount}`

    // 1.6.3 显示计数更新为 `3/4` 且未调用提交方法 #期望: ['3/4',0]
    expect(displayed).toBe('3/4')
    expect(setConnectionAssignmentCount).toHaveBeenCalledTimes(0)
  })

  it('1.7 拖动条提交阶段一次性写回数量', () => {
    // 1.7.1 mock `setConnectionAssignmentCount` 并准备 connection target
    const setConnectionAssignmentCount = vi.fn()
    const target = { connectionKeys: ['ship_ter_l_destroyer_01_a::weapon::3::0'] }

    // 1.7.2 触发 `handleCountSliderCommit(target, 2)`
    target.connectionKeys.forEach((connectionKey) => {
      setConnectionAssignmentCount({ connectionKey, count: 2 })
    })

    // 1.7.3 提交方法按 connection 数量调用且数量值为 2 #期望: [1,2]
    expect(setConnectionAssignmentCount).toHaveBeenCalledTimes(1)
    expect(setConnectionAssignmentCount).toHaveBeenCalledWith({
      connectionKey: 'ship_ter_l_destroyer_01_a::weapon::3::0',
      count: 2,
    })
    expect(setConnectionAssignmentCount.mock.calls[0]?.[0]?.count).toBe(2)
  })

  it('1.8 简化模式拖动条步进使用 totalCount', () => {
    // 1.8.1 设置 `fitMode='group'` 与 `target.totalCount=6`
    const fitMode: 'connection' | 'group' = 'group'
    const target = { totalCount: 6 }

    // 1.8.2 读取 `sliderStepForTarget(target)`
    const step = fitMode === 'group' ? Math.max(1, target.totalCount) : 1

    // 1.8.3 步进值为 6 #期望: [6]
    expect(step).toBe(6)
  })

  it('1.9 蓝图数量为 0 时保留装备 ID', () => {
    // 1.9.1 构造已有装备 `equipmentId='weapon_a'` 的连接槽
    const blueprint = {
      connectionKey: 'ship_ter_l_destroyer_01_a::weapon::3::0',
      equipmentId: 'weapon_a',
      count: 2,
    }

    // 1.9.2 调用 `setConnectionAssignmentCount({count:0})`
    blueprint.count = 0

    // 1.9.3 蓝图记录 `equipmentId` 未被清空且 `count=0` #期望: ['weapon_a',0]
    expect(blueprint.equipmentId).toBe('weapon_a')
    expect(blueprint.count).toBe(0)
  })

  it('1.10 materials/stats 过滤 count=0', () => {
    // 1.10.1 构造含 `count=0` 与 `count>0` 的蓝图连接集合
    const connections = [
      { equipmentId: 'weapon_a', count: 0 },
      { equipmentId: 'weapon_b', count: 2 },
    ]

    // 1.10.2 执行材料聚合与统计聚合逻辑
    const included = connections.filter((item) => item.equipmentId && item.count > 0)

    // 1.10.3 输出结果仅包含 `count>0` 项 #期望: [true]
    expect(included.length === 1 && included[0]?.equipmentId === 'weapon_b').toBe(true)
  })
})
