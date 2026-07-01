import type { GroupDraftInfo } from '@/store/logic/autoGroup'
import type { BindingSectorGroup } from '@/types/x4'

type ResultGroupOrderItem = Pick<GroupDraftInfo, 'id' | 'sectorMacro'>
type BindingGroupOrderItem = Pick<BindingSectorGroup, 'sectorMacro'>

function getResultGroupOrderKey(group: ResultGroupOrderItem): string {
  if (group.sectorMacro !== undefined && group.sectorMacro.length > 0) return group.sectorMacro
  return group.id
}

function getBindingGroupOrderKey(group: BindingGroupOrderItem): string {
  if (group.sectorMacro !== undefined && group.sectorMacro.length > 0) return group.sectorMacro
  return ''
}

export function getResultGroupOrderKeys(groups: ResultGroupOrderItem[]): string[] {
  return groups.map((group) => getResultGroupOrderKey(group))
}

export function getBindingGroupOrderKeys(groups: BindingGroupOrderItem[]): string[] {
  return groups.map((group) => getBindingGroupOrderKey(group))
}

export function hasBindingGroupOrderChanged(
  resultGroups: ResultGroupOrderItem[],
  bindingGroups: BindingGroupOrderItem[]
): boolean {
  if (resultGroups.length !== bindingGroups.length) return true
  const resultKeys = getResultGroupOrderKeys(resultGroups)
  const bindingKeys = getBindingGroupOrderKeys(bindingGroups)
  return resultKeys.some((key, index) => key !== bindingKeys[index])
}
