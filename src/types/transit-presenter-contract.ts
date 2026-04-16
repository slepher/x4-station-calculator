import type { StationSettings, SavedModule } from '@/types/x4'
import type { ProductionPanelSource } from '@/types/production-panel-source'

export interface TransitPresenterContract {
  getActiveTransitSectorId(): string | null
  getTransitMode(): 'planning' | 'live'
  getPlanningTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getLiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getActiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getTransitHasArchiveTradeStation(): boolean
  getTransitArchiveModules(): SavedModule[]
  getTransitBuildingModules(): SavedModule[]
  getTransitSettings(): Partial<StationSettings>
  getGlobalSettings(): StationSettings
  updateTransitHubSettings(patch: Partial<StationSettings>): void
  toggleMode(): void
}