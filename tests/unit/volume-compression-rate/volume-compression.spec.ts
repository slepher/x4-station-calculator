/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameDataStore } from '../../../src/store/useGameDataStore'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, '../../../src/assets/x4_game_data/8.0-Diplomacy/data')

if (typeof crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  };
}

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

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: vi.fn(),
    translateModuleGroup: vi.fn(),
    translateWare: vi.fn()
  })
}))

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn().mockResolvedValue(true)
}))

describe('Volume Compression Rate Calculation', () => {
  let gameData: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    gameData = useGameDataStore()
    await gameData.initialize()
    gameData.isReady = true
  })

  it('1.1 buildVolumeCompressionMap 计算正确性测试', () => {
    const map = gameData.volumeCompressionMap
    
    const hullPartsModule = Object.values(gameData.modulesMap).find(
      (m: any) => m.id === 'prod_gen_hullparts_macro'
    ) as any
    
    if (hullPartsModule) {
      expect(map[hullPartsModule.id]).toBeDefined()
      
      let outputVolume = 0
      if (hullPartsModule.outputs) {
        Object.entries(hullPartsModule.outputs).forEach(([wareId, amount]) => {
          const ware = gameData.waresMap[wareId]
          if (ware) {
            outputVolume += (amount as number) * ware.volume
          }
        })
      }
      
      let inputVolume = 0
      if (hullPartsModule.inputs) {
        Object.entries(hullPartsModule.inputs).forEach(([wareId, amount]) => {
          if (wareId === 'energycells') return
          const ware = gameData.waresMap[wareId]
          if (ware) {
            inputVolume += (amount as number) * ware.volume
          }
        })
      }
      
      const expectedRate = outputVolume / inputVolume
      expect(map[hullPartsModule.id]).toBeCloseTo(expectedRate, 4)
    }
  })

  it('1.2 忽略 energycells 测试', () => {
    const energyCellsModule = Object.values(gameData.modulesMap).find(
      (m: any) => m.id === 'prod_gen_energycells_macro'
    ) as any
    
    if (energyCellsModule) {
      expect(gameData.volumeCompressionMap[energyCellsModule.id]).toBeUndefined()
    }
    
    const modulesWithEnergyCells = Object.values(gameData.modulesMap).filter(
      (m: any) => m.inputs && 'energycells' in m.inputs
    ) as any[]
    
    if (modulesWithEnergyCells.length > 0) {
      const module = modulesWithEnergyCells[0]
      const rate = gameData.volumeCompressionMap[module.id]
      
      if (rate !== undefined) {
        let inputVolumeWithoutEnergy = 0
        Object.entries(module.inputs).forEach(([wareId, amount]) => {
          if (wareId === 'energycells') return
          const ware = gameData.waresMap[wareId]
          if (ware) {
            inputVolumeWithoutEnergy += (amount as number) * ware.volume
          }
        })
        expect(inputVolumeWithoutEnergy).toBeGreaterThan(0)
      }
    }
  })

  it('1.3 无输入模块不存储测试', () => {
    const modulesWithoutInputs = Object.values(gameData.modulesMap).filter(
      (m: any) => !m.inputs || Object.keys(m.inputs).length === 0
    ) as any[]
    
    modulesWithoutInputs.forEach((module) => {
      expect(gameData.volumeCompressionMap[module.id]).toBeUndefined()
    })
  })
})
