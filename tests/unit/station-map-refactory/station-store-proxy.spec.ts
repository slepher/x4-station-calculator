/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'en' },
      t: (key: string) => key
    }),
    createI18n: actual.createI18n
  }
})

import { useEmpireStore } from '@/store/useEmpireStore'
import { useStationStore } from '@/store/useStationStore'

describe('useStationStore 代理写入', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('写入只作用于当前 active station', async () => {
    const empire = useEmpireStore()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 10000 })

    const a = empire.createStation('A', 'industrial')!
    const b = empire.createStation('B', 'industrial')!

    const station = useStationStore()
    await vi.waitFor(() => expect(station.isReady).toBe(true), { timeout: 10000 })

    empire.selectStation(a.id)
    station.addModule('prod_gen_claytronics_macro', 1)

    empire.selectStation(b.id)
    station.addModule('prod_gen_hullparts_macro', 2)

    const stationA = empire.getStationById(a.id)!
    const stationB = empire.getStationById(b.id)!

    expect(stationA.modules.some(m => m.id === 'prod_gen_claytronics_macro')).toBe(true)
    expect(stationA.modules.some(m => m.id === 'prod_gen_hullparts_macro')).toBe(false)
    expect(stationB.modules.some(m => m.id === 'prod_gen_hullparts_macro')).toBe(true)
  })
})
