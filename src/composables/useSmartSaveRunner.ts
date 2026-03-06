import { useEmpireStore } from '@/store/useEmpireStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { SmartSaveStep, SmartSaveStoreType } from '@/utils/smartSavePolicy'

type RunSmartSavePlanInput = {
  storeType: SmartSaveStoreType
  steps: SmartSaveStep[]
  defaultEmpireName: string
}

export function useSmartSaveRunner() {
  const empireStore = useEmpireStore()
  const logicFlowStore = useLogicFlowStore()
  const shipBuildStore = useShipBuildStore()

  const runShipBuildStep = (step: SmartSaveStep) => {
    if (step.type === 'SAVE') {
      shipBuildStore.saveBlueprint()
      return
    }
    if (step.type === 'SAVE_AS') {
      shipBuildStore.saveAsBlueprint(step.name)
      return
    }
    shipBuildStore.clearLoadoutForCurrentShip()
  }

  const runLogicFlowStep = (step: SmartSaveStep) => {
    if (step.type === 'SAVE') {
      logicFlowStore.saveCurrentPlan()
      return
    }
    if (step.type === 'SAVE_AS') {
      const originalId = logicFlowStore.savedPlans.activeId
      logicFlowStore.savedPlans.activeId = null
      const saved = logicFlowStore.saveCurrentPlan(step.name)
      if (!saved) {
        logicFlowStore.savedPlans.activeId = originalId
      }
      return
    }
    logicFlowStore.clearAll()
  }

  const runEmpireStep = (step: SmartSaveStep, defaultEmpireName: string) => {
    if (step.type === 'SAVE') {
      empireStore.saveEmpire()
      return
    }
    if (step.type === 'SAVE_AS') {
      if (!empireStore.activeEmpire) return
      const newEmpire = JSON.parse(JSON.stringify(empireStore.activeEmpire))
      newEmpire.id = crypto.randomUUID()
      newEmpire.name = step.name
      newEmpire.stations.forEach((s: { id: string }) => { s.id = crypto.randomUUID() })
      empireStore.activeEmpire = newEmpire
      empireStore.saveEmpire()
      return
    }
    empireStore.resetEmpireWithDefaultName(defaultEmpireName)
  }

  const runSmartSavePlan = ({ storeType, steps, defaultEmpireName }: RunSmartSavePlanInput) => {
    for (const step of steps) {
      if (storeType === 'ship-build') {
        runShipBuildStep(step)
        continue
      }
      if (storeType === 'logicFlow') {
        runLogicFlowStep(step)
        continue
      }
      runEmpireStep(step, defaultEmpireName)
    }
  }

  return {
    runSmartSavePlan
  }
}

