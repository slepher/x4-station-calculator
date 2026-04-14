import type {
  LocalizedX4Module,
  LocalizedX4ModuleGroup,
  GroupedModuleItem,
  ModuleGroupResult
} from '@/types/x4'

const TYPE_PRIORITY: Record<string, number> = {
  production: 1,
  processingmodule: 2,
  habitation: 3,
  storage: 4
}

const GROUP_PRIORITY: Record<string, number> = {
  shiptech: 1,
  hightech: 2,
  refined: 3,
  energy: 4
}

function getModuleTypePriority(
  groupId: string | undefined,
  localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup>
): number {
  const type = localizedModuleGroupsMap[groupId || '']?.type || groupId || 'others'
  return TYPE_PRIORITY[type] || 99
}

function getModuleGroupPriority(groupId: string | undefined): number {
  return GROUP_PRIORITY[groupId || ''] || 99
}

function getModulePickerLabel(module: {
  localeName?: string
  name?: string
  id: string
}): string {
  return module.localeName || module.name || module.id
}

export function compareModuleGroupsByPickerOrder(
  groupA: string,
  groupB: string,
  localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup>
): number {
  const pTypeA = getModuleTypePriority(groupA, localizedModuleGroupsMap)
  const pTypeB = getModuleTypePriority(groupB, localizedModuleGroupsMap)
  if (pTypeA !== pTypeB) return pTypeA - pTypeB

  const pGroupA = getModuleGroupPriority(groupA)
  const pGroupB = getModuleGroupPriority(groupB)
  if (pGroupA !== pGroupB) return pGroupA - pGroupB

  return groupA.localeCompare(groupB)
}

export function compareModulesByPickerOrder(
  a: { id: string; group?: string; tier?: number; localeName?: string; name?: string },
  b: { id: string; group?: string; tier?: number; localeName?: string; name?: string },
  localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup>
): number {
  const groupCompare = compareModuleGroupsByPickerOrder(a.group || 'others', b.group || 'others', localizedModuleGroupsMap)
  if (groupCompare !== 0) return groupCompare

  const tierDiff = (b.tier || 0) - (a.tier || 0)
  if (tierDiff !== 0) return tierDiff

  return getModulePickerLabel(a).localeCompare(getModulePickerLabel(b))
}

function sortModulesBySearchPriority(
  modules: { id: string; group?: string; tier?: number; localeName?: string; name?: string }[],
  localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup>
): void {
  modules.sort((a, b) => compareModulesByPickerOrder(a, b, localizedModuleGroupsMap))
}

/**
 * 生成分组的模块搜索结果
 * @param query 搜索查询字符串
 * @param currentLocale 当前语言环境
 * @param localizedModulesMap 本地化模块映射
 * @param localizedModuleGroupsMap 本地化模块组映射
 * @returns 按类型和优先级排序的分组模块结果
 */
export function generateFilteredModulesGrouped(
  query: string,
  currentLocale: string,
  localizedModulesMap: Record<string, LocalizedX4Module>,
  localizedModuleGroupsMap: Record<string, LocalizedX4ModuleGroup>,
  includeModule?: (module: LocalizedX4Module) => boolean
): ModuleGroupResult[] {
  const searchQuery = query.trim().toLowerCase()
  const isSearching = searchQuery.length > 0
  const isEn = currentLocale === 'en'

  const groups: Record<string, GroupedModuleItem[]> = {}
  const typeMetadata: Record<string, { displayLabel: string; isHit: boolean }> = {}

  // 1. 预处理类型命中逻辑与 Header 补偿
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
        // EN 模式：仅匹配 id 或 name
        const idHit = id.includes(searchQuery)
        const nameHit = name.includes(searchQuery)
        isHit = idHit || nameHit
        if (idHit && !nameHit) displayLabel += ` (${mg.id})`
      } else {
        // 非 EN 模式：匹配 id, name 或 localeName
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

  // 2. 遍历模块，结合类型命中状态进行级联过滤
  Object.values(localizedModulesMap).forEach(m => {
    if (includeModule && !includeModule(m)) return

    const localeName = (m.localeName || '').toLowerCase()
    const originalName = (m.name || '').toLowerCase()
    const id = (m.id || '').toLowerCase()

    const typeInfo = typeMetadata[m.group] || { displayLabel: m.group, isHit: false }

    let moduleHit = false
    if (isEn) {
      moduleHit = id.includes(searchQuery) || originalName.includes(searchQuery)
    } else {
      moduleHit = localeName.includes(searchQuery) || originalName.includes(searchQuery) || id.includes(searchQuery)
    }

    const isMatch = !isSearching || typeInfo.isHit || moduleHit

    if (isMatch) {
      let label = m.localeName
      if (isSearching) {
        const localeHit = !isEn && localeName.includes(searchQuery)
        const nameHit = originalName.includes(searchQuery)
        const idHit = id.includes(searchQuery)

        if (isEn) {
          if (idHit && !nameHit) label += ` (${m.id})`
        } else {
          if (nameHit && !localeHit) label += ` (${m.name})`
          else if (idHit && !localeHit && !nameHit) label += ` (${m.id})`
        }
      }

      const type = m.group || 'others'
      if (!groups[type]) groups[type] = []
      groups[type].push({
        ...m,
        displayLabel: label,
        moduleGroup: localizedModuleGroupsMap[m.group]
      })
    }
  })

  return Object.keys(groups)
    .sort((a, b) => compareModuleGroupsByPickerOrder(a, b, localizedModuleGroupsMap))
    .map(group => ({
      group,
      displayLabel: typeMetadata[group]?.displayLabel || group,
      modules: (groups[group] || [])
        .sort((a, b) => compareModulesByPickerOrder(a, b, localizedModuleGroupsMap))
    }))
}
