import type { ComposerTranslation } from 'vue-i18n'
import type { X4Ship } from '@/types/x4'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useStatusStore } from '@/store/useStatusStore'
import type { SmartSaveStep } from '@/utils/smartSavePolicy'

export type ToolbarStoreType = 'ship-build' | 'logicFlow' | 'blueprint-production' | 'live-production'
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
  const blueprintStore = useBlueprintProductionStore()
  const liveStore = useLiveProductionStore()
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
    if (storeType === 'blueprint-production') return t('sector.new_sector_name')
    if (storeType === 'live-production') return ''
    return ''
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
    if (storeType === 'blueprint-production') return blueprintStore.isDirty
    if (storeType === 'live-production') return liveStore.isDirty
    return false
  }

  const isEditableFor = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') return shipBuildStore.isEditable()
    if (storeType === 'logicFlow') return logicFlowStore.isEditable()
    if (storeType === 'blueprint-production') return blueprintStore.isDirty
    if (storeType === 'live-production') return liveStore.isDirty
    return false
  }

  const isActionSupportedFor = (storeType: ToolbarStoreType, action: ToolbarAction): boolean => {
    if (storeType === 'live-production') {
      if (action === 'NEW' || action === 'SAVE_AS') return false
    }
    return true
  }

  const isEmptyForSave = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') return shipBuildStore.isEmptyForSave()
    if (storeType === 'logicFlow') return logicFlowStore.isEmptyForSave()
    if (storeType === 'blueprint-production') return blueprintStore.isEmptyForSave()
    if (storeType === 'live-production') return liveStore.isEmptyForSave()
    return true
  }

  const requiresSaveAsOnSaveFor = (storeType: ToolbarStoreType): boolean => {
    if (storeType === 'ship-build') return shipBuildStore.requiresSaveAsOnSave()
    if (storeType === 'logicFlow') return logicFlowStore.requiresSaveAsOnSave()
    if (storeType === 'blueprint-production') return blueprintStore.requiresSaveAsOnSave()
    if (storeType === 'live-production') return false
    return false
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
    if (storeType === 'blueprint-production') {
      blueprintStore.saveEmpire()
      return true
    }
    if (storeType === 'live-production') {
      liveStore.saveBinding()
      return true
    }
    return false
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
    if (storeType === 'blueprint-production') {
      return blueprintStore.saveEmpireAs(name.trim())
    }
    if (storeType === 'live-production') {
      return false
    }
    return false
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
    if (storeType === 'blueprint-production') {
      blueprintStore.createEmpire('', t('sector.new_station_name'))
      return
    }
    if (storeType === 'live-production') {
      return
    }
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
    if (!isActionSupportedFor(storeType, action)) {
      statusStore.pushMessage('warning', 'system', `Action ${action} not supported for ${storeType}`)
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
    'blueprint-production': {
      run: ({ choice, defaultEmpireName, importData }) => {
        if (choice === 'SAVE_AND_IMPORT') {
          executeSave('blueprint-production')
          pushSaveSuccess()
        }
        executeNew('blueprint-production', defaultEmpireName)
        importData({ storeType: 'blueprint-production' })
        return { ok: true }
      }
    },
    'live-production': {
      run: ({ choice, importData }) => {
        if (choice === 'SAVE_AND_IMPORT') {
          executeSave('live-production')
          pushSaveSuccess()
        }
        importData({ storeType: 'live-production' })
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
    if (storeType === 'blueprint-production') return isDirtyFor('blueprint-production')
    if (storeType === 'live-production') return isDirtyFor('live-production')
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
    isActionSupportedFor,
    isEmptyForSave,
    runAction,
    runSmartSaveSteps,
    shouldConfirmBeforeImport,
    runImportAction,
    pushEmptyNameBlocked
  }
}
