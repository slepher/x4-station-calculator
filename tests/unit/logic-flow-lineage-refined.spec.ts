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

    // 加载真实数据以获得真实的依赖关系
    const modules = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'modules.json'), 'utf-8'))
    const wares = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'wares.json'), 'utf-8'))
    
    gameData.modules = modules
    gameData.wares = wares
    gameData.initialize()
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
    expect(grapheneNode.isLocked).toBe(true)

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

    // 2. 隔离“石墨烯”
    logicFlow.toggleNodeIsolation(group.id, grapheneNode.id)
    expect(grapheneNode.isLocked).toBe(true)

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
})
