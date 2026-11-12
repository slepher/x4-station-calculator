import type { SmartSaveStep, SmartSaveDialogContext } from '@/utils/smartSavePolicy'
import { computed, ref, watch } from 'vue'
import { useShipBuildStore, type ShipBuildSide } from '@/store/useShipBuildStore'
import type { FitMode } from '../fitTypes'
import i18n from '@/i18n'

export type ShipPickerTarget = { key: string; size: string; tags: string[]; count: number; totalCount: number; connectionKeys: string[] }
const instances = new WeakMap<ReturnType<typeof useShipBuildStore>, ReturnType<typeof createPresenter>>()

function createPresenter(store: ReturnType<typeof useShipBuildStore>) {
  const activeSide = ref<ShipBuildSide>('A')
  const pickerSide = ref<ShipBuildSide | null>(null)
  const pickerTarget = ref<ShipPickerTarget | null>(null)
  const pickerMode = ref<FitMode>('connection')
  const highlightedEquipmentId = ref<string | null>(null)
  const currentSlotType = ref('')
  const currentEquipmentId = ref<string | null>(null)
  const currentIsShield = ref(false)
  const selectingShip = ref<ShipBuildSide | null>(null)
  const statsMode = ref('summary')
  const naming = ref<{ side: ShipBuildSide; sessionId: string; name: string; after: (() => void) | null } | null>(null)
  const protection = ref<{ side: ShipBuildSide; sessionId: string; action: string } | null>(null)
  const error = ref('')
  const deletion = ref<{ side: ShipBuildSide; sessionId: string; id: string; name: string } | null>(null)
  let pending: (() => void) | null = null
  let cancelPending: (() => void) | null = null
  const compare = computed(() => store.getPlan('B') !== null)
  const locked = computed(() => pickerSide.value !== null || naming.value !== null || protection.value !== null || deletion.value !== null)
  const blueprintA = computed(() => store.getPlan('A')!.blueprint)
  const blueprintB = computed(() => {
    const plan = store.getPlan('B')
    return plan === null ? null : plan.blueprint
  })
  const selectedShip = computed(() => blueprintA.value === null ? null : store.findShip(blueprintA.value.shipId))
  const pickerShip = computed(() => {
    if (pickerSide.value === null) return null
    const plan = store.getPlan(pickerSide.value)
    if (!plan || !plan.blueprint) return null
    return store.findShip(plan.blueprint.shipId)
  })
  const preview = computed(() => {
    if (pickerSide.value === null || pickerTarget.value === null) return null
    return store.buildPreviewBlueprint({ connectionKeys: pickerTarget.value.connectionKeys,
      equipmentId: highlightedEquipmentId.value, mode: pickerMode.value,
      targetCount: pickerMode.value === 'group' ? pickerTarget.value.totalCount : undefined }, pickerSide.value)
  })
  const displayA = computed(() => pickerSide.value === 'A' && preview.value !== null ? preview.value : blueprintA.value)
  const displayB = computed(() => pickerSide.value === 'B' && preview.value !== null ? preview.value : blueprintB.value)
  const editingBlueprint = computed(() => pickerSide.value === 'B' ? blueprintB.value : blueprintA.value)
  const columns = computed(() => {
    if (!compare.value) return pickerSide.value === null ? ['A', 'stats', 'materials'] : ['A', 'picker', 'stats']
    if (pickerSide.value === 'A') return ['A', 'picker', 'stats']
    if (pickerSide.value === 'B') return ['stats', 'picker', 'B']
    return ['A', 'stats', 'B']
  })
  const activate = (side: ShipBuildSide) => {
    if (locked.value || store.getPlan(side) === null) return false
    activeSide.value = side
    return true
  }
  const openComparison = () => {
    if (locked.value || !store.openComparison()) return false
    activeSide.value = 'A'
    return true
  }
  const openPicker = (side: ShipBuildSide, slot: string, equipmentId: string | null, shield: boolean) => {
    if (naming.value !== null || protection.value !== null || deletion.value !== null) return false
    if (pickerSide.value !== null && pickerSide.value !== side) return false
    if (pickerSide.value === null && !activate(side)) return false
    pickerSide.value = side
    currentSlotType.value = slot
    currentEquipmentId.value = equipmentId
    currentIsShield.value = shield
    highlightedEquipmentId.value = equipmentId
    return true
  }
  const closePicker = () => { pickerSide.value = null; pickerTarget.value = null; highlightedEquipmentId.value = null }
  watch(compare, value => {
    if (!value) { activeSide.value = 'A'; closePicker(); selectingShip.value = null }
  })
  const confirmPicker = () => {
    if (pickerSide.value === null || pickerTarget.value === null) return false
    const applied = store.applyTargetAssignment({ connectionKeys: pickerTarget.value.connectionKeys,
      equipmentId: highlightedEquipmentId.value, mode: pickerMode.value,
      targetCount: pickerMode.value === 'group' ? pickerTarget.value.totalCount : undefined }, pickerSide.value)
    if (!applied) return false
    closePicker()
    return true
  }
  const save = (side: ShipBuildSide, saveAs = false, after: (() => void) | null = null) => {
    if (pickerSide.value !== null || naming.value !== null || deletion.value !== null) return false
    const plan = store.getPlan(side)
    if (!plan || !plan.blueprint) return false
    error.value = ''
    if (saveAs || store.planRequiresSaveAs(side)) {
      naming.value = { side, sessionId: plan.sessionId, name: plan.blueprint.name, after }
      return false
    }
    const result = store.savePlan(side, undefined, plan.sessionId)
    if (result !== 'saved') { error.value = i18n.global.t('shipCompare.save_failed'); return false }
    if (after) after()
    return true
  }
  const submitName = () => {
    const dialog = naming.value
    if (!dialog) return false
    const result = store.savePlan(dialog.side, dialog.name, dialog.sessionId)
    if (result !== 'saved') { error.value = i18n.global.t('shipCompare.save_failed'); return false }
    naming.value = null
    error.value = ''
    if (dialog.after) dialog.after()
    return true
  }
  const cancel = () => {
    naming.value = null; protection.value = null; pending = null; error.value = ''
    if (cancelPending) cancelPending()
    cancelPending = null
  }
  const guard = (sides: ShipBuildSide[], action: string, done: () => void, cancelled: (() => void) | null = null) => {
    if (locked.value) return false
    error.value = ''
    cancelPending = cancelled
    const next = () => {
      const side = sides.shift()
      if (side === undefined) { pending = null; protection.value = null; cancelPending = null; done(); return }
      if (!store.isPlanDirty(side)) { next(); return }
      protection.value = { side, sessionId: store.getPlan(side)!.sessionId, action }
      pending = next
    }
    next()
    return true
  }
  const discard = () => {
    const next = pending
    protection.value = null
    if (next) next()
  }
  const saveProtected = () => {
    if (!protection.value) return false
    return save(protection.value.side, false, discard)
  }
  const exit = (keep: ShipBuildSide) => {
    if (!compare.value) return false
    return guard([keep === 'A' ? 'B' : 'A'], 'exit', () => {
      store.closeComparison(keep); activeSide.value = 'A'; selectingShip.value = null
    })
  }
  const openShipSelection = (side: ShipBuildSide = 'B') => {
    if (locked.value || store.getPlan(side) === null) return false
    selectingShip.value = side
    return true
  }
  const cancelShipSelection = () => { selectingShip.value = null }
  const chooseShip = (id: string) => {
    const side = selectingShip.value
    if (locked.value || side === null || !store.findShip(id) || !store.isShipDlcUsable(id)) return false
    if (store.getPlan(side)?.blueprint?.shipId === id) { selectingShip.value = null; return true }
    selectingShip.value = null
    return guard([side], 'replace', () => {
      if (!store.replacePlanShip(side, id)) error.value = i18n.global.t('shipCompare.invalid_candidate')
    })
  }
  const guardSession = (action: string, done: () => void) => guard(compare.value ? ['A', 'B'] : ['A'], action, done)
  const prepareSessionChange = () => new Promise<boolean>(resolve => {
    if (!guard(compare.value ? ['A', 'B'] : ['A'], 'leave', () => resolve(true), () => resolve(false))) resolve(false)
  })
  const resetComparison = () => {
    if (compare.value) store.closeComparison('A')
    activeSide.value = 'A'
  }
  const newPlan = () => guardSession('new', () => { resetComparison(); store.clearLoadoutForCurrentShip() })
  const loadPlan = (id: string, side: ShipBuildSide = 'A') => {
    if (locked.value || store.getPlan(side) === null) return false
    if (store.isBuiltInBlueprintId(id)) return store.loadPlanPreset(side, id)
    const other = store.getPlan(side === 'A' ? 'B' : 'A')
    if (other !== null && other.saveTargetId === id) return false
    if (!store.findBlueprintById(id)) return false
    return guard([side], 'load', () => {
      if (side === 'B') store.replaceComparisonBlueprint(id)
      else store.loadBlueprint(id)
    })
  }
  const changeShip = () => openShipSelection('A')
  const requestDelete = (side: ShipBuildSide, id: string) => {
    if (locked.value || store.isBuiltInBlueprintId(id)) return false
    const plan = store.getPlan(side)
    const record = store.findBlueprintById(id)
    const other = store.getPlan(side === 'A' ? 'B' : 'A')
    if (plan === null || record === null || other?.saveTargetId === id) return false
    error.value = ''
    deletion.value = { side, sessionId: plan.sessionId, id, name: record.name }
    return true
  }
  const cancelDelete = () => { deletion.value = null; error.value = '' }
  const confirmDelete = () => {
    const target = deletion.value
    if (target === null) return
    if (store.getPlan(target.side)?.sessionId !== target.sessionId) { cancelDelete(); return }
    store.deleteBlueprint(target.id, target.side)
    if (store.findBlueprintById(target.id) !== null) {
      error.value = i18n.global.t('shipCompare.delete_failed')
      return
    }
    cancelDelete()
  }
  const saveLabel = computed(() => i18n.global.t('menu.save'))
  const sideLabel = (side: ShipBuildSide) => i18n.global.t(side === 'A' ? 'shipCompare.left_plan' : 'shipCompare.right_plan')
  const protectionLabel = computed(() => {
    if (protection.value === null) return ''
    const side = protection.value.side
    const plan = store.getPlan(side)
    const name = plan === null || plan.blueprint === null ? '' : plan.blueprint.name
    const label = name === '' ? sideLabel(side) : i18n.global.t('shipCompare.plan_identity', { side: sideLabel(side), name })
    return i18n.global.t(`shipCompare.protect_${protection.value.action}`, { side: label })
  })
  const getDefaultName = (side: ShipBuildSide) => {
    const status = store.getPlanStatusLabel(side)
    const base = status === '' ? i18n.global.t('shipBuild.built_in_empty') : status.replace(/\s+\d+$/, '')
    const names = new Set(store.savedBlueprints.ships.flatMap(bucket => bucket.blueprints.map(blueprint => blueprint.name)))
    names.add(status)
    let number = 1
    while (names.has(`${base} ${number}`)) number += 1
    return `${base} ${number}`
  }
  const saveDialog = computed<{ intent: 'NEW' | 'SAVE_AS'; initialName: string; context: SmartSaveDialogContext } | null>(() => {
    const target = naming.value === null ? protection.value : naming.value
    if (target === null) return null
    const plan = store.getPlan(target.side)
    const name = plan === null || plan.blueprint === null ? '' : plan.blueprint.name
    const isNaming = naming.value !== null
    return {
      intent: isNaming ? 'SAVE_AS' : 'NEW',
      initialName: name === '' || !store.planRequiresSaveAs(target.side) ? getDefaultName(target.side) : name,
      context: {
        identity: `${target.side}:${target.sessionId}:${isNaming ? 'name' : 'protect'}`,
        name, isNew: store.planRequiresSaveAs(target.side),
        title: isNaming ? undefined : i18n.global.t('shipCompare.protect_title'),
        message: isNaming ? undefined : protectionLabel.value,
        saveLabel: isNaming ? i18n.global.t('menu.save') : i18n.global.t('shipCompare.save_continue', { side: sideLabel(target.side) }),
        discardLabel: i18n.global.t('shipCompare.discard_continue', { side: sideLabel(target.side) })
      }
    }
  })
  const submitSaveDialog = ({ steps }: { steps: SmartSaveStep[] }) => {
    if (pickerSide.value !== null) return false
    if (naming.value !== null) {
      const step = steps[0]
      if (step?.type !== 'SAVE_AS') return false
      naming.value.name = step.name
      return submitName()
    }
    const target = protection.value
    if (target === null) return false
    const plan = store.getPlan(target.side)
    if (plan === null || plan.sessionId !== target.sessionId) {
      error.value = i18n.global.t('shipCompare.save_failed')
      return false
    }
    for (const step of steps) {
      if (step.type === 'NEW') { error.value = ''; discard(); return true }
      const result = store.savePlan(target.side, step.type === 'SAVE_AS' ? step.name : undefined, target.sessionId)
      if (result !== 'saved') { error.value = i18n.global.t('shipCompare.save_failed'); return false }
    }
    return true
  }
  const invalidSaveDialog = () => { error.value = i18n.global.t('menu.placeholder_enter_name') }
  return { activeView: computed({ get: () => store.activeView, set: value => { store.activeView = value } }), activeSide, pickerSide, pickerTarget, pickerMode, highlightedEquipmentId, currentSlotType,
    currentEquipmentId, currentIsShield, statsMode, compare, locked, blueprintA, blueprintB, selectedShip, pickerShip,
    preview, displayA, displayB, editingBlueprint, columns, activate, openComparison, openPicker, closePicker, confirmPicker,
    naming, protection, deletion, requestDelete, confirmDelete, cancelDelete, selectingShip, error, saveDialog, submitSaveDialog, invalidSaveDialog, save, submitName, cancel, discard, saveProtected,
    exit, openShipSelection, cancelShipSelection, chooseShip, guardSession, prepareSessionChange, resetComparison, newPlan, loadPlan, changeShip,
    getDefaultName, saveLabel, protectionLabel, sideLabel, sessionDirty: computed(() => store.isPlanDirty('A') || store.isPlanDirty('B')) }
}

export function useShipBuildWorkspacePresenter() {
  const store = useShipBuildStore()
  let instance = instances.get(store)
  if (!instance) { instance = createPresenter(store); instances.set(store, instance) }
  return instance
}
