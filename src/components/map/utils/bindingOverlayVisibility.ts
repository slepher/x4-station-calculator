export type MapArchiveTarget =
  | { kind: 'default-map' }
  | { kind: 'archive'; guid: string; time: number }

export function shouldShowBindingOverlayForArchive(input: {
  archiveGuid?: string | null
  bindingGuid?: string | null
}): boolean {
  if (!input.bindingGuid) return false
  if (!input.archiveGuid) return false
  return input.archiveGuid === input.bindingGuid
}

export function shouldShowBindingOverlayForMapTarget(input: {
  target: MapArchiveTarget
  bindingGuid?: string | null
}): boolean {
  if (!input.bindingGuid) return false
  if (input.target.kind !== 'archive') return false
  return input.target.guid === input.bindingGuid
}

export function inferMapArchiveTarget(input: {
  activeBindingGuid?: string | null
  activeBindingArchiveTime?: number | null
  selectedArchiveGuid?: string | null
  selectedArchiveTime?: number | null
}): MapArchiveTarget {
  if (input.activeBindingGuid && typeof input.activeBindingArchiveTime === 'number') {
    return { kind: 'archive', guid: input.activeBindingGuid, time: input.activeBindingArchiveTime }
  }
  if (input.selectedArchiveGuid && typeof input.selectedArchiveTime === 'number') {
    return { kind: 'archive', guid: input.selectedArchiveGuid, time: input.selectedArchiveTime }
  }
  return { kind: 'default-map' }
}
