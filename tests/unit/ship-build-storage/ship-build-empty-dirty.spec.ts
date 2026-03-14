/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { vi } from 'vitest'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'en' },
      t: (key: string) => key
    })
  }
})

import { useShipBuildStore } from '@/store/useShipBuildStore'

const SHIP_ID = 'ship_ter_m_corvette_02_a'

describe('ship-build empty dirty state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('空配装即便修改空白名称也不应 dirty', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(SHIP_ID)
    store.blueprint!.name = 'Draft'

    expect(store.isEmptyForSave()).toBe(true)
    expect(store.isDirty).toBe(false)
  })
})
