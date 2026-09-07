import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import type { FlowNode, ProductionLineGroup } from '@/types/x4'

export function useLogicFlowPlanningPresenter() {
  const gameData = useGameDataStore()
  const logicFlow = useLogicFlowStore()

  /** 紧凑节点按自身模块身份命名；预览按目标组的有效血统选模块。 */
  function getCompactNodeDisplayName(node: FlowNode, group: ProductionLineGroup): string {
    if (gameData.isRawMaterialWare(node.wareId)) {
      return gameData.getWareDisplayName(node.wareId)
    }

    if (node.isPreview) {
      let lineage = group.lockedLineage
      if (!group.isLocked) {
        lineage = logicFlow.draggingLineage === null ? 'default' : logicFlow.draggingLineage
      }
      const module = gameData.findModuleForWare(node.wareId, lineage)
      if (module) return gameData.getModuleDisplayName(module.id)
      return gameData.getWareDisplayName(node.wareId)
    }

    if (!node.moduleId) return gameData.getWareDisplayName(node.wareId)
    return gameData.getModuleDisplayName(node.moduleId)
  }

  return { getCompactNodeDisplayName }
}
