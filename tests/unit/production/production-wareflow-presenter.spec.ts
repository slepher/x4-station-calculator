import { describe, expect, it, vi } from 'vitest'
import { useProductionWareflowPresenter } from '@/components/empire/presenters/useProductionWareflowPresenter'
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

describe('useProductionWareflowPresenter', () => {
  it('disables lock interaction for archive-produced wares in planning mode', () => {
    const toggleWareLock = vi.fn()
    const isWareOperable = vi.fn((wareId: string) => wareId !== 'disabled')

    const presenter = useProductionWareflowPresenter({
      session: {
        workbenchMode: 'station',
        entityType: 'station',
        mode: 'planning',
        visualMode: 'planning',
        activeStationId: 'station-1',
        activeTransitSectorId: null,
        activeBinding: 'binding-1',
        canToggle: true,
        wareflowViewMode: 'quantity'
      },
      stationState: createStationState({
        archiveProducedWareIds: ['energycells'],
        derivedProductionFlows: [
          {
            wareId: 'energycells',
            orderIndex: 0,
            tier: 1,
            transportType: 'container',
            unitVolume: 1,
            production: 10,
            consumption: 0,
            netRate: 10,
            netVolume: 10,
            totalOccupiedVolume: 20,
            totalOccupiedCount: 20,
            totalOccupiedConsumptionCount: 0,
            netValue: 100,
            contributions: [],
            transportDemand: 0
          }
        ] as any
      }),
      archiveStation: {
        code: 'station-1',
        modules: [],
        cargo: [],
        targetCounts: []
      } as any,
      settingActions: {
        updateResourceBufferHours: vi.fn(),
        updatePrimaryProductBufferHours: vi.fn(),
        updateSecondaryProductBufferHours: vi.fn(),
        updateBuyMultiplier: vi.fn(),
        updateSellMultiplier: vi.fn()
      },
      wareRuleActions: {
        isWareLocked: vi.fn(() => false),
        getResolvedLevel: vi.fn(() => 0),
        isWareOperable,
        isPlannedWare: vi.fn(() => false),
        toggleWareLock,
        toggleWarePriority: vi.fn()
      },
      moduleActions: {
        addModuleByWare: vi.fn(),
        removeModuleByWare: vi.fn()
      },
      updateWareflowViewMode: vi.fn()
    })

    expect(presenter.props.derivedProductionFlows.value).toHaveLength(1)
    expect(presenter.props.useAllocationVolumeView.value).toBe(true)
    expect(presenter.props.isWareOperable('energycells')).toBe(false)
    expect(presenter.props.isWareOperable('foodrations')).toBe(true)

    presenter.props.onToggleWareLock('energycells')
    presenter.props.onToggleWareLock('foodrations')

    expect(toggleWareLock).toHaveBeenCalledTimes(1)
    expect(toggleWareLock).toHaveBeenCalledWith('foodrations')
  })
})
