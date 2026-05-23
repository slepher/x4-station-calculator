import { computed, type ComputedRef } from 'vue'
import type {
  TerraformingData,
  TerraformingCluster,
  TerraformingState,
  TaskTree
} from '@/store/logic/terraformingTaskResolver'
import { resolveAvailableTasks } from '@/store/logic/terraformingTaskResolver'
import type { ArchiveStationData } from '@/types/saveArchive'

export interface TerraformingToolbarProps {
  hqStationName: ComputedRef<string>
  stationCode: ComputedRef<string>
  sectorName: ComputedRef<string>
  sectorNameId: ComputedRef<string | undefined>
  position: ComputedRef<{ x: number; y: number; z: number } | undefined>
  sectorResources: ComputedRef<string[]>
  sectorSunlight: ComputedRef<number>
  singleBerthThroughput: ComputedRef<number>
  hasHqStation: ComputedRef<boolean>
}

export interface TerraformingSectorPanelProps {
  clusters: ComputedRef<TerraformingCluster[]>
  selectedClusterId: ComputedRef<string | null>
}

export interface TerraformingTaskListProps {
  taskTree: ComputedRef<TaskTree | null>
  groupNames: ComputedRef<Map<string, string>>
}

export interface TerraformingResourcePanelProps {
  projectResources: ComputedRef<Array<{ ware: string; amount: number; projectId: string; projectName: string }>>
  totalResources: ComputedRef<Array<{ ware: string; amount: number }>>
  deliveries: ComputedRef<Array<{ macro: string; amount: number; buildDuration: number; projectId: string; projectName: string }>>
}

export interface TerraformingPresenterProps {
  toolbar: TerraformingToolbarProps
  sectorPanel: TerraformingSectorPanelProps
  taskList: TerraformingTaskListProps
  resourcePanel: TerraformingResourcePanelProps
}

export interface TerraformingPresenterEmits {
  selectCluster: (clusterId: string) => void
}

export interface UseTerraformingPresenterReturn {
  props: TerraformingPresenterProps
  emits: TerraformingPresenterEmits
}

export interface TerraformingPresenterStore {
  terraformingData: ComputedRef<TerraformingData | null>
  terraformingSelectedClusterId: ComputedRef<string | null>
  terraformingSelectedCluster: ComputedRef<TerraformingCluster | null>
  terraformingCurrentStats: ComputedRef<Record<string, number>>
  terraformingCompletedProjects: ComputedRef<Set<string>>
  terraformingHqStationName: ComputedRef<string>
  terraformingHqArchiveStation: ComputedRef<ArchiveStationData | null>
  selectTerraformingCluster: (clusterId: string) => void
}

export function useTerraformingPresenter(store: TerraformingPresenterStore): UseTerraformingPresenterReturn {
  const hqArchiveStation = computed(() => store.terraformingHqArchiveStation.value)

  const hasHqStation = computed(() => hqArchiveStation.value !== null)

  const hqStationName = computed(() => store.terraformingHqStationName.value || '')
  const stationCode = computed(() => hqArchiveStation.value?.code || '')
  const sectorName = computed(() => hqArchiveStation.value?.sector?.name || '')
  const sectorNameId = computed(() => hqArchiveStation.value?.sector?.nameId)
  const position = computed(() => hqArchiveStation.value?.position)
  const sectorResources = computed(() => hqArchiveStation.value?.sector?.resources || [])
  const sectorSunlight = computed(() => hqArchiveStation.value?.sector?.sunlight ?? 100)
  const singleBerthThroughput = computed(() => 930000)

  const clusters = computed<TerraformingCluster[]>(() => {
    return store.terraformingData.value?.clusters || []
  })

  const selectedClusterId = computed<string | null>(() => {
    return store.terraformingSelectedClusterId.value
  })

  const taskTree = computed<TaskTree | null>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return null
    const state: TerraformingState = {
      stats: store.terraformingCurrentStats.value,
      completedProjects: store.terraformingCompletedProjects.value
    }
    return resolveAvailableTasks(cluster, state, data)
  })

  const groupNames = computed<Map<string, string>>(() => {
    const data = store.terraformingData.value
    const map = new Map<string, string>()
    if (data) {
      for (const pg of data.projectGroups) {
        map.set(pg.id, pg.name || pg.nameId)
      }
    }
    return map
  })

  const projectResources = computed(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return []
    const projectMap = new Map(data.projects.map(p => [p.id, p]))
    const result: Array<{ ware: string; amount: number; projectId: string; projectName: string }> = []
    for (const projectId of cluster.projectIds) {
      const project = projectMap.get(projectId)
      if (!project || !project.resources?.wares) continue
      for (const w of project.resources.wares) {
        result.push({
          ware: w.ware,
          amount: w.amount,
          projectId: project.id,
          projectName: project.name || project.nameId
        })
      }
    }
    return result
  })

  const totalResources = computed(() => {
    const aggregate = new Map<string, number>()
    for (const r of projectResources.value) {
      aggregate.set(r.ware, (aggregate.get(r.ware) || 0) + r.amount)
    }
    return Array.from(aggregate.entries()).map(([ware, amount]) => ({ ware, amount }))
  })

  const deliveries = computed(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return []
    const projectMap = new Map(data.projects.map(p => [p.id, p]))
    const result: Array<{ macro: string; amount: number; buildDuration: number; projectId: string; projectName: string }> = []
    for (const projectId of cluster.projectIds) {
      const project = projectMap.get(projectId)
      if (!project || !project.deliveries) continue
      for (const d of project.deliveries) {
        result.push({
          macro: d.macro,
          amount: d.amount,
          buildDuration: d.buildDuration,
          projectId: project.id,
          projectName: project.name || project.nameId
        })
      }
    }
    return result
  })

  const props: TerraformingPresenterProps = {
    toolbar: {
      hqStationName,
      stationCode,
      sectorName,
      sectorNameId,
      position,
      sectorResources,
      sectorSunlight,
      singleBerthThroughput,
      hasHqStation
    },
    sectorPanel: {
      clusters,
      selectedClusterId
    },
    taskList: {
      taskTree,
      groupNames
    },
    resourcePanel: {
      projectResources,
      totalResources,
      deliveries
    }
  }

  const emits: TerraformingPresenterEmits = {
    selectCluster: (clusterId: string) => store.selectTerraformingCluster(clusterId)
  }

  return { props, emits }
}
