import { describe, expect, it } from 'vitest'
import { hasBindingGroupOrderChanged } from '@/components/empire/presenters/autoSectorGroupDirty'

describe('auto sector group dirty comparison', () => {
  it('detects reordered groups as a saveable change', () => {
    const resultGroups = [
      { id: 'sector_a_macro', sectorMacro: 'sector_a_macro' },
      { id: 'sector_b_macro', sectorMacro: 'sector_b_macro' },
      { id: 'sector_c_macro', sectorMacro: 'sector_c_macro' }
    ]
    const bindingGroups = [
      { sectorMacro: 'sector_b_macro' },
      { sectorMacro: 'sector_a_macro' },
      { sectorMacro: 'sector_c_macro' }
    ]

    expect(hasBindingGroupOrderChanged(resultGroups, bindingGroups)).toBe(true)
  })

  it('keeps matching group order clean', () => {
    const resultGroups = [
      { id: 'sector_a_macro', sectorMacro: 'sector_a_macro' },
      { id: 'sector_b_macro', sectorMacro: 'sector_b_macro' }
    ]
    const bindingGroups = [
      { sectorMacro: 'sector_a_macro' },
      { sectorMacro: 'sector_b_macro' }
    ]

    expect(hasBindingGroupOrderChanged(resultGroups, bindingGroups)).toBe(false)
  })
})
