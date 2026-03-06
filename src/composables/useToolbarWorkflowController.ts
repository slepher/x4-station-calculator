import type { ComposerTranslation } from 'vue-i18n'
import type { X4Ship } from '@/types/x4'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useStatusStore } from '@/store/useStatusStore'
import type { SmartSaveStep } from '@/utils/smartSavePolicy'

export type ToolbarStoreType = 'ship-build' | 'logicFlow' | 'station'
export type ToolbarAction = 'NEW' | 'SAVE' | 'SAVE_AS'
export type ImportChoice = 'SAVE_AND_IMPORT' | 'DISCARD_AND_IMPORT'

type ToolbarDefaultNameContext = {
  selectedShip?: X4Ship | null
}

type ImportDataContext = {
  storeType: ToolbarStoreType
}

type ImportDataFn = (ctx: ImportDataContext) => void

type UseToolbarWorkflowControllerInput = {
  t: ComposerTranslation
  translateShip: (ship: X4Ship) => string
}

type RunActionInput = {
  storeType: ToolbarStoreType
  action: ToolbarAction
  defaultEmpireName: string
}

type RunActionOutcome =
  | { kind: 'done' }
  | { kind: 'blocked' }
  | { kind: 'open-smart-save'; intent: 'NEW' | 'SAVE_AS' }

type RunSmartSaveStepsInput = {
  storeType: ToolbarStoreType
  steps: SmartSaveStep[]
  defaultEmpireName: string
}

type RunImportActionInput = {
  storeType: ToolbarStoreType
  choice: ImportChoice
  defaultEmpireName: string
  importData: ImportDataFn
}

type ImportHandler = {
  run: (input: RunImportActionInput) => { ok: boolean; unsupported?: boolean }
}

