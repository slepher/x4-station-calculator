import { computed, ref, type Ref, type ComputedRef } from 'vue'
import i18n from '@/i18n'
import type { BlueprintsData, X4Blueprint, BlueprintTypeCategory, BlueprintClassCategory, X4Faction } from '@/types/x4'

export interface BlueprintRecipePresenterProps {
  typesNav: ComputedRef<{ id: string; name: string; classes: { id: string; name: string }[] }[]>
  selectedTypeId: Ref<string | null>
  selectedClassId: Ref<string | null>
  filteredBlueprints: ComputedRef<X4Blueprint[]>
  searchQuery: Ref<string>
  factionFilter: Ref<Set<string>>
  licenceFilter: Ref<Set<string>>
  availableFactions: ComputedRef<{ id: string; name: string }[]>
  availableLicences: ComputedRef<{ id: string; name: string }[]>
  allLicences: ComputedRef<{ id: string; name: string }[]>
  factionDisplayNames: ComputedRef<Record<string, string>>
  licenceDisplayNames: ComputedRef<Record<string, string>>
}

export interface BlueprintRecipePresenterEmits {
  selectType: (typeId: string) => void
  selectClass: (classId: string) => void
  updateSearchQuery: (query: string) => void
  toggleFactionFilter: (id: string) => void
  toggleLicenceFilter: (id: string) => void
}

export function useBlueprintRecipePresenter(store: {
  blueprintsData: Ref<BlueprintsData | null>
  factions: Ref<X4Faction[]>
}): {
  props: BlueprintRecipePresenterProps
  emits: BlueprintRecipePresenterEmits
} {
  const t = i18n.global.t.bind(i18n.global)

  const selectedTypeId = ref<string | null>(null)
  const selectedClassId = ref<string | null>(null)
  const searchQuery = ref('')
  const factionFilter = ref<Set<string>>(new Set())
  const licenceFilter = ref<Set<string>>(new Set())

  const factionDisplayNames = computed(() => {
    const map: Record<string, string> = {}
    for (const f of store.factions.value) {
      map[f.id] = f.nameId ? t(f.nameId) : (f.name || f.id)
    }
    return map
  })

  const allLicences = computed(() => {
    const map = new Map<string, string>()
    for (const f of store.factions.value) {
      if (f.licences) {
        for (const l of f.licences) {
          if (l.nameId && !map.has(l.type)) {
            const label = t(l.nameId)
            map.set(l.type, label && label !== l.nameId ? label : l.name)
          }
        }
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  })

  const licenceDisplayNames = computed(() => {
    const map: Record<string, string> = {}
    for (const f of store.factions.value) {
      if (f.licences) {
        for (const l of f.licences) {
          if (l.nameId && !(l.type in map)) {
            map[l.type] = t(l.nameId) || l.name
          }
        }
      }
    }
    return map
  })

  function resolveTypeName(ct: BlueprintTypeCategory): string {
    if (ct.nameId) return t(ct.nameId)
    return ct.name || ct.id
  }

  function resolveClassName(cc: BlueprintClassCategory): string {
    if (cc.nameId) return t(cc.nameId)
    return cc.name || cc.id
  }

  function resolveBlueprintName(bp: X4Blueprint): string {
    if (bp.nameId) return t(bp.nameId)
    return bp.name || bp.id
  }

  const typesNav = computed(() => {
    const data = store.blueprintsData.value
    if (!data) return []

    const classMap = new Map<string, BlueprintClassCategory[]>()
    data.classes.forEach(c => {
      const arr = classMap.get(c.type) || []
      arr.push(c)
      classMap.set(c.type, arr)
    })

    return data.types.map(ct => ({
      id: ct.id,
      name: resolveTypeName(ct),
      classes: (classMap.get(ct.id) || []).map(cc => ({
        id: cc.id,
        name: resolveClassName(cc)
      }))
    }))
  })

  const classBlueprints = computed(() => {
    const data = store.blueprintsData.value
    if (!data || !selectedClassId.value) return []
    return data.blueprints.filter(bp => bp.class === selectedClassId.value && !bp.noplayerblueprint)
  })

  const allBlueprints = computed(() => {
    const data = store.blueprintsData.value
    if (!data) return []
    return data.blueprints.filter(bp => !bp.noplayerblueprint)
  })

  const availableFactions = computed(() => {
    const source = classBlueprints.value.length > 0 ? classBlueprints.value : allBlueprints.value
    const seen = new Map<string, string>()
    const fdn = factionDisplayNames.value
    for (const bp of source) {
      for (const fid of bp.factions || []) {
        if (!seen.has(fid)) {
          seen.set(fid, fdn[fid] || fid)
        }
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  })

  const availableLicences = computed(() => {
    const source = classBlueprints.value.length > 0 ? classBlueprints.value : allBlueprints.value
    const seen = new Map<string, string>()
    const ldn = licenceDisplayNames.value
    for (const bp of source) {
      if (bp.licence) {
        if (!seen.has(bp.licence)) {
          seen.set(bp.licence, ldn[bp.licence] || bp.licence)
        }
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  })

  const filteredBlueprints = computed(() => {
    let result = classBlueprints.value

    const q = searchQuery.value.toLowerCase().trim()
    if (q) {
      result = result.filter(bp => {
        const name = resolveBlueprintName(bp).toLowerCase()
        const id = bp.id.toLowerCase()
        const facDisplayNames = factionDisplayNames.value
        const factionText = (bp.factions || []).map(fid => facDisplayNames[fid] || fid).join(' ').toLowerCase()
        return name.includes(q) || id.includes(q) || factionText.includes(q)
      })
    }

    const hasFactionFilter = factionFilter.value.size > 0
    const hasLicenceFilter = licenceFilter.value.size > 0

    if (hasFactionFilter || hasLicenceFilter) {
      result = result.filter(bp => {
        const fs = bp.factions || []
        const l = bp.licence
        const factionMatch = !hasFactionFilter
          || (fs.length === 0)
          || !fs.every(fid => factionFilter.value.has(fid))
        const licenceMatch = !hasLicenceFilter
          || !l
          || !licenceFilter.value.has(l)
        return factionMatch && licenceMatch
      })
    }

    return result
  })

  function selectType(typeId: string) {
    selectedTypeId.value = typeId
    const tc = typesNav.value.find(t => t.id === typeId)
    const firstClass = tc?.classes?.[0]
    if (firstClass) {
      selectedClassId.value = firstClass.id
    } else {
      selectedClassId.value = null
    }
  }

  function selectClass(classId: string) {
    selectedClassId.value = classId
  }

  function updateSearchQuery(query: string) {
    searchQuery.value = query
  }

  function toggleFactionFilter(id: string) {
    const next = new Set(factionFilter.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    factionFilter.value = next
  }

  function toggleLicenceFilter(id: string) {
    const next = new Set(licenceFilter.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    licenceFilter.value = next
  }

  const props: BlueprintRecipePresenterProps = {
    typesNav,
    selectedTypeId,
    selectedClassId,
    filteredBlueprints,
    searchQuery,
    factionFilter,
    licenceFilter,
    availableFactions,
    availableLicences,
    allLicences,
    factionDisplayNames,
    licenceDisplayNames,
  }

  const emits: BlueprintRecipePresenterEmits = {
    selectType,
    selectClass,
    updateSearchQuery,
    toggleFactionFilter,
    toggleLicenceFilter,
  }

  return { props, emits }
}
