import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  ShipBlueprint,
  ShipBlueprintBuildAnalysis,
  ShipBlueprintBuildEntry
} from '@/types/x4'
import type { useShipBuildStore } from '@/store/useShipBuildStore'
import type { useI18n } from 'vue-i18n'

type ShipBuildStore = ReturnType<typeof useShipBuildStore>

export type ShipBuildMaterialsViewMode = 'materials' | 'time'

export interface ShipBuildMaterialsPresenterDeps {
  shipBlueprint: ComputedRef<ShipBlueprint | null>
  materialPriceMultiplier: Ref<number>
  store: ShipBuildStore
  t: ReturnType<typeof useI18n>['t']
  translateShip: (ship: any) => string
  translateWare: (ware: any) => string
  translateEquipment: (equipment: any) => string
  translate: (
    id: string,
    nameId: string,
    category: 'module' | 'ware' | 'type' | 'ship' | 'ship_type' | 'equipment_type' | 'equipment' | 'slot_tag' | 'dlc' | 'faction'
  ) => string
}

export interface ShipBuildMaterialsCard {
  key: string
  title: string
  quantity: number
  totalValue: number
  totalBuildTime: number
  materialItems: ShipBlueprintBuildAnalysis['summaryItems']
}

export function useShipBuildMaterialsPresenter(deps: ShipBuildMaterialsPresenterDeps) {
  const viewMode = ref<ShipBuildMaterialsViewMode>('materials')

  const views = computed(() => [
    { key: 'materials', label: deps.t('ship_build.material_total') },
    { key: 'time', label: deps.t('station.view_time') }
  ])

  const analysis = computed(() => deps.store.getBuildAnalysis(
    deps.shipBlueprint.value,
    deps.materialPriceMultiplier.value
  ))

  const materialMethodOptions = computed(() => analysis.value.methodOptions)

  const materialMethod = computed({
    get: () => analysis.value.selectedMethod,
    set: (value: string) => deps.store.setMaterialMethod(value)
  })

  const getEntryTitle = (entry: ShipBlueprintBuildEntry) => {
    if (entry.kind === 'ship') {
      const ship = deps.store.findShip(entry.entityId)
      return ship ? deps.translateShip(ship) : entry.entityId
    }
    if (entry.kind === 'equipment') {
      const equipment = deps.store.findEquipment(entry.entityId)
      return equipment ? deps.translateEquipment(equipment) : entry.entityId
    }
    if (entry.storageType === 'deployable' || entry.storageType === 'countermeasure') {
      const consumable = deps.store.consumablesMap.get(entry.entityId)
      if (consumable) {
        const ware = deps.store.findWare(consumable.nameId)
        if (ware) return deps.translateWare(ware)
        return deps.translate(consumable.id, consumable.nameId, 'ware')
      }
    }
    if (entry.storageType === 'drone') {
      const drone = deps.store.dronesMap.get(entry.entityId)
      if (drone) {
        const ware = deps.store.findWare(drone.nameId)
        if (ware) return deps.translateWare(ware)
        return deps.translate(drone.id, drone.nameId, 'ware')
      }
    }
    if (entry.storageType === 'missile') {
      const missile = deps.store.missilesMap.get(entry.entityId)
      if (missile) {
        const ware = deps.store.findWare(missile.nameId)
        if (ware) return deps.translateWare(ware)
        return deps.translate(missile.id, missile.nameId, 'ware')
      }
    }
    const ware = deps.store.findWare(entry.entityId)
    if (ware) return deps.translateWare(ware)
    return deps.translate(entry.entityId, entry.entityId, 'ware')
  }

  const cards = computed<ShipBuildMaterialsCard[]>(() => {
    const entryCards = analysis.value.entries.map((entry) => ({
      key: entry.key,
      title: getEntryTitle(entry),
      quantity: entry.quantity,
      totalValue: entry.totalValue,
      totalBuildTime: entry.totalBuildTime,
      materialItems: entry.materialItems
    }))

    const shipCard = entryCards.find((entry) => entry.key.startsWith('ship:')) || null
    const equipmentCards = entryCards
      .filter((entry) => entry.key.startsWith('equipment:'))
      .sort((a, b) => a.title.localeCompare(b.title))
    const storageCards = entryCards.filter((entry) => !entry.key.startsWith('ship:') && !entry.key.startsWith('equipment:'))

    return [
      ...(shipCard ? [shipCard] : []),
      ...equipmentCards,
      ...storageCards
    ]
  })

  const visibleCards = computed(() => {
    if (viewMode.value === 'materials') return cards.value
    return cards.value.filter((card) => card.totalBuildTime > 0)
  })

  return {
    viewMode,
    views,
    analysis,
    materialMethodOptions,
    materialMethod,
    cards,
    visibleCards
  }
}
