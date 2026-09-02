import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { getLogicFlowGroupDisplayName } from '@/store/logic/logicFlowGroupName'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useTitleEditor } from '@/composables/useTitleEditor'
import { useToolbarWorkflowController } from '@/composables/useToolbarWorkflowController'

type CandidateCategory = 'industrial' | 'agricultural'

export interface LogicFlowCandidateWare {
  id: string
  tier: number
  label: string
  isRawMaterial: boolean
  isSelectable: boolean
  isPlanned: boolean
  isSearchMatch: boolean
  resourceIds: string[]
  compressionRate?: number
}

export function useLogicFlowCandidatePresenter() {
  const { t } = useI18n()
  const { translateShip } = useX4I18n()
  const gameData = useGameDataStore()
  const logicFlow = useLogicFlowStore()
  const toolbarWorkflow = useToolbarWorkflowController({ t, translateShip })
  const activeCategory = ref<CandidateCategory>('industrial')
  const activeSubCategory = ref('default')
  const activeMenuWareId = ref<string | null>(null)
  const menuPosition = ref({ x: 0, y: 0 })

  const titleEditor = useTitleEditor(computed(() => ({
    getName: () => logicFlow.currentPlanName,
    setName: (name: string) => { logicFlow.currentPlanName = name },
    getDefaultName: () => toolbarWorkflow.getDefaultName('logicFlow'),
  })))

  const searchQuery = computed({
    get: () => gameData.searchQuery,
    set: (value: string) => { gameData.searchQuery = value },
  })
  const isDefaultLocked = computed({
    get: () => logicFlow.isDefaultLocked,
    set: (value: boolean) => { logicFlow.isDefaultLocked = value },
  })
  const categoryOptions = computed(() => [
    { id: 'industrial' as const, label: t('ui.industrial') },
    { id: 'agricultural' as const, label: t('ui.agricultural') },
  ])
  const subCategoryOptions = computed(() => {
    const ids = activeCategory.value === 'industrial'
      ? ['default', 'terran', 'teladi', 'recycling']
      : ['argon', 'boron', 'paranid', 'split', 'teladi', 'terran']
    return ids.map(id => ({
      id,
      label: id === 'recycling' ? t('logicFlow.recycling') : t(`race.${id}`),
    }))
  })
  const canDefaultLock = computed(() => activeSubCategory.value !== 'recycling')
  const defaultLockLabel = computed(() => {
    if (!canDefaultLock.value) return t('logicFlow.recycling')
    return isDefaultLocked.value ? t(`race.${activeSubCategory.value}`) : t('logicFlow.unlock')
  })
  const groupCount = computed(() => logicFlow.groups.length)

  function isCandidateSelectable(wareId: string) {
    const ware = gameData.waresMap[wareId]
    if (!ware || ware.tier === null || gameData.isRawMaterialWare(wareId)) return false
    return activeSubCategory.value !== 'recycling' || ware.tier > 0
  }

  const waresByTier = computed<Record<number, LogicFlowCandidateWare[]>>(() => {
    const result: Record<number, LogicFlowCandidateWare[]> = { 0: [], 1: [], 2: [], 3: [] }
    const currentWareSet = activeCategory.value === 'industrial'
      ? gameData.wareSetsByIndustrialRace[activeSubCategory.value]
      : gameData.wareSetsByRace[activeSubCategory.value]
    if (!currentWareSet) return result

    const query = searchQuery.value.toLowerCase()
    const wares = Object.values(gameData.waresMap)
      .filter(ware => currentWareSet.has(ware.id) && ware.tier !== null)
      .map(ware => {
        const label = gameData.getWareDisplayName(ware.id)
        const isRawMaterial = gameData.isRawMaterialWare(ware.id)
        let module = null
        if (activeSubCategory.value === 'recycling') {
          if (ware.tier === 1) module = gameData.findModuleForWare(ware.id, 'default')
          if (ware.tier !== null && ware.tier > 1) module = gameData.findRecyclingModuleForWare(ware.id)
        } else {
          module = gameData.findModuleForWare(ware.id, activeSubCategory.value)
        }
        return {
          id: ware.id,
          tier: ware.tier!,
          label,
          isRawMaterial,
          isSelectable: isCandidateSelectable(ware.id),
          isPlanned: logicFlow.isWareInAnyGroup(ware.id),
          isSearchMatch: query.length > 0 && (
            ware.id.toLowerCase().includes(query)
            || ware.name.toLowerCase().includes(query)
            || label.toLowerCase().includes(query)
          ),
          resourceIds: isRawMaterial
            ? []
            : Object.keys(logicFlow.calculateRequiredRawMaterials(
                ware.id,
                activeSubCategory.value,
                activeSubCategory.value,
              )).sort(),
          compressionRate: gameData.getModuleVolumeCompression(module?.id),
        }
      })
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier
        if (a.tier === 0 && a.isRawMaterial !== b.isRawMaterial) return a.isRawMaterial ? -1 : 1
        if (a.isPlanned !== b.isPlanned) return a.isPlanned ? -1 : 1
        return a.id.localeCompare(b.id)
      })

    wares.forEach(ware => result[ware.tier]?.push(ware))
    return result
  })
  const tierColumns = computed(() => [0, 1, 2, 3].map(tier => ({
    tier,
    wares: waresByTier.value[tier]!,
  })))

  function switchCategory(category: CandidateCategory) {
    activeCategory.value = category
    activeSubCategory.value = category === 'industrial' ? 'default' : 'argon'
  }

  function setSubCategory(subCategory: string) {
    activeSubCategory.value = subCategory
  }

  function startDrag(event: { item: { getAttribute(name: string): string | null } }) {
    const wareId = event.item.getAttribute('data-ware-id')
    if (!wareId) return
    const gameWare = gameData.waresMap[wareId]
    if (!gameWare || gameWare.tier === null) {
      logicFlow.stopDragging()
      return
    }
    const ware = waresByTier.value[gameWare.tier]?.find(item => item.id === wareId)
    if (!ware || !ware.isSelectable) {
      logicFlow.stopDragging()
      return
    }
    logicFlow.startDragging(wareId, activeSubCategory.value)
  }

  function stopDrag() {
    logicFlow.stopDragging()
  }

  function quickAdd(wareId: string) {
    if (!isCandidateSelectable(wareId)) return
    const group = logicFlow.addGroup(
      activeCategory.value,
      activeSubCategory.value,
      undefined,
      logicFlow.isDefaultLocked,
    )
    logicFlow.expandUpstream(group.id, wareId, 'manual', activeSubCategory.value)
    activeMenuWareId.value = null
  }

  function groupOptions(wareId: string) {
    return logicFlow.groups.map(group => {
      let lineage = activeSubCategory.value
      if (group.isLocked) lineage = group.lockedLineage
      return {
        id: group.id,
        label: getLogicFlowGroupDisplayName(group, gameData.getWareDisplayName),
        status: logicFlow.getWareGroupStatus(group.id, wareId, lineage),
        lockedLabel: group.isLocked ? t(`race.${group.lockedLineage}`) : '',
      }
    })
  }

  function addToGroup(groupId: string, wareId: string) {
    const group = logicFlow.groups.find(candidate => candidate.id === groupId)
    if (!group) return
    let lineage = activeSubCategory.value
    if (group.isLocked) lineage = group.lockedLineage
    const status = logicFlow.getWareGroupStatus(groupId, wareId, lineage)
    if (status === 'rejected' || status === 'duplicated') return
    if (status === 'isolated') {
      logicFlow.connectAndExpand(groupId, wareId, lineage)
    } else if (status === 'auto') {
      const node = group.nodes.find(candidate => candidate.wareId === wareId)
      if (node) logicFlow.promoteNode(groupId, node.id)
    } else if (status === 'replace') {
      logicFlow.replaceNodeWithLineage(groupId, wareId, lineage)
    } else {
      logicFlow.expandUpstream(groupId, wareId, 'manual', lineage)
    }
    activeMenuWareId.value = null
  }

  function toggleMenu(event: MouseEvent, wareId: string) {
    if (activeMenuWareId.value === wareId) {
      activeMenuWareId.value = null
      return
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const menuWidth = 192
    let x = rect.right + 8
    if (x + menuWidth > window.innerWidth) x = rect.left - menuWidth - 8
    menuPosition.value = { x, y: rect.top }
    activeMenuWareId.value = wareId
  }

  function clearAll() {
    if (confirm('确定要清空所有产线组吗？此操作不可撤销。')) logicFlow.clearAllGroups()
  }

  function addWare(ware: { id: string }) {
    quickAdd(ware.id)
  }

  function closeMenu() {
    activeMenuWareId.value = null
  }

  onMounted(() => window.addEventListener('click', closeMenu))
  onUnmounted(() => window.removeEventListener('click', closeMenu))

  return {
    t,
    activeCategory,
    activeSubCategory,
    activeMenuWareId,
    menuPosition,
    searchQuery,
    isDefaultLocked,
    categoryOptions,
    subCategoryOptions,
    canDefaultLock,
    defaultLockLabel,
    groupCount,
    tierColumns,
    isEditingTitle: titleEditor.isEditing,
    titleInputRef: titleEditor.inputRef,
    displayTitle: titleEditor.displayTitle,
    editingValue: titleEditor.editingValue,
    startEditingTitle: titleEditor.startEditing,
    finishEditingTitle: titleEditor.cancelEditing,
    confirmEditingTitle: titleEditor.confirmEditing,
    switchCategory,
    setSubCategory,
    startDrag,
    stopDrag,
    quickAdd,
    groupOptions,
    addToGroup,
    toggleMenu,
    clearAll,
    addWare,
  }
}
