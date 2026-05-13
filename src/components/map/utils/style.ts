import factoryIconUrl from '@/components/icons/factory.svg'
import shipyardIconUrl from '@/components/icons/shipyard.svg'
import tradestationIconUrl from '@/components/icons/tradestation.svg'
import playerhqIconUrl from '@/components/icons/playerhq.svg'
import wharfIconUrl from '@/components/icons/wharf.svg'
import equipmentdockIconUrl from '@/components/icons/equipmentdock.svg'
import defensestationIconUrl from '@/components/icons/defensestation.svg'
import piratestationIconUrl from '@/components/icons/piratestation.svg'
import hiveIconUrl from '@/components/icons/hive.svg'
import weaponplatformIconUrl from '@/components/icons/weaponplatform.svg'
import constructionsiteIconUrl from '@/components/icons/constructionsite.svg'
import shiptechIconUrl from '@/components/icons/shiptech.svg'
import hightechIconUrl from '@/components/icons/hightech.svg'
import refinedIconUrl from '@/components/icons/refined.svg'
import pharmaceuticalIconUrl from '@/components/icons/pharmaceutical.svg'
import foodIconUrl from '@/components/icons/food.svg'
import agriculturalIconUrl from '@/components/icons/agricultural.svg'
import waterIconUrl from '@/components/icons/water.svg'
import energyIconUrl from '@/components/icons/energy.svg'
import shipyardHeadquarterIconUrl from '@/components/icons/shipyard_headquarter.svg'
import wharfHeadquarterIconUrl from '@/components/icons/wharf_headquarter.svg'
import equipmentdockHeadquarterIconUrl from '@/components/icons/equipmentdock_headquarter.svg'
import factoryHeadquarterIconUrl from '@/components/icons/factory_headquarter.svg'
import tradestationHeadquarterIconUrl from '@/components/icons/tradestation_headquarter.svg'
import defensestationHeadquarterIconUrl from '@/components/icons/defensestation_headquarter.svg'
import piratestationHeadquarterIconUrl from '@/components/icons/piratestation_headquarter.svg'
import shipLFightIconUrl from '@/components/icons/ships/ship_l_fight_01.svg'
import shipLMineIconUrl from '@/components/icons/ships/ship_l_mine_01.svg'
import shipLTradeIconUrl from '@/components/icons/ships/ship_l_trade_01.svg'
import shipLDismantlingIconUrl from '@/components/icons/ships/ship_l_dismantling_01.svg'
import shipMFightIconUrl from '@/components/icons/ships/ship_m_fight_01.svg'
import shipMMineIconUrl from '@/components/icons/ships/ship_m_mine_01.svg'
import shipMTradeIconUrl from '@/components/icons/ships/ship_m_trade_01.svg'
import shipMSalvageIconUrl from '@/components/icons/ships/ship_m_salvage_01.svg'
import shipSFightIconUrl from '@/components/icons/ships/ship_s_fight_01.svg'
import shipSMineIconUrl from '@/components/icons/ships/ship_s_mine_01.svg'
import shipSTradeIconUrl from '@/components/icons/ships/ship_s_trade_01.svg'
import shipXLBuildIconUrl from '@/components/icons/ships/ship_xl_build_01.svg'
import shipXLFightIconUrl from '@/components/icons/ships/ship_xl_fight_01.svg'
import shipXLAuxiliaryIconUrl from '@/components/icons/ships/ship_xl_auxiliary_01.svg'
import vaultLockedIconUrl from '@/components/icons/vault_locked.svg'
import vaultUnlockedIconUrl from '@/components/icons/vault_unlocked.svg'
import type { SavePoiOverlayItem } from '@/types/saveArchive'
import type { SavePoiColorMap } from '../types'
import { getPoiIconTag } from '@/store/logic/stationPoiSemantics'
import {
  MAP_ICON_SIZES,
  getMapSavePoiBaseIconSize,
  isLargeMapSavePoiIcon
} from './mapIconConfig'

export const FALLBACK_OWNER_COLOR = '#94a3b8'
export const OVERLAY_ICON_SIZE = MAP_ICON_SIZES.placement
export const SMALL_ICON_SIZE = MAP_ICON_SIZES.savePoiSmall
export const PREVIEW_ICON_SIZE = MAP_ICON_SIZES.preview
export const MAP_FONT_FAMILY = "'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif"
const CONDITIONAL_SMALL_ICON_CATEGORIES = new Set(['npcStation', 'xenonStation', 'khaakStation'])

export const SAVE_POI_COLORS: SavePoiColorMap = {
  playerStation: '#fbbf24',
  npcStation: 'rgba(252, 211, 77, 0.6)',
  xenonStation: '#f87171',
  khaakStation: '#a855f7',
  abandonedShip: '#c084fc',
  datavault: '#fbbf24',
  erlkingVault: '#f97316'
}

