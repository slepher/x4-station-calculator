import { describe, expect, it } from 'vitest'
import { presentMapSaveAddressGroup } from '@/components/map/presenters/useMapSavePanelPresenter'
import type { X4Map } from '@/types/x4'

const maps: X4Map = {
  clusters: {
    cluster_401_macro: {
      id: 'cluster_401_macro',
      nameId: '{20003,4010001}',
      name: 'Family Zhin',
      dlc_tag: 'dlc_split',
      owner: 'split',
      owner_color: '#B36100',
      sectors: ['cluster_401_sector001_macro']
    },
    cluster_01_macro: {
      id: 'cluster_01_macro',
      nameId: '{20003,10001}',
      name: 'Grand Exchange',
      dlc_tag: 'base',
      owner: 'teladi',
      owner_color: '#B3B300',
      sectors: ['cluster_01_sector001_macro']
    }
  },
  sectors: {
    cluster_401_sector001_macro: {
      id: 'cluster_401_sector001_macro',
      cluster_id: 'cluster_401_macro',
      nameId: '{20004,4010011}',
      name: 'Family Zhin',
      owner: 'split',
      owner_color: '#B36100'
    },
    cluster_01_sector001_macro: {
      id: 'cluster_01_sector001_macro',
      cluster_id: 'cluster_01_macro',
      nameId: '{20004,10011}',
      name: 'Grand Exchange I',
      owner: 'teladi',
      owner_color: '#B3B300'
    }
  }
}

describe('map save panel presenter', () => {
  it('marks a Split address inactive while keeping a base address active', () => {
    const dlcState = {
      maps,
      enforceDlcActivation: true,
      isDlcActive: (dlcTag: string) => dlcTag === 'base'
    }

    const splitGroup = presentMapSaveAddressGroup(
      { sectorMacro: 'cluster_401_sector001_macro' },
      dlcState
    )
    const baseGroup = presentMapSaveAddressGroup(
      { sectorMacro: 'cluster_01_sector001_macro' },
      dlcState
    )

    expect(splitGroup.isAddressInactive).toBe(true)
    expect(baseGroup.isAddressInactive).toBe(false)
  })
})
