import { computed, ref, type Ref } from 'vue'
import i18n from '@/i18n'
import type { X4ResearchItem, X4ResearchData, X4Ware, X4Map, X4Ship, X4Dlc } from '@/types/x4'
import type { LocalizedX4Ware } from '@/store/logic/useGameData'
import { buildResearchLayoutGroups } from '@/components/empire/researchLayout'
import type { LayoutNode, LayoutRow } from '@/components/empire/researchLayout'

export function useResearchPresenter(store: {
  researchData: Ref<X4ResearchData | null>
  waresMap: Ref<Record<string, X4Ware>>
  localizedWaresMap: Ref<Record<string, LocalizedX4Ware>>
  ships: Ref<X4Ship[]>
  maps: Ref<X4Map | null>
  dlcs: Ref<X4Dlc[]>
}) {
  const t = i18n.global.t.bind(i18n.global)
  const showConditional = ref(false)
  const selectedItemId = ref<string | null>(null)

  const filteredItems = computed<X4ResearchItem[]>(() => {
    const data = store.researchData.value
    if (!data) return []
    return data.items.filter(item => {
      if (item.category === 'mission_progress') return false
      if (item.category === 'abandoned') return false
      if (item.category === 'conditional') return showConditional.value
      return true
    })
  })

  const itemMap = computed(() => {
    const map = new Map<string, X4ResearchItem>()
    filteredItems.value.forEach(item => map.set(item.id, item))
    return map
  })

  const layoutGroups = computed(() => buildResearchLayoutGroups(filteredItems.value))

  const selectedItem = computed(() => {
    if (!selectedItemId.value) return null
    return itemMap.value.get(selectedItemId.value) ?? null
  })

  function displayName(item: X4ResearchItem): string {
    return t(item.nameId)
  }

  function displayDesc(item: X4ResearchItem): string {
    return item.descriptionId ? t(item.descriptionId) : ''
  }

  function computeCostCr(item: X4ResearchItem): number {
    let total = 0
    for (const [wareId, amount] of Object.entries(item.cost)) {
      const ware = store.waresMap.value[wareId]
      if (ware && ware.maxPrice) {
        total += ware.maxPrice * amount
      }
    }
    return total
  }

  function formatCr(value: number): string {
    if (value >= 1e6) return (value / 1e6).toFixed(1) + ' MCr'
    if (value >= 1e3) return (value / 1e3).toFixed(1) + ' kCr'
    return value + ' Cr'
  }

  function resolveWareName(wareId: string): string {
    const locWare = store.localizedWaresMap.value[wareId]
    if (locWare && locWare.nameId) return t(locWare.nameId)
    return wareId
  }

  function resolveDlcName(dlcTag: string): string {
    if (dlcTag === 'base') return ''
    const dlc = store.dlcs.value.find(d => d.id === `ego_${dlcTag}`)
    if (dlc && dlc.nameId) return t(dlc.nameId)
    return ''
  }

  function getMissionProgressNotes(item: X4ResearchItem): string[] {
    const data = store.researchData.value
    if (!data) return []
    const notes: string[] = []
    for (const depId of item.dependencies) {
      const dep = data.items.find(i => i.id === depId)
      if (dep && dep.category === 'mission_progress') {
        notes.push(displayName(dep))
      }
    }
    return notes
  }

  function getMissionProgressTooltip(item: X4ResearchItem): string {
    const notes = getMissionProgressNotes(item)
    if (!notes.length) return ''
    return `${t('research.note.mission_progress')}:\n${notes.join('\n')}`
  }

  function getItemDependencies(item: X4ResearchItem): X4ResearchItem[] {
    return item.dependencies
      .map(id => itemMap.value.get(id))
      .filter(Boolean) as X4ResearchItem[]
  }

  function resolveUnlockText(unlock: NonNullable<X4ResearchItem['unlock']>): string {
    const p = unlock.params
    const ship = p?.shipNameId ? t(p.shipNameId) : ''
    const sector = p?.sectorNameId ? t(p.sectorNameId) : ''
    const item = p?.itemNameId ? t(p.itemNameId) : ''
    const npc = p?.npcNameId ? t(p.npcNameId) : ''
    const count = p?.count ? String(p.count) : ''

    if (unlock.key === 'abandoned_ship') {
      if (ship && sector) return t('research.unlock.abandoned_ship', { ship, sector })
      if (ship) return t('research.unlock.abandoned_ship_nosector', { ship })
    }
    if (unlock.key === 'erlking') {
      if (ship && sector) return t('research.unlock.erlking', { ship, sector })
    }
    if (unlock.key === 'condensate_sample') {
      if (npc && item) return t('research.unlock.condensate_sample', { npc, item })
    }
    if (unlock.key === 'xen_equipment') {
      if (item) return t('research.unlock.xen_equipment', { item })
    }
    if (unlock.key === 'interference_network') {
      if (count) return t('research.unlock.interference_network', { count })
    }
    return t(`research.unlock.${unlock.key}`)
  }

  function makeLayers(row: LayoutRow): LayoutNode[][] {
    const layerMap = new Map<number, LayoutNode[]>()
    for (const ln of row.nodes) {
      const arr = layerMap.get(ln.layer) || []
      arr.push(ln)
      layerMap.set(ln.layer, arr)
    }
    const result: LayoutNode[][] = []
    for (let i = 0; ; i++) {
      const layer = layerMap.get(i)
      if (!layer) break
      result.push(layer)
    }
    return result
  }

  return {
    showConditional,
    selectedItemId,
    filteredItems,
    itemMap,
    layoutGroups,
    selectedItem,
    displayName,
    displayDesc,
    computeCostCr,
    formatCr,
    resolveWareName,
    resolveDlcName,
    getMissionProgressNotes,
    getMissionProgressTooltip,
    getItemDependencies,
    resolveUnlockText,
    makeLayers,
    t,
  }
}
