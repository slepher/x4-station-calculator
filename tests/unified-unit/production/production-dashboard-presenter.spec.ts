import { describe, expect, it, vi } from 'vitest'
import { useProductionDashboardPresenter } from '@/components/empire/presenters/useProductionDashboardPresenter'
import type { ProductionStationState } from '@/types/production-workbench-contract'

function createStationState(overrides: Partial<ProductionStationState> = {}): ProductionStationState {
  return {
    entityType: 'station',
    id: 'station-1',
    name: 'Station 1',
    plannedModules: [],
    resolvedModules: [],
    modules: [],
    buildingModules: [],
    autoIndustryModules: [],
    autoHabitationModules: [],
    autoInfrastructureModules: [],
    productionFlows: [],
    derivedProductionFlows: [],
    warePriorityLevels: {},
    settings: {
      racePreference: 'argon',
      sunlight: 100,
      resourceBufferHours: 1,
      primaryProductBufferHours: 1,
      secondaryProductBufferHours: 1,
      buyMultiplier: 0.5,
      sellMultiplier: 0.5,
      transportShipCapacity: 62000,
      considerWorkforceForAutoFill: true,
      workforceAuto: true,
      manualWorkforce: 0,
      useHQ: false,
      showEmpireGaps: false
    },
    enforceDlcActivation: false,
    empireGaps: { operations: [], supply: [] },
    currentEfficiency: 1,
    actualWorkforce: 0,
    buildPriceMultiplier: 0.5,
    buildingCargo: [],
    buildingReservation: [],
    ...overrides
  }
}

describe('useProductionDashboardPresenter', () => {
  it('uses planning+archive scope semantics without deducting buildingInProgress', () => {
    const stationState = createStationState({
      modules: [{ id: 'archive-built-view', count: 99 }],
      archiveBuiltModules: [{ id: 'module-a', count: 10 }],
      effectiveTargetModules: [{ id: 'module-a', count: 12 }, { id: 'module-b', count: 3 }],
      buildingModules: [{ id: 'module-a', count: 2 }],
      buildingInProgress: { id: 'module-a', count: 1 }
    })

    const presenter = useProductionDashboardPresenter({
      session: {
        workbenchMode: 'station',
        entityType: 'station',
        mode: 'planning',
        visualMode: 'planning',
        activeStationId: 'station-1',
        activeTransitSectorId: null,
        activeBinding: 'binding-1',
        canToggle: true,
        wareflowViewMode: 'wares'
      },
      stationState,
      archiveStation: {
        code: 'station-1',
        modules: [{ id: 'module-a', count: 10 }],
        building: { modules: [{ id: 'module-a', count: 2 }], cargo: [], reservation: [] }
      } as any,
      moduleScope: 'building',
      settingActions: {
        updateTransportShipCapacity: vi.fn(),
        updateManualWorkforce: vi.fn(),
        updateWorkforceAuto: vi.fn(),
        updateUseHQ: vi.fn()
      },
      updateBuildPriceMultiplier: vi.fn()
    })

    expect(presenter.props.builtScopeModules.value).toEqual([{ id: 'module-a', count: 10 }])
    expect(presenter.props.buildingScopeModules.value).toEqual([{ id: 'module-a', count: 2 }, { id: 'module-b', count: 3 }])
    expect(presenter.props.allScopeModules.value).toEqual([{ id: 'module-a', count: 12 }, { id: 'module-b', count: 3 }])
    expect(presenter.props.displayModules.value).toEqual([{ id: 'module-a', count: 2 }, { id: 'module-b', count: 3 }])
    expect(presenter.props.workerModules.value).toEqual([{ id: 'module-a', count: 12 }, { id: 'module-b', count: 3 }])
    expect(presenter.props.buildingInProgress.value).toEqual({ id: 'module-a', count: 1 })
  })

  it('keeps live building scope deduction semantics unchanged', () => {
    const presenter = useProductionDashboardPresenter({
      session: {
        workbenchMode: 'station',
        entityType: 'station',
        mode: 'live',
        visualMode: 'live',
        activeStationId: 'station-1',
        activeTransitSectorId: null,
        activeBinding: 'binding-1',
        canToggle: true,
        wareflowViewMode: 'wares'
      },
      stationState: createStationState({
        modules: [{ id: 'module-a', count: 10 }],
        buildingModules: [{ id: 'module-a', count: 3 }, { id: 'module-b', count: 2 }],
        buildingInProgress: { id: 'module-a', count: 1 }
      }),
      moduleScope: 'building',
      settingActions: {
        updateTransportShipCapacity: vi.fn(),
        updateManualWorkforce: vi.fn(),
        updateWorkforceAuto: vi.fn(),
        updateUseHQ: vi.fn()
      },
      updateBuildPriceMultiplier: vi.fn()
    })

    expect(presenter.props.displayModules.value).toEqual([{ id: 'module-a', count: 2 }, { id: 'module-b', count: 2 }])
    expect(presenter.props.workerModules.value).toEqual([{ id: 'module-a', count: 10 }])
  })
})