export const SAVE_POI_ICON_MAP: Record<string, string> = {
  shipyard: shipyardIconUrl,
  wharf: wharfIconUrl,
  equipmentdock: equipmentdockIconUrl,
  factory: factoryIconUrl,
  tradestation: tradestationIconUrl,
  defencemodule: defensestationIconUrl,
  piratebase: piratestationIconUrl,
  piratestation: piratestationIconUrl,
  hive: hiveIconUrl,
  weaponplatform: weaponplatformIconUrl,
  constructionsite: constructionsiteIconUrl,
  playerhq: playerhqIconUrl,
  shiptech: shiptechIconUrl,
  hightech: hightechIconUrl,
  refined: refinedIconUrl,
  pharmaceutical: pharmaceuticalIconUrl,
  food: foodIconUrl,
  agricultural: agriculturalIconUrl,
  water: waterIconUrl,
  energy: energyIconUrl
}

const SAVE_POI_HEADQUARTER_ICON_MAP: Record<string, string> = {
  shipyard: shipyardHeadquarterIconUrl,
  wharf: wharfHeadquarterIconUrl,
  equipmentdock: equipmentdockHeadquarterIconUrl,
  factory: factoryHeadquarterIconUrl,
  tradestation: tradestationHeadquarterIconUrl,
  defence: defensestationHeadquarterIconUrl,
  defencestation: defensestationHeadquarterIconUrl,
  piratebase: piratestationHeadquarterIconUrl,
  piratestation: piratestationHeadquarterIconUrl
}

const SHIP_CLASS_PURPOSE_ICON_MAP: Record<string, Record<string, string>> = {
  ship_l: {
    fight: shipLFightIconUrl,
    mine: shipLMineIconUrl,
    trade: shipLTradeIconUrl,
    dismantling: shipLDismantlingIconUrl
  },
  ship_m: {
    fight: shipMFightIconUrl,
    mine: shipMMineIconUrl,
    trade: shipMTradeIconUrl,
    salvage: shipMSalvageIconUrl
  },
  ship_s: {
    fight: shipSFightIconUrl,
    mine: shipSMineIconUrl,
    trade: shipSTradeIconUrl
  },
  ship_xl: {
    build: shipXLBuildIconUrl,
    fight: shipXLFightIconUrl,
    auxiliary: shipXLAuxiliaryIconUrl
  }
}

export const svgIdSafe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_')

export const placementIconHref = (icon: 'factory' | 'shipyard' | 'tradestation') => {
  if (icon === 'shipyard') return shipyardIconUrl
  if (icon === 'tradestation') return tradestationIconUrl
  return factoryIconUrl
}

export function getSavePoiIconUrl(poi: SavePoiOverlayItem): string | null {
  if (poi.category === 'abandonedShip' && poi.class && poi.purpose) {
    const classIcons = SHIP_CLASS_PURPOSE_ICON_MAP[poi.class]
    const iconUrl = classIcons?.[poi.purpose]
    if (iconUrl) {
      return iconUrl
    }
  }

  if (poi.category === 'datavault' || poi.category === 'erlkingVault') {
    return poi.unlocked ? vaultUnlockedIconUrl : vaultLockedIconUrl
  }

  if (poi.tag === 'nest') {
    return weaponplatformIconUrl
  }

  const iconTag = getPoiIconTag(poi)
  if (iconTag) {
    if (poi.is_headquarter) {
      return SAVE_POI_HEADQUARTER_ICON_MAP[iconTag] || SAVE_POI_ICON_MAP[iconTag] || null
    }
    return SAVE_POI_ICON_MAP[iconTag] || null
  }

  return null
}

export function getSavePoiIconSize(poi: SavePoiOverlayItem): number {
  return getMapSavePoiBaseIconSize(poi)
}

export function isLargeSavePoiIcon(poi: SavePoiOverlayItem): boolean {
  return isLargeMapSavePoiIcon(poi)
}

export function shouldHideSavePoiSmallIconAtClusterOverview(poi: SavePoiOverlayItem): boolean {
  return CONDITIONAL_SMALL_ICON_CATEGORIES.has(poi.category) && !isLargeSavePoiIcon(poi)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match || !match[1] || !match[2] || !match[3]) return null
  return {
    r: parseInt(match[1], 16) / 255,
    g: parseInt(match[2], 16) / 255,
    b: parseInt(match[3], 16) / 255
  }
}

export function colorToFeColorMatrix(hex: string): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return `${rgb.r.toFixed(4)} 0 0 0 0  ${rgb.g.toFixed(4)} 0 0 0 0  ${rgb.b.toFixed(4)} 0 0 0 0  0 0 0 1 0`
}
