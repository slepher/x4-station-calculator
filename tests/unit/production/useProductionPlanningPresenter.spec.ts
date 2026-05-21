import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import type { SavedModule } from '@/types/x4'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    modulesMap: {
      orphan_mod: { id: 'orphan_mod', type: 'production', method: 'default' },
      support_mod: { id: 'support_mod', type: 'production', method: 'default' },
      energy_mod: { id: 'energy_mod', type: 'production', method: 'default' },
      sol_terran: { id: 'sol_terran', type: 'production', method: 'default' },
      habitat_mod: { id: 'habitat_mod', type: 'habitation', method: 'default' },
      storage_mod: { id: 'storage_mod', type: 'storage', method: 'default' },
      pier_mod: { id: 'pier_mod', type: 'pier', method: 'default' }
    }
  })
}))

describe('useProductionPlanningPresenter', () => {
  it('separates explicit planned modules from inline recommended display', () => {
    const plannedModules: SavedModule[] = [
      { id: 'orphan_mod', count: 1 },
      { id: 'energy_mod', count: 3 }
    ]

    const store = reactive({
      session: {
        workbenchMode: 'station',
        visualMode: 'planning'
      },
      context: {},
      stationState: {
        plannedModules,
        recommendedModules: [
          { id: 'orphan_mod', count: 4 },
          { id: 'support_mod', count: 1 }
        ],
        autoIndustryModules: [{ id: 'energy_mod', count: 5 }],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        enforceDlcActivation: false
      },
      archiveStation: {
        modules: [
          { id: 'orphan_mod', count: 4 },
          { id: 'energy_mod', count: 2 }
        ],
        building: {
          modules: [{ id: 'support_mod', count: 1 }]
        }
      },
      moduleActions: {
        updatePlannedModules: vi.fn()
      }
    })

    const presenter = useProductionPlanningPresenter(store as any)

    expect(presenter.props.archiveTotalMap.value).toEqual({
      orphan_mod: 4,
      energy_mod: 2,
      support_mod: 1
    })
    expect(presenter.props.effectiveAutoIndustryModules.value).toEqual([
      { id: 'energy_mod', count: 5, diffAnnotation: '+3' }
    ])
    expect(presenter.props.recommendedModules.value).toEqual([
      { id: 'orphan_mod', count: 4, isReferenceRecommended: true },
      { id: 'support_mod', count: 1, isReferenceRecommended: true }
    ])
    expect(presenter.props.plannedModules.value).toEqual([
      { id: 'energy_mod', count: 3, diffAnnotation: '+1' }
    ])
  })

  it('removes stale diff annotation when planned count returns to archive total', () => {
    const store = reactive({
      session: {
        workbenchMode: 'station',
        visualMode: 'planning'
      },
      context: {},
      stationState: {
        plannedModules: [{ id: 'energy_mod', count: 2, diffAnnotation: '+1' }],
        recommendedModules: [],
        autoIndustryModules: [{ id: 'energy_mod', count: 1 }],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        enforceDlcActivation: false
      },
      archiveStation: {
        modules: [{ id: 'energy_mod', count: 2 }],
        building: {
          modules: []
        }
      },
      moduleActions: {
        updatePlannedModules: vi.fn()
      }
    })

    const presenter = useProductionPlanningPresenter(store as any)

    expect(presenter.props.plannedModules.value).toEqual([
      { id: 'energy_mod', count: 2 }
    ])
    expect(presenter.props.effectiveAutoIndustryModules.value).toEqual([
      { id: 'energy_mod', count: 1, diffAnnotation: '-1' }
    ])
  })

  it('shows floor production modules in auto industry as full set instead of delta only', () => {
    const store = reactive({
      session: {
        workbenchMode: 'station',
        visualMode: 'planning'
      },
      context: {},
      stationState: {
        plannedModules: [],
        recommendedModules: [],
        autoIndustryModules: [{ id: 'sol_terran', count: 2 }],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        enforceDlcActivation: false
      },
      archiveStation: {
        modules: [{ id: 'sol_terran', count: 2 }],
        building: {
          modules: []
        }
      },
      moduleActions: {
        updatePlannedModules: vi.fn()
      }
    })

    const presenter = useProductionPlanningPresenter(store as any)

    expect(presenter.props.autoIndustryModules.value).toEqual([
      { id: 'sol_terran', count: 2 }
    ])
    expect(presenter.props.effectiveAutoIndustryModules.value).toEqual([
      { id: 'sol_terran', count: 2 }
    ])
  })

  it('shows infrastructure modules as full target set instead of raw delta only', () => {
    const store = reactive({
      session: {
        workbenchMode: 'station',
        visualMode: 'planning'
      },
      context: {},
      stationState: {
        plannedModules: [],
        recommendedModules: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [{ id: 'storage_mod', count: 7 }],
        enforceDlcActivation: false
      },
      archiveStation: {
        modules: [{ id: 'storage_mod', count: 7 }],
        building: {
          modules: []
        }
      },
      moduleActions: {
        updatePlannedModules: vi.fn()
      }
    })

    const presenter = useProductionPlanningPresenter(store as any)

    expect(presenter.props.autoInfrastructureModules.value).toEqual([
      { id: 'storage_mod', count: 7 }
    ])
    expect(presenter.props.effectiveAutoInfrastructureModules.value).toEqual([
      { id: 'storage_mod', count: 7 }
    ])
  })

  it('shows habitation modules as full target set instead of raw delta only', () => {
    const store = reactive({
      session: {
        workbenchMode: 'station',
        visualMode: 'planning'
      },
      context: {},
      stationState: {
        plannedModules: [],
        recommendedModules: [],
        autoIndustryModules: [],
        autoHabitationModules: [{ id: 'habitat_mod', count: 4 }],
        autoInfrastructureModules: [],
        enforceDlcActivation: false
      },
      archiveStation: {
        modules: [{ id: 'habitat_mod', count: 4 }],
        building: {
          modules: []
        }
      },
      moduleActions: {
        updatePlannedModules: vi.fn()
      }
    })

    const presenter = useProductionPlanningPresenter(store as any)

    expect(presenter.props.autoHabitationModules.value).toEqual([
      { id: 'habitat_mod', count: 4 }
    ])
    expect(presenter.props.effectiveAutoHabitationModules.value).toEqual([
      { id: 'habitat_mod', count: 4 }
    ])
  })
})
