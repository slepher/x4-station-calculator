import type { SavePoiOverlayItem } from '@/types/saveArchive'
import type { LocalizedX4Module, LocalizedX4ModuleGroup } from '@/types/x4'

const MIXED_PROFILE = 'mixed'

const NPC_TAG_LABEL_KEYS: Record<string, string> = {
  shipyard: 'map.save_npc_tag_shipyard',
  wharf: 'map.save_npc_tag_wharf',
  equipmentdock: 'map.save_npc_tag_equipmentdock',
  tradestation: 'map.save_npc_tag_tradestation',
  piratebase: 'map.save_npc_tag_piratebase',
  defencemodule: 'map.save_npc_tag_defencemodule',
  weaponplatform: 'map.save_npc_tag_weaponplatform',
  nest: 'map.save_npc_tag_nest',
  hive: 'map.save_npc_tag_hive',
  factory: 'map.save_npc_tag_factory',
  constructionsite: 'map.save_npc_tag_constructionsite'
}

type Translator = (key: string) => string

interface SavePoiLabelContext {
  t: Translator
  localizedModulesMap: Record<string, LocalizedX4Module>
  localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup>
}

export function getNpcStationPoiLabel(
  poi: SavePoiOverlayItem,
  context: SavePoiLabelContext
): string {
  if (poi.category === 'playerStation' && poi.is_headquarter) {
    return context.t('map.save_station_headquarter')
  }
  if (
    poi.category !== 'npcStation' &&
    poi.category !== 'playerStation' &&
    poi.category !== 'xenonStation' &&
    poi.category !== 'khaakStation'
  ) {
    return context.t('map.save_category_npc_station')
  }

  if ((poi.category === 'npcStation' || poi.category === 'playerStation') && poi.tag === 'factory') {
    const profile = poi.productionProfile
    if (!profile) return context.t('map.save_npc_tag_factory')

    if (profile === MIXED_PROFILE) return context.t('map.save_npc_profile_mixed')

    const localizedModule = context.localizedModulesMap[profile]
    if (localizedModule?.localeName) return localizedModule.localeName

    if (context.localizedModuleGroupsMap[profile]?.localeName) {
      return context.localizedModuleGroupsMap[profile].localeName
    }

    return poi.profileName || profile
  }

  const npcTagLabelKey = poi.tag ? NPC_TAG_LABEL_KEYS[poi.tag] : undefined
  if (npcTagLabelKey) {
    return context.t(npcTagLabelKey)
  }

  if (poi.category === 'xenonStation') return context.t('map.save_category_xenon_station')
  if (poi.category === 'khaakStation') return context.t('map.save_category_khaak_station')
  return poi.category === 'playerStation'
    ? context.t('map.save_category_player_station')
    : context.t('map.save_category_npc_station')
}

export function getStationPoiLabel(
  poi: SavePoiOverlayItem,
  context: SavePoiLabelContext
): string {
  if (
    poi.category === 'npcStation' ||
    poi.category === 'playerStation' ||
    poi.category === 'xenonStation' ||
    poi.category === 'khaakStation'
  ) {
    return getNpcStationPoiLabel(poi, context)
  }
  return poi.code
}
