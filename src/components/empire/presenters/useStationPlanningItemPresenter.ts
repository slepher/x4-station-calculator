import { computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { X4Module } from '@/types/x4'

export function useStationPlanningItemPresenter(props: {
  info: X4Module
  inactiveByDlc?: boolean
  countDisabled?: boolean
}) {
  const gameData = useGameDataStore()
  const shouldShowDlcTag = computed(() => props.info.dlc_tag !== 'base')
  const dlcLabel = computed(() => gameData.getDlcDisplayName(props.info.dlc_tag))
  const isDlcActive = computed(() => gameData.isDlcActive(props.info.dlc_tag))
  const isCountDisabled = computed(() => props.countDisabled === true || props.inactiveByDlc === true)

  return { shouldShowDlcTag, dlcLabel, isDlcActive, isCountDisabled }
}
