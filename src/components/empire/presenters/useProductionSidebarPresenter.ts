import { computed, nextTick, onScopeDispose, reactive, ref, watch } from 'vue'
import type { ProductionTabItem } from '@/types/production-ui'
import type { SaveBindingPlan, StationType } from '@/types/x4'
import { useProductionSidebarStateStore, emptySidebarContext, boundSidebarWidth, type SidebarContextState } from '@/store/useProductionSidebarStateStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useTerraformingStore } from '@/store/useTerraformingStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { SAVE_POI_ICON_MAP } from '@/components/map/utils/style'
import { getPoiIconTag } from '@/store/logic/stationPoiSemantics'
import playerhqIcon from '@/components/icons/playerhq.svg'
import tradeIcon from '@/components/icons/tradestation.svg'
import factoryIcon from '@/components/icons/factory.svg'
import researchIcon from '@/components/icons/tlt_research.svg'
import terraformingIcon from '@/components/icons/tlt_terraforming.svg'
import blueprintIcon from '@/components/icons/blueprint.svg'
import groupIcon from '@/components/icons/sector_group_edit.svg'
import i18n from '@/i18n'

type Station = { id: string; name: string; sectorId?: string | null; type?: StationType; tag?: string; factoryGroup?: string }
interface CommonStore {
  session: { workbenchMode: ProductionTabItem['type']; activeStationId: string | null; activeTransitSectorId: string | null }
  tabSemanticsById: Record<string, { tag?: string; factoryGroup?: string }>
  selectStation(id: string | null): void
  selectTerraforming(): void
  selectResearch(): void
  selectBlueprintRecipe(): void
  deleteStation(id: string): void
}
export type SidebarSource = {
  mode: 'blueprint'
  store: CommonStore & {
    activeEmpire: { id: string } | null
    orderedStations: Station[]
    isDirty: boolean
    createStation(): unknown
    renameStation(id: string, name: string): unknown
    duplicateStation(id: string): unknown
    reorderStations(stations: { id: string }[]): boolean
  }
} | {
  mode: 'live'
  store: CommonStore & {
    activeBinding: SaveBindingPlan | null
    isReady: boolean
    loadedBindingGameGuid: string | null
    sectors: { id: string; name: string }[]
    orderedStationsBySector: Station[]
    supportsNpcTrade: boolean
    autoGroupResult: unknown | null
    needsAutoGroupRecalc: boolean
    selectTransitSector(id: string | null): void
    selectNpcTrade(): void
    selectAutoSectorGroup(): void
    jumpToMapBinding(id: string, type: 'station' | 'transit'): void
    canDeleteStation(id: string): boolean
  }
}
export interface SidebarRow extends ProductionTabItem {
  icon: string
  iconClass: string
  tooltip: string
  testId: string
  active: boolean
  disabled: boolean
  status: string | null
}
export interface SidebarGroup {
  id: string
  name: string
  color: string
  active: boolean
  expanded: boolean
  editable: boolean
  row: SidebarRow
  stations: SidebarRow[]
}
export const SIDEBAR_COLORS = ['#5f6368', '#1a73e8', '#d93025', '#f9ab00', '#188038', '#d01884', '#a142f4', '#007b83', '#fa903e']
export type SidebarMenuAction = 'binding' | 'rename' | 'duplicate' | 'delete' | 'pin'

