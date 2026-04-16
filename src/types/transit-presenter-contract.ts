import type { StationSettings } from '@/types/x4'
import type { ProductionPanelSource } from '@/types/production-panel-source'

export interface TransitPresenterContract {
  getActiveTransitSectorId(): string | null
  getTransitMode(): 'planning' | 'live'
  getPlanningTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getLiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getActiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getTransitHasArchiveTradeStation(): boolean
  getTransitSettings(): Partial<StationSettings>
  getGlobalSettings(): StationSettings
  getBuildPriceMultiplier(): number
  getUseHQ(): boolean
  updateTransitHubSettings(patch: Partial<StationSettings>): void
  updateBuildPriceMultiplier(value: number): void
  updateUseHQ(value: boolean): void
  toggleMode(): void
}