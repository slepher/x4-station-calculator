import type { EquipmentType, ShipEquipmentSize } from '@/types/x4'

export type FitMode = 'connection' | 'group'

export interface FitEquipmentOption {
  id: string
  name: string
  mk: string | null
  race: string | null
  tags: string[]
}

export interface FitConnectionRow {
  connectionKey: string
  slotType: EquipmentType
  parentSlotType: EquipmentType
  parentConnectionSize: ShipEquipmentSize
  parentConnectionTags: string[]
  slotTypeLabel: string
  groupName: string
  size: ShipEquipmentSize
  tags: string[]
  count: number
  options?: FitEquipmentOption[]
}

export interface FitGroupRow {
  groupKey: string
  slotType: EquipmentType
  parentSlotType: EquipmentType
  parentConnectionSize: ShipEquipmentSize
  parentConnectionTags: string[]
  slotTypeLabel: string
  groupName: string
  size: ShipEquipmentSize
  totalCount: number
  tags: string[]
  options?: FitEquipmentOption[]
  connectionKeys: string[]
}

export interface EquipmentPickerState {
  expanded: boolean
  slotKey: string | null
  highlightedEquipmentId: string | null
}

export interface FilterTag {
  id: string
  label: string
  count: number
}

export interface EquipmentPickerProps {
  open: boolean
  slotKey: string
  slotLabel: string
  options: FitEquipmentOption[]
  initialEquipmentId: string | null
}
