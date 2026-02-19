/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLogicFlowStore } from '../../src/store/useLogicFlowStore'
import { useGameDataStore } from '../../src/store/useGameDataStore'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, '../../src/assets/x4_game_data/8.0-Diplomacy/data')

// Mock crypto
if (typeof crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  };
}

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  }),
  createI18n: () => ({
    global: {
      locale: { value: 'en' },
      setLocaleMessage: vi.fn(),
      t: (key: string) => key
    },
    install: vi.fn()
  })
}))

// Mock useX4I18n
vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: vi.fn(),
    translateModuleGroup: vi.fn(),
    translateWare: vi.fn()
  })
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn().mockResolvedValue(true)
}))

describe('LogicFlow Refined Cleanup & Restrictions', () => {
  let logicFlow: any
  let gameData: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    logicFlow = useLogicFlowStore()
    gameData = useGameDataStore()

    await gameData.initialize()
  })

  it('should delete an isolated node if it loses all consumers', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    
    // 1. 添加“船体部件” (Root) -> 自动生成“石墨烯” (Auto)
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    const grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene')
    expect(grapheneNode).toBeDefined()
    expect(grapheneNode.isRoot).toBe(false)

    // 2. 将“石墨烯”隔离
    logicFlow.toggleNodeIsolation(group.id, grapheneNode.id)
    expect(grapheneNode.isIsolated).toBe(true)

    // 3. 删除“船体部件” (下游消费者)
    const hullPartsNode = group.nodes.find((n: any) => n.wareId === 'hullparts')
    logicFlow.removeNode(group.id, hullPartsNode.id)

    // 4. 验证“石墨烯”被删除（即使它是隔离状态，因为它是非根节点且无消费者）
    expect(group.nodes.find((n: any) => n.wareId === 'graphene')).toBeUndefined()
  })

  it('should NOT delete an isolated node if it IS a root node', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    
    // 1. 手动添加“石墨烯” (Root)
    logicFlow.expandUpstream(group.id, 'graphene', 'manual', 'default')
    const grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene')
    expect(grapheneNode.isRoot).toBe(true)

    // 2. 隔离"石墨烯"
    logicFlow.toggleNodeIsolation(group.id, grapheneNode.id)
    expect(grapheneNode.isIsolated).toBe(true)

    // 3. 执行清理
    logicFlow.cleanupUnusedAutoNodes(group.id)

    // 4. 验证“石墨烯”依然存在（因为它是根节点）
    expect(group.nodes.find((n: any) => n.wareId === 'graphene')).toBeDefined()
  })

  it('should correctly identify isDepended for isolation permission', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    
    // 1. 手动添加“船体部件”
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    
    // 2. 验证“船体部件”没有下游，isDepended 应为 false
    expect(logicFlow.isNodeDepended(group.id, 'hullparts')).toBe(false)

    // 3. 验证“石墨烯”被“船体部件”依赖，isDepended 应为 true
    expect(logicFlow.isNodeDepended(group.id, 'graphene')).toBe(true)
  })

  it('should correctly set isRoot when manual node already exists as auto', () => {
    const group = logicFlow.addGroup('industrial', 'default')
    
    // 1. 自动生成“石墨烯”
    logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    let grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene')
    expect(grapheneNode.isRoot).toBe(false)

    // 2. 手动添加“石墨烯” (升级)
    logicFlow.expandUpstream(group.id, 'graphene', 'manual', 'default')
    grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene')
    
    // 3. 验证升级后 isRoot 变为 true
    expect(grapheneNode.source).toBe('manual')
    expect(grapheneNode.isRoot).toBe(true)
  })

  it('should reject incompatible wares based on group category and lineage', () => {
    // 1. 创建通用工业组
    const industrialGroup = logicFlow.addGroup('industrial', 'default')
    
    // 2. 尝试添加农业产品 (Spaceweed) -> 应该被拒绝
    // Spaceweed is usually agricultural, not industrial.
    // We assume 'spaceweed' is not in wareSetsByIndustrialRace['default']
    const status1 = logicFlow.getWareGroupStatus(industrialGroup.id, 'spaceweed', 'default')
    expect(status1).toBe('rejected')

    // 3. 尝试添加通用工业产品 (Hull Parts) -> 应该可用
    const status2 = logicFlow.getWareGroupStatus(industrialGroup.id, 'hullparts', 'default')
    expect(status2).toBe('available')

    // 4. 创建 Terran 工业组
    const terranGroup = logicFlow.addGroup('industrial', 'terran')

    // 5. 尝试添加 Argon 工业产品 (Hull Parts) -> 应该被拒绝 (假设 Terran 不生产 Hull Parts)
    // Note: This depends on actual game data. In X4, Terrans use different materials.
    // If Hull Parts is not in Terran build tree, it should be rejected.
    const status3 = logicFlow.getWareGroupStatus(terranGroup.id, 'hullparts', 'default')
    // Check if hullparts is in terran set. Likely not.
    if (!gameData.wareSetsByIndustrialRace['terran'].has('hullparts')) {
        expect(status3).toBe('rejected')
    }

    // 6. 尝试添加 Terran 工业产品 (Computronic Substrate) -> 应该可用
    const status4 = logicFlow.getWareGroupStatus(terranGroup.id, 'computronicsubstrate', 'terran')
    expect(status4).toBe('available')
  })

  it('should differentiate between locked and unlocked rejection for UI feedback', () => {
    // Note: getWareGroupStatus returns 'rejected' for both cases.
    // The UI (LogicFlowPlanningZone.vue) uses group.isLocked to decide whether to show red border or fade out.
    // This test ensures the underlying data supports this logic.

    const group = logicFlow.addGroup('industrial', 'terran')
    
    // Case 1: Unlocked, Incompatible Item
    // Expect: status is 'rejected', isLocked is false
    const status1 = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
    if (!gameData.wareSetsByIndustrialRace['terran'].has('hullparts')) {
        expect(status1).toBe('rejected')
    }
    expect(group.isLocked).toBe(false)

    // Case 2: Locked, Incompatible Item
    logicFlow.toggleGroupLock(group.id)
    expect(group.isLocked).toBe(true)
    
    const status2 = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default')
    if (!gameData.wareSetsByIndustrialRace['terran'].has('hullparts')) {
        expect(status2).toBe('rejected')
    }
  })
})
