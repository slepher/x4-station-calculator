/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActiveViewStore } from '@/store/useActiveViewStore'

describe('useActiveViewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('persists auto sector group workbench selection and protects it from station fallback', () => {
    const store = useActiveViewStore()

    store.activeBindingWorkbench = 'auto-sector-group' as any
    store.activeBindingStation = 'station-01'

    expect(store.activeBindingWorkbench).toBe('auto-sector-group')

    const saved = JSON.parse(localStorage.getItem('x4_station_active_view') ?? '{}')
    expect(saved.activeBindingWorkbench).toBe('auto-sector-group')
  })
})