export function useToolbarWorkflowController({ t, translateShip }: UseToolbarWorkflowControllerInput) {
  const empireStore = useEmpireStore()
  const logicFlowStore = useLogicFlowStore()
  const shipBuildStore = useShipBuildStore()
  const statusStore = useStatusStore()

  const getDefaultName = (storeType: ToolbarStoreType, ctx?: ToolbarDefaultNameContext): string => {
    if (storeType === 'logicFlow') return t('menu.default_flow_name')
    if (storeType === 'ship-build') {
      const ship = ctx?.selectedShip || null
      const shipName = ship ? translateShip(ship) : ''
      return shipName ? `${shipName} ${t('menu.blueprint')}` : t('menu.default_blueprint_name')
    }
    return t('empire.new_empire_name')
  }

  const pushSaveSuccess = () => {
    statusStore.pushMessage('success', 'save', t('menu.save'))
  }

  const pushSaveBlocked = () => {
    statusStore.pushMessage('warning', 'save', t('menu.cannot_save_empty_plan'))
  }

  const pushEmptyNameBlocked = () => {
    statusStore.pushMessage('warning', 'save', t('menu.placeholder_enter_name'))
  }

  const isDirtyFor = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') return shipBuildStore.isDirty
    if (storeType === 'logicFlow') return logicFlowStore.isDirty
    return empireStore.isDirty
  }

  const isEditableFor = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') return shipBuildStore.isEditable()
    if (storeType === 'logicFlow') return logicFlowStore.isEditable()
    return empireStore.isEditable()
  }

  const isEmptyForSave = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') return shipBuildStore.isEmptyForSave()
    if (storeType === 'logicFlow') return logicFlowStore.isEmptyForSave()
    return empireStore.isEmptyForSave()
  }

  const requiresSaveAsOnSaveFor = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') return shipBuildStore.requiresSaveAsOnSave()
    if (storeType === 'logicFlow') return logicFlowStore.requiresSaveAsOnSave()
    return empireStore.requiresSaveAsOnSave()
  }

  const executeSave = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') {
      shipBuildStore.saveBlueprintWithFallbackName(
        getDefaultName('ship-build', { selectedShip: shipBuildStore.selectedShip })
      )
      return true
    }
    if (storeType === 'logicFlow') {
      return logicFlowStore.saveCurrentPlan()
    }
    empireStore.saveEmpire()
    return true
  }

  const executeSaveAs = (storeType: ToolbarStoreType, name: string): boolean => {
    if (!name.trim()) return false
    if (storeType === 'ship-build') {
      shipBuildStore.saveAsBlueprint(name.trim())
      return true
    }
    if (storeType === 'logicFlow') {
      return logicFlowStore.saveCurrentPlanAs(name.trim())
    }
    return empireStore.saveEmpireAs(name.trim())
  }

  const executeNew = (storeType: ToolbarStoreType, _defaultEmpireName: string) => {
    if (storeType === 'ship-build') {
      shipBuildStore.clearLoadoutForCurrentShip()
      return
    }
    if (storeType === 'logicFlow') {
      logicFlowStore.clearAll()
      return
    }
    empireStore.resetEmpireWithDefaultName('')
  }

  const runSmartSaveSteps = ({ storeType, steps, defaultEmpireName }: RunSmartSaveStepsInput): boolean => {
    let hasSaved = false
    for (const step of steps) {
      if (step.type === 'SAVE') {
        const ok = executeSave(storeType)
        if (!ok) return false
        hasSaved = true
        continue
      }
      if (step.type === 'SAVE_AS') {
        const ok = executeSaveAs(storeType, step.name)
        if (!ok) {
          pushSaveBlocked()
          return false
        }
        hasSaved = true
        continue
      }
      executeNew(storeType, defaultEmpireName)
    }
    if (hasSaved) pushSaveSuccess()
    return true
  }

  const runAction = ({ storeType, action, defaultEmpireName }: RunActionInput): RunActionOutcome => {
    if (isEditableFor(storeType)) {
      return { kind: 'blocked' }
    }

    if (action === 'SAVE') {
      if (isEmptyForSave(storeType)) {
        pushSaveBlocked()
        return { kind: 'blocked' }
      }
      if (requiresSaveAsOnSaveFor(storeType)) {
        return { kind: 'open-smart-save', intent: 'SAVE_AS' }
      }
      if (!isDirtyFor(storeType)) return { kind: 'done' }
      const ok = runSmartSaveSteps({
        storeType,
        steps: [{ type: 'SAVE' }],
        defaultEmpireName
      })
      return ok ? { kind: 'done' } : { kind: 'blocked' }
    }

    if (action === 'SAVE_AS') {
      if (isEmptyForSave(storeType)) {
        pushSaveBlocked()
        return { kind: 'blocked' }
      }
      return { kind: 'open-smart-save', intent: 'SAVE_AS' }
    }

    // NEW
    if (isEmptyForSave(storeType)) {
      executeNew(storeType, defaultEmpireName)
      return { kind: 'done' }
    }
    if (isDirtyFor(storeType)) {
      return { kind: 'open-smart-save', intent: 'NEW' }
    }
    executeNew(storeType, defaultEmpireName)
    return { kind: 'done' }
  }

  const importHandlers: Record<ToolbarStoreType, ImportHandler> = {
    station: {
      run: ({ choice, defaultEmpireName, importData }) => {
        if (choice === 'SAVE_AND_IMPORT') {
          executeSave('station')
          pushSaveSuccess()
        }
        executeNew('station', defaultEmpireName)
        importData({ storeType: 'station' })
        return { ok: true }
      }
    },
    logicFlow: {
      run: () => ({ ok: false, unsupported: true })
    },
    'ship-build': {
      run: () => ({ ok: false, unsupported: true })
    }
  }

  const shouldConfirmBeforeImport = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'station') return isDirtyFor('station')
    return false
  }

  const runImportAction = (input: RunImportActionInput): { ok: boolean; unsupported?: boolean } => {
    const handler = importHandlers[input.storeType]
    const result = handler.run(input)
    if (result.unsupported) {
      statusStore.pushMessage('warning', 'system', `unsupported import path for ${input.storeType}`)
    }
    return result
  }

  return {
    getDefaultName,
    isDirtyFor,
    isEditableFor,
    isEmptyForSave,
    runAction,
    runSmartSaveSteps,
    shouldConfirmBeforeImport,
    runImportAction,
    pushEmptyNameBlocked
  }
}
