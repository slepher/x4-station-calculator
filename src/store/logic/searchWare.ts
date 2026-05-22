import type {
  LocalizedX4Ware,
  LocalizedX4ModuleGroup,
  GroupedWareItem,
  WareGroupResult
} from '@/types/x4'
import { compareModuleGroupsByPickerOrder } from './searchModule'

function getWarePickerLabel(ware: {
  localeName?: string
  name?: string
  id: string
}): string {
  return ware.localeName || ware.name || ware.id
}

export function generateFilteredWaresGrouped(
  query: string,
  currentLocale: string,
  localizedWaresMap: Record<string, LocalizedX4Ware>,
  localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup>,
  includeWare?: (ware: LocalizedX4Ware) => boolean
): WareGroupResult[] {
  const searchQuery = query.trim().toLowerCase()
  const isSearching = searchQuery.length > 0
  const isEn = currentLocale === 'en'

  const groups: Record<string, GroupedWareItem[]> = {}
  const typeMetadata: Record<string, { displayLabel: string; isHit: boolean }> = {}

  Object.keys(localizedModuleGroupsMap).forEach(typeId => {
    const mg = localizedModuleGroupsMap[typeId]
    if (!mg) return
    const name = (mg.name || '').toLowerCase()
    const id = (mg.id || '').toLowerCase()
    const localeName = (mg.localeName || '').toLowerCase()
    let isHit = false
    let displayLabel = mg.localeName

    if (isSearching) {
      if (isEn) {
        const idHit = id.includes(searchQuery)
        const nameHit = name.includes(searchQuery)
        isHit = idHit || nameHit
        if (idHit && !nameHit) displayLabel += ` (${mg.id})`
      } else {
        const localeHit = localeName.includes(searchQuery)
        const nameHit = name.includes(searchQuery)
        const idHit = id.includes(searchQuery)
        isHit = localeHit || nameHit || idHit

        if (!localeHit) {
          if (nameHit) displayLabel += ` (${mg.name})`
          else if (idHit) displayLabel += ` (${mg.id})`
        }
      }
    }

    typeMetadata[typeId] = { displayLabel, isHit }
  })

  Object.values(localizedWaresMap).forEach(w => {
    if (includeWare && !includeWare(w)) return

    const localeName = (w.localeName || '').toLowerCase()
    const originalName = (w.name || '').toLowerCase()
    const id = (w.id || '').toLowerCase()

    const typeInfo = typeMetadata[w.group] || { displayLabel: w.group, isHit: false }

    let wareHit = false
    if (isEn) {
      wareHit = id.includes(searchQuery) || originalName.includes(searchQuery)
    } else {
      wareHit = localeName.includes(searchQuery) || originalName.includes(searchQuery) || id.includes(searchQuery)
    }

    const isMatch = !isSearching || typeInfo.isHit || wareHit

    if (isMatch) {
      let label = w.localeName
      if (isSearching) {
        const localeHit = !isEn && localeName.includes(searchQuery)
        const nameHit = originalName.includes(searchQuery)
        const idHit = id.includes(searchQuery)

        if (isEn) {
          if (idHit && !nameHit) label += ` (${w.id})`
        } else {
          if (nameHit && !localeHit) label += ` (${w.name})`
          else if (idHit && !localeHit && !nameHit) label += ` (${w.id})`
        }
      }

      const type = w.group || 'others'
      if (!groups[type]) groups[type] = []
      groups[type].push({
        ...w,
        displayLabel: label,
        moduleGroup: localizedModuleGroupsMap[w.group]
      })
    }
  })

  for (const groupId of Object.keys(groups)) {
    groups[groupId]!.sort((a, b) => {
      const tierDiff = (b.tier || 0) - (a.tier || 0)
      if (tierDiff !== 0) return tierDiff
      return getWarePickerLabel(a).localeCompare(getWarePickerLabel(b))
    })
  }

  return Object.keys(groups)
    .sort((a, b) => compareModuleGroupsByPickerOrder(a, b, localizedModuleGroupsMap))
    .map(group => ({
      group,
      displayLabel: typeMetadata[group]?.displayLabel || group,
      wares: groups[group] || []
    }))
}
