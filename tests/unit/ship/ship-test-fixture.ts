import { useGameDataStore } from '@/store/useGameDataStore'
import bullets from '@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json'
import drones from '@/assets/x4_game_data/8.0-Diplomacy/data/drones.json'
import consumables from '@/assets/x4_game_data/8.0-Diplomacy/data/consumables.json'
import equipments from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import missiles from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'
import ships from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import shipRaces from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_races.json'
import shipTypes from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_types.json'
import shipSlots from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_slots.json'
import slotTags from '@/assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json'
import wares from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import equipmentTypes from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'

export function loadShipTestFixture() {
  const gameData = useGameDataStore()
  const fixture = {
    bullets, consumables, drones, equipments, missiles, ships, shipRaces, shipTypes, shipSlots, slotTags, wares,
    equipmentTypes, modules: [], moduleGroups: [], consumption: {}, maps: { clusters: {}, sectors: {} },
    sectorReachability: {}, mapResources: { version: '', resource_model: '', sectors: {}, regionyield_definitions: [] },
    regionyields: [], res: [], factions: [], dlcs: [], defaultMaxes: {}, languages: [], dlcSetting: {}
  } as never
  gameData.$patch({ gameData: fixture, dlcSetting: { enforceDlcActivation: false, activeDlcs: [] } })
  gameData.bullets = bullets as never
  gameData.missiles = missiles as never
  gameData.isReady = true
}