export function useProductionSidebarPresenter(source: SidebarSource) {
  const prefs = useProductionSidebarStateStore()
  const activeView = useActiveViewStore()
  const bindingStore = useSaveBindingStore()
  const terraforming = useTerraformingStore()
  const gameData = useGameDataStore()
  const t = (key: string) => i18n.global.t(key)
  const query = ref('')
  const expandedTerraforming = ref(false)
  const narrowScreen = ref(false)
  const viewportWidth = ref(1024)
  const drawerOpen = ref(false)
  const temporaryContext = ref(emptySidebarContext())
  const location = ref<{ serial: number; stationId: string | null; scrollTop: number } | null>(null)
  let locationSerial = 0
  let searchSnapshot: SidebarContextState | null = null
  let disposed = false
  const menu = ref<{ id: string; contextId: string | null } | null>(null)
  const pendingDelete = ref<{ id: string; contextId: string | null } | null>(null)
  const feedback = ref<string | null>(null)
  const editor = ref<{ contextId: string; groupKey: string; originalName: string; originalColor: string | undefined; name: string; color: string | undefined; error: string | null } | null>(null)
  const resize = ref<{ pointerId: number; startX: number; originalWidth: number; previewWidth: number } | null>(null)
  const drag = ref<{ contextId: string | null; groupId: string | null; kind: 'stations' | 'groups'; originalIds: string[]; proposedIds: string[] | null } | null>(null)
  const contextId = computed(() => {
    if (source.mode === 'blueprint') return source.store.activeEmpire === null ? null : source.store.activeEmpire.id
    return source.store.activeBinding === null ? null : source.store.activeBinding.gameGuid
  })
  const contextKey = computed(() => contextId.value === null ? `${source.mode}:temporary` : `${source.mode}:${contextId.value}`)
  const loaded = computed(() => {
    if (source.mode === 'blueprint') return source.store.activeEmpire !== null
    return source.store.activeBinding !== null && source.store.isReady && source.store.loadedBindingGameGuid === source.store.activeBinding.gameGuid
  })
  const modeState = computed(() => prefs.state.modes[source.mode])
  const context = computed(() => {
    const saved = prefs.context(source.mode, contextId.value)
    return saved === undefined ? temporaryContext.value : saved
  })
  function writeContext(patch: Partial<SidebarContextState>) {
    if (contextId.value === null) temporaryContext.value = { ...temporaryContext.value, ...patch }
    else prefs.setContext(source.mode, contextId.value, patch)
  }
  const stations = computed(() => {
    if (source.mode === 'blueprint') return source.store.orderedStations
    if (!loaded.value) return []
    return source.store.orderedStationsBySector
  })
  const activeId = computed(() => {
    const session = source.store.session
    if (session.workbenchMode === 'transit') return session.activeTransitSectorId === null ? null : `transit:${session.activeTransitSectorId}`
    if (session.workbenchMode === 'station') return session.activeStationId
    return session.workbenchMode
  })
  const businessGroups = computed(() => source.mode === 'live' ? source.store.sectors : [])
  function groupMetadata(id: string) {
    if (source.mode !== 'live' || source.store.activeBinding === null) return undefined
    return source.store.activeBinding.groups.find(group => group.sectorMacro === id)
  }
  function row(item: ProductionTabItem, groupName?: string): SidebarRow {
    let icon = factoryIcon
    let iconClass = 'icon-green'
    if (item.type === 'station') {
      const tag = getPoiIconTag(item)
      if (tag !== null && tag !== undefined && SAVE_POI_ICON_MAP[tag] !== undefined) icon = SAVE_POI_ICON_MAP[tag]!
    } else if (item.type === 'overview') icon = playerhqIcon
    else if (item.type === 'transit' || item.type === 'npc-trade') { icon = tradeIcon; iconClass = 'icon-orange' }
    else if (item.type === 'terraforming') {
      icon = terraformingIcon
      if (item.temperatureState !== undefined && item.temperatureState > 0) iconClass = `icon-temp-state-${item.temperatureState}`
    } else if (item.type === 'research') icon = researchIcon
    else if (item.type === 'blueprint-recipe') icon = blueprintIcon
    else if (item.type === 'auto-sector-group') icon = groupIcon
    let status: string | null = null
    if (item.type === 'auto-sector-group' && source.mode === 'live' && source.store.needsAutoGroupRecalc) status = t('sidebar.needs_recalc')
    if (item.type === 'overview') {
      if (source.mode === 'blueprint' && source.store.isDirty) status = t('sidebar.unsaved')
      if (source.mode === 'live' && bindingStore.isDirty) status = t('sidebar.unsaved')
    }
    const tooltip = groupName === undefined ? item.name : `${item.name} — ${groupName}`
    return { ...item, icon, iconClass, tooltip: status === null ? tooltip : `${tooltip} — ${status}`, testId: item.type === 'station' ? 'sidebar-station' : `sidebar-${item.type === 'transit' ? 'sector' : item.id}`, active: activeId.value === item.id, disabled: item.type === 'auto-sector-group' && source.mode === 'live' && source.store.autoGroupResult === null, status }
  }
  const stationRows = computed(() => stations.value.map(station => {
    const semantics = source.store.tabSemanticsById[station.id]
    const item: ProductionTabItem = { id: station.id, name: station.name, type: 'station', stationType: station.type }
    if (station.sectorId !== null && station.sectorId !== undefined) item.sectorId = station.sectorId
    if (semantics !== undefined) { item.tag = semantics.tag; item.factoryGroup = semantics.factoryGroup }
    else { item.tag = station.tag; item.factoryGroup = station.factoryGroup }
    if (item.tag === undefined && station.type === 'shipyard') item.tag = 'shipyard'
    if (item.tag === undefined && (station.type === 'supply' || station.type === 'transit')) item.tag = 'tradestation'
    const group = businessGroups.value.find(group => group.id === item.sectorId)
    const metadata = item.sectorId === undefined ? undefined : groupMetadata(item.sectorId)
    const groupName = metadata === undefined ? group?.name : metadata.name
    return row(item, groupName)
  }))
  const fixedItems = computed(() => {
    const items: ProductionTabItem[] = [{ id: 'overview', type: 'overview', name: t('sector.overview') }]
    if (source.mode === 'live' && source.store.supportsNpcTrade) items.push({ id: 'npc-trade', type: 'npc-trade', name: t('npc_trade.label') })
    items.push({ id: 'blueprint-recipe', type: 'blueprint-recipe', name: t('blueprint_recipe.label') }, { id: 'research', type: 'research', name: t('research.label') }, { id: 'terraforming', type: 'terraforming', name: t('moduleNames.terraforming') })
    if (source.mode === 'live') items.push({ id: 'auto-sector-group', type: 'auto-sector-group', name: t('auto_sector.sidebar_label') })
    return items.map(item => row(item))
  })
  const terraformClusters = computed(() => {
    const data = terraforming.terraformingData
    if (data === null) return []
    const temperature = data.stats.find(stat => stat.id === 'temperature')
    return data.clusters.map(cluster => {
      const macro = cluster.macro.replace('macro.', '')
      const mapCluster = gameData.maps.clusters[macro]
      let name = cluster.id
      if (mapCluster !== undefined) {
        if (mapCluster.sectors.length === 1) {
          const sector = gameData.maps.sectors[mapCluster.sectors[0]!]
          if (sector !== undefined) name = t(sector.nameId)
        } else name = t(mapCluster.nameId)
      }
      let temperatureState = 2
      if (temperature !== undefined && cluster.initialStats.temperature !== undefined) {
        const value = cluster.initialStats.temperature
        const range = temperature.ranges.find(range => value >= (range.start === undefined ? 0 : range.start) && value <= range.end)
        if (range !== undefined) temperatureState = range.state
      }
      return { id: cluster.id, name, temperatureState }
    })
  })
  const terraformItems = computed(() => terraformClusters.value.map(cluster => {
    const item = row({ id: `terraforming:${cluster.id}`, type: 'terraforming', name: cluster.name, temperatureState: cluster.temperatureState })
    item.active = source.store.session.workbenchMode === 'terraforming' && terraforming.activePlan?.selectedClusterId === cluster.id
    return item
  }))
  const searching = computed(() => query.value.trim().length > 0)
  const compact = computed(() => !narrowScreen.value && modeState.value.collapsed)
  const canSort = computed(() => !compact.value && !searching.value && loaded.value)
  function ordered<T extends { id: string }>(items: T[], ids: string[]): T[] {
    const byId = new Map(items.map(item => [item.id, item]))
    const result: T[] = []
    for (const id of ids) { const item = byId.get(id); if (item !== undefined) result.push(item) }
    for (const item of items) if (!ids.includes(item.id)) result.push(item)
    return result
  }
  const groups = computed<SidebarGroup[]>(() => {
    const needle = query.value.trim().toLocaleLowerCase()
    return ordered(businessGroups.value, context.value.groupOrder).flatMap(group => {
      const metadata = groupMetadata(group.id)
      const name = metadata === undefined ? group.name : metadata.name
      let members = stationRows.value.filter(station => station.sectorId === group.id)
      if (searching.value && !name.toLocaleLowerCase().includes(needle)) members = members.filter(station => station.name.toLocaleLowerCase().includes(needle))
      if (searching.value && members.length === 0 && !name.toLocaleLowerCase().includes(needle)) return []
      const savedOrder = context.value.stationOrderByGroup[group.id]
      members = ordered(members, savedOrder === undefined ? [] : savedOrder)
      const color = metadata?.color === undefined ? SIDEBAR_COLORS[0]! : metadata.color
      const active = activeId.value === `transit:${group.id}` || stationRows.value.some(station => station.sectorId === group.id && station.active)
      return [{ id: group.id, name, color, active, expanded: searching.value || !context.value.collapsedGroupKeys.includes(group.id), editable: metadata !== undefined, row: row({ id: `transit:${group.id}`, type: 'transit', name, sectorId: group.id }), stations: members }]
    })
  })
  const flatItems = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase()
    return stationRows.value.filter(item => (source.mode === 'blueprint' || item.sectorId === undefined) && (!searching.value || item.name.toLocaleLowerCase().includes(needle)))
  })
  const pinnedItems = computed(() => ordered(stationRows.value.filter(item => context.value.pinnedStationIds.includes(item.id)), context.value.pinnedStationIds))
  const noResults = computed(() => searching.value && groups.value.length === 0 && flatItems.value.length === 0)
  const resizingPointerId = computed(() => resize.value === null ? null : resize.value.pointerId)
  async function locate(stationId: string | null, scrollTop: number) {
    const id = contextId.value
    await nextTick()
    if (!disposed && contextId.value === id) location.value = { serial: ++locationSerial, stationId, scrollTop }
  }
  function setScrollTop(value: number) {
    if (!loaded.value || !Number.isFinite(value)) return
    if (!searching.value) writeContext({ scrollTop: Math.max(0, value) })
  }
  function setQuery(value: string) {
    if (!searching.value && value.trim().length > 0) searchSnapshot = structuredClonePlain(context.value)
    query.value = value
    drag.value = null
    if (!searching.value && searchSnapshot !== null) {
      writeContext({ collapsedGroupKeys: searchSnapshot.collapsedGroupKeys, scrollTop: searchSnapshot.scrollTop })
      void locate(null, searchSnapshot.scrollTop)
      searchSnapshot = null
    }
  }
  function toggleGroup(id: string) {
    if (!businessGroups.value.some(group => group.id === id) || searching.value) return
    const ids = context.value.collapsedGroupKeys
    writeContext({ collapsedGroupKeys: ids.includes(id) ? ids.filter(key => key !== id) : [...ids, id] })
  }
  function toggleCollapsed() {
    resize.value = null
    drag.value = null
    if (narrowScreen.value) drawerOpen.value = !drawerOpen.value
    else prefs.setMode(source.mode, { collapsed: !modeState.value.collapsed })
  }
  function setViewport(width: number) {
    viewportWidth.value = width
    const next = width < 768
    if (next !== narrowScreen.value) { drawerOpen.value = false; resize.value = null; drag.value = null }
    narrowScreen.value = next
  }
  const width = computed(() => {
    if (narrowScreen.value) return Math.min(320, viewportWidth.value - 32)
    if (compact.value) return 64
    if (resize.value !== null) return resize.value.previewWidth
    return modeState.value.expandedWidth
  })
  function toggleTerraforming() { expandedTerraforming.value = !expandedTerraforming.value }
  function select(id: string) {
    const fixed = fixedItems.value.find(item => item.id === id)
    if (fixed !== undefined) {
      if (fixed.disabled) { feedback.value = t('auto_sector.sidebar_disabled'); return }
      if (fixed.type === 'overview') source.store.selectStation(null)
      else if (fixed.type === 'research') source.store.selectResearch()
      else if (fixed.type === 'blueprint-recipe') source.store.selectBlueprintRecipe()
      else if (fixed.type === 'terraforming') { toggleTerraforming(); return }
      else if (source.mode === 'live' && fixed.type === 'npc-trade') source.store.selectNpcTrade()
      else if (source.mode === 'live' && fixed.type === 'auto-sector-group') source.store.selectAutoSectorGroup()
    } else if (id.startsWith('terraforming:')) {
      const clusterId = id.slice('terraforming:'.length)
      if (!terraformClusters.value.some(cluster => cluster.id === clusterId)) { feedback.value = t('sidebar.unavailable'); return }
      source.store.selectTerraforming()
      terraforming.selectCluster(clusterId)
    } else if (source.mode === 'live' && id.startsWith('transit:')) {
      const groupId = id.slice('transit:'.length)
      if (!businessGroups.value.some(group => group.id === groupId)) { feedback.value = t('sidebar.unavailable'); return }
      source.store.selectTransitSector(groupId)
    } else {
      if (!stations.value.some(station => station.id === id)) { feedback.value = t('sidebar.unavailable'); return }
      source.store.selectStation(id)
    }
    drawerOpen.value = false
  }
  const primaryAction = computed(() => source.mode === 'blueprint' ? { label: t('sector.add_station'), testId: 'sidebar-add-station' } : null)
  function runPrimaryAction() {
    if (source.mode !== 'blueprint') return
    source.store.createStation()
    drawerOpen.value = false
  }
  function actionsFor(id: string): { id: SidebarMenuAction; label: string; testId: string }[] {
    if (!stations.value.some(station => station.id === id)) return []
    const actions: SidebarMenuAction[] = source.mode === 'blueprint' ? ['rename', 'duplicate', 'delete', 'pin'] : ['binding', 'pin']
    if (source.mode === 'live' && source.store.canDeleteStation(id)) actions.splice(1, 0, 'delete')
    const labels = { rename: 'sector.rename_station', duplicate: 'sector.duplicate_station', delete: 'sector.delete_station', binding: 'sector.jump_to_binding', pin: context.value.pinnedStationIds.includes(id) ? 'sidebar.unpin' : 'sidebar.pin' }
    return actions.map(action => ({ id: action, label: t(labels[action]), testId: `sidebar-menu-${action === 'binding' ? 'jump-binding' : action}` }))
  }
  function openMenu(id: string) {
    feedback.value = null
    if (actionsFor(id).length === 0) { feedback.value = t('sidebar.unavailable'); return false }
    editor.value = null
    menu.value = { id, contextId: contextId.value }
    return true
  }
  const menuActions = computed(() => menu.value === null ? [] : actionsFor(menu.value.id))
  function runMenuAction(action: SidebarMenuAction) {
    const target = menu.value
    if (target === null) return
    if (target.contextId !== contextId.value || !actionsFor(target.id).some(item => item.id === action)) { feedback.value = t('sidebar.unavailable'); menu.value = null; return }
    if (action === 'delete') pendingDelete.value = target
    else if (action === 'pin') togglePin(target.id)
    else if (source.mode === 'blueprint' && action === 'rename') {
      const station = stations.value.find(station => station.id === target.id)!
      const name = window.prompt(t('sector.rename_station'), station.name)
      if (name !== null && name.trim().length > 0) source.store.renameStation(target.id, name.trim())
    } else if (source.mode === 'blueprint' && action === 'duplicate') source.store.duplicateStation(target.id)
    else if (source.mode === 'live' && action === 'binding') source.store.jumpToMapBinding(target.id, 'station')
    menu.value = null
  }
  function confirmDelete() {
    const target = pendingDelete.value
    pendingDelete.value = null
    if (target === null) return
    if (target.contextId !== contextId.value || !actionsFor(target.id).some(action => action.id === 'delete')) { feedback.value = t('sidebar.unavailable'); return }
    source.store.deleteStation(target.id)
  }
  function togglePin(id: string) {
    if (!stations.value.some(station => station.id === id)) return
    const pins = context.value.pinnedStationIds
    writeContext({ pinnedStationIds: pins.includes(id) ? pins.filter(key => key !== id) : [...pins, id] })
  }
  function openGroupEditor(id: string) {
    const group = groupMetadata(id)
    if (group === undefined || contextId.value === null) { feedback.value = t('sidebar.unavailable'); return false }
    menu.value = null
    editor.value = { contextId: contextId.value, groupKey: id, originalName: group.name, originalColor: group.color, name: group.name, color: group.color, error: null }
    return true
  }
  function applyGroupEditor() {
    const draft = editor.value
    if (draft === null) return false
    if (draft.contextId !== contextId.value || groupMetadata(draft.groupKey) === undefined) { editor.value = null; return false }
    const name = draft.name.trim()
    if (name.length === 0) { draft.error = t('sidebar.empty_name'); return false }
    const saved = bindingStore.updateGroupMetadata(draft.contextId, draft.groupKey, { name: draft.originalName, color: draft.originalColor }, { name, color: draft.color })
    if (!saved) { draft.error = t('sidebar.edit_conflict'); return false }
    editor.value = null
    return true
  }
  const colorOptions = computed(() => {
    const value = editor.value
    const currentColor = value === null || value.color === undefined ? SIDEBAR_COLORS[0]! : value.color
    const options = SIDEBAR_COLORS.map((color, index) => ({ color, label: t(`sidebar.color_${index}`), selected: currentColor.toLowerCase() === color }))
    if (!options.some(option => option.selected)) options.push({ color: currentColor, label: t('sidebar.custom_color'), selected: true })
    return options
  })
  function startResize(pointerId: number, x: number) {
    if (compact.value || narrowScreen.value) return false
    resize.value = { pointerId, startX: x, originalWidth: modeState.value.expandedWidth, previewWidth: modeState.value.expandedWidth }
    return true
  }
  function moveResize(pointerId: number, x: number) {
    if (resize.value === null || resize.value.pointerId !== pointerId) return
    resize.value.previewWidth = boundSidebarWidth(resize.value.originalWidth + x - resize.value.startX)
  }
  function endResize(pointerId: number, commit: boolean) {
    const value = resize.value
    if (value === null || value.pointerId !== pointerId) return
    resize.value = null
    if (commit) prefs.setMode(source.mode, { expandedWidth: value.previewWidth })
  }
  function completePermutation(ids: string[], expected: string[]) {
    return ids.length === expected.length && new Set(ids).size === ids.length && ids.every(id => expected.includes(id))
  }
  function sortableIds(kind: 'stations' | 'groups', groupId: string | null) {
    if (kind === 'groups') return businessGroups.value.map(group => group.id)
    if (source.mode === 'blueprint') return stations.value.map(station => station.id)
    return stations.value.filter(station => groupId === null ? station.sectorId === null || station.sectorId === undefined : station.sectorId === groupId).map(station => station.id)
  }
  function startSort(kind: 'stations' | 'groups', groupId: string | null) {
    if (!canSort.value || (kind === 'groups' && source.mode !== 'live')) return false
    drag.value = { contextId: contextId.value, kind, groupId, originalIds: sortableIds(kind, groupId), proposedIds: null }
    return true
  }
  function proposeSort(ids: string[]) {
    if (drag.value !== null) drag.value.proposedIds = [...ids]
  }
  function endSort(validRelease: boolean) {
    const session = drag.value
    drag.value = null
    if (session === null || !validRelease || !canSort.value || session.contextId !== contextId.value || session.proposedIds === null) return false
    const expected = sortableIds(session.kind, session.groupId)
    if (!completePermutation(expected, session.originalIds) || !completePermutation(session.proposedIds, expected)) return false
    if (source.mode === 'blueprint') return source.store.reorderStations(session.proposedIds.map(id => ({ id })))
    if (session.kind === 'groups') writeContext({ groupOrder: session.proposedIds })
    else if (session.groupId !== null) writeContext({ stationOrderByGroup: { ...context.value.stationOrderByGroup, [session.groupId]: session.proposedIds } })
    else return false
    return true
  }
  function closeOverlays() { menu.value = null; editor.value = null }
  function resetTransient() {
    query.value = ''; searchSnapshot = null; closeOverlays(); pendingDelete.value = null; resize.value = null; drag.value = null; feedback.value = null; drawerOpen.value = false
  }
  function reconcile() {
    if (!loaded.value) return
    if (prefs.context(source.mode, contextId.value) === undefined) {
      const selectedGroup = stationRows.value.find(station => station.active)?.sectorId
      const collapsed = businessGroups.value.map(group => group.id).filter(id => id !== selectedGroup && activeId.value !== `transit:${id}`)
      writeContext({ collapsedGroupKeys: collapsed })
      void locate(activeId.value, 0)
    }
    prefs.reconcile(source.mode, contextId.value, loaded.value, businessGroups.value.map(group => ({ id: group.id, stationIds: stations.value.filter(station => station.sectorId === group.id).map(station => station.id) })), stations.value.map(station => station.id))
  }
  watch(contextId, () => {
    resetTransient(); temporaryContext.value = emptySidebarContext(); location.value = null
  }, { immediate: true, flush: 'sync' })
  watch([contextId, loaded], () => {
    if (!loaded.value) return
    const saved = prefs.context(source.mode, contextId.value)
    if (saved !== undefined) void locate(null, saved.scrollTop)
  }, { immediate: true })
  watch([contextId, loaded, () => stations.value.map(station => [station.id, station.sectorId]), () => businessGroups.value.map(group => group.id)], reconcile, { immediate: true })
  watch(() => terraforming.activePlan?.selectedClusterId, id => { if (id !== null && id !== undefined) expandedTerraforming.value = true }, { immediate: true })
  watch(() => editor.value === null ? true : groupMetadata(editor.value.groupKey) !== undefined, exists => { if (!exists) editor.value = null })
  watch([() => activeView.productionNavigation, loaded, contextId], () => {
    const navigation = activeView.productionNavigation
    if (navigation === null || navigation.mode !== source.mode || navigation.contextId !== contextId.value || !loaded.value) return
    activeView.consumeProductionNavigation(navigation.token)
    const station = stations.value.find(station => station.id === navigation.stationId)
    const group = businessGroups.value.find(group => `transit:${group.id}` === navigation.stationId)
    if (station === undefined && group === undefined) return
    setQuery('')
    let groupId: string | undefined
    if (station !== undefined && station.sectorId !== null) groupId = station.sectorId
    if (group !== undefined) groupId = group.id
    if (groupId !== undefined) writeContext({ collapsedGroupKeys: context.value.collapsedGroupKeys.filter(key => key !== groupId) })
    void locate(navigation.stationId, context.value.scrollTop)
  }, { immediate: true })
  onScopeDispose(() => { disposed = true; resetTransient() })
  return reactive({
    mode: source.mode, contextKey, fixedItems, terraformItems, expandedTerraforming, terraformGroupColor: '#3b82f6', flatItems, groups, pinnedItems,
    activeId, compact, narrowScreen, drawerOpen, width, searching, query, noResults, canSort, resizingPointerId,
    primaryAction, menu, menuActions, pendingDelete, feedback, editor, colorOptions, location,
    setQuery, setScrollTop, toggleGroup, toggleTerraforming, toggleCollapsed, setViewport, select, runPrimaryAction,
    openMenu, runMenuAction, confirmDelete, togglePin, openGroupEditor, applyGroupEditor,
    startResize, moveResize, endResize, startSort, proposeSort, endSort, closeOverlays,
    cancelDelete: () => { pendingDelete.value = null },
    cancelInteraction: () => { resize.value = null; drag.value = null }
  })
}
function structuredClonePlain(context: SidebarContextState): SidebarContextState {
  return JSON.parse(JSON.stringify(context)) as SidebarContextState
}
export type ProductionSidebarPresenter = ReturnType<typeof useProductionSidebarPresenter>
