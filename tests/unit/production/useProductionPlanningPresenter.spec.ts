import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useProductionPlanningPresenter } from '@/components/empire/presenters/useProductionPlanningPresenter'
import type { SavedModule } from '@/types/x4'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    modulesMap: {
      orphan_mod: {
        id: 'orphan_mod',
        inputs: {},
        outputs: { chips: 100 }
      },
      support_mod: {
        id: 'support_mod',
        inputs: { energycells: 50 },
        outputs: { hullparts: 100 }
      },
      energy_mod: {
        id: 'energy_mod',
        inputs: {},
        outputs: { energycells: 200 }
      }
    }
  })
}))

describe('useProductionPlanningPresenter', () => {
  it('computes archive diffs, orphan recommendations, and planned annotations', () => {
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
      recommendedModulesExpanded: false,
      moduleActions: {
        updatePlannedModules: vi.fn()
      },
      setRecommendedModulesExpanded: vi.fn()
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
    expect(presenter.props.orphanArchiveModuleIds.value).toEqual(new Set(['orphan_mod', 'support_mod']))
    expect(presenter.props.recommendedModules.value).toEqual([
      { id: 'orphan_mod', count: 3 },
      { id: 'support_mod', count: 1 }
    ])
    expect(presenter.props.plannedModules.value).toEqual([
      { id: 'orphan_mod', count: 1, diffAnnotation: '-3' },
      { id: 'energy_mod', count: 3, diffAnnotation: '+1' }
    ])

    presenter.emits.setRecommendedModulesExpanded(true)
    expect(store.setRecommendedModulesExpanded).toHaveBeenCalledWith(true)
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
      recommendedModulesExpanded: false,
      moduleActions: {
        updatePlannedModules: vi.fn()
      },
      setRecommendedModulesExpanded: vi.fn()
    })

    const presenter = useProductionPlanningPresenter(store as any)

    expect(presenter.props.plannedModules.value).toEqual([
      { id: 'energy_mod', count: 2 }
    ])
    expect(presenter.props.effectiveAutoIndustryModules.value).toEqual([
      { id: 'energy_mod', count: 1, diffAnnotation: '-1' }
    ])
  })
})
