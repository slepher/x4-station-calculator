import { computed, ref, type Ref, type ComputedRef } from 'vue'
import i18n from '@/i18n'
import type { BlueprintsData, X4Blueprint, BlueprintTypeCategory, BlueprintClassCategory, X4Faction } from '@/types/x4'

const GENERIC_FACTION_ID = '__generic__'

export interface FactionLicenceEntry {
  factionId: string
  factionName: string
  licences: { id: string; name: string; rep: number | null }[]
}

function repFromMinrelation(mr: number | undefined): number | null {
  if (mr == null || mr === 0) return null
  const sign = mr > 0 ? 1 : -1
  return sign * Math.ceil(10 * Math.log10(Math.abs(mr) * 1000))
}

export interface BlueprintRecipePresenterProps {
  typesNav: ComputedRef<{ id: string; name: string; classes: { id: string; name: string }[] }[]>
  selectedTypeId: Ref<string | null>
  selectedClassId: Ref<string | null>
  filteredBlueprints: ComputedRef<X4Blueprint[]>
  searchQuery: Ref<string>
  factionLicenceTree: ComputedRef<FactionLicenceEntry[]>
  factionLicenceFilter: Ref<Map<string, Set<string>>>
  factionCheckState: ComputedRef<Record<string, 'all' | 'none' | 'partial'>>
  expandedFactions: Ref<Set<string>>
  factionDisplayNames: ComputedRef<Record<string, string>>
  factionLicenceAllState: ComputedRef<'all' | 'none' | 'partial'>
}

export interface BlueprintRecipePresenterEmits {
  selectType: (typeId: string) => void
  selectClass: (classId: string) => void
  updateSearchQuery: (query: string) => void
  toggleFactionAllLicences: (factionId: string) => void
  toggleAllFactionLicences: () => void
  toggleFactionLicence: (factionId: string, licenceId: string) => void
  toggleExpandedFaction: (factionId: string) => void
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
  const factionLicenceFilter = ref<Map<string, Set<string>>>(new Map())
  const expandedFactions = ref<Set<string>>(new Set())

  const factionDisplayNames = computed(() => {
    const map: Record<string, string> = {}
    for (const f of store.factions.value) {
      map[f.id] = f.nameId ? t(f.nameId) : (f.name || f.id)
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

  const factionLicenceMap = computed(() => {
    const map: Record<string, Record<string, { mr: number | undefined; name: string }>> = {}
    for (const f of store.factions.value) {
      if (f.licences) {
        const fm: Record<string, { mr: number | undefined; name: string }> = {}
        for (const l of f.licences) {
          if (!l.nameId) continue
          fm[l.type] = { mr: l.minrelation, name: t(l.nameId) || l.name }
        }
        map[f.id] = fm
      }
    }
    return map
  })

  const globalLicenceNames = computed(() => {
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

  const factionLicenceTree = computed(() => {
    const data = store.blueprintsData.value
    if (!data) return []

    const fb = data.faction_blueprints
    if (!fb) return []

    const fdn = factionDisplayNames.value
    const gln = globalLicenceNames.value

    const merged: Record<string, Record<string, number>> = {}

    if (selectedClassId.value) {
      if (fb[selectedClassId.value]) {
        Object.assign(merged, fb[selectedClassId.value])
      }
    } else {
      for (const cls of Object.values(fb)) {
        for (const fid of Object.keys(cls)) {
          if (!merged[fid]) merged[fid] = {}
          const licences = cls[fid]
          if (!licences) continue
          for (const lid of Object.keys(licences)) {
            merged[fid][lid] = (merged[fid][lid] || 0) + (licences[lid] || 0)
          }
        }
      }
    }

    const floop = factionLicenceMap.value

    const result: FactionLicenceEntry[] = Object.entries(merged)
      .map(([fid, lm]) => ({
        factionId: fid,
        factionName: fdn[fid] || fid,
        licences: Object.entries(lm)
          .map(([lid]) => {
            const fl = floop[fid]?.[lid]
            return { id: lid, name: fl?.name || gln[lid] || lid, rep: repFromMinrelation(fl?.mr) }
          })
          .sort((a, b) => {
            if (a.rep == null && b.rep == null) return a.name.localeCompare(b.name)
            if (a.rep == null) return 1
            if (b.rep == null) return -1
            return a.rep - b.rep
          }),
      }))
      .sort((a, b) => a.factionName.localeCompare(b.factionName))

    if (classBlueprints.value.some(bp => !bp.factions || bp.factions.length === 0)) {
      result.push({
        factionId: GENERIC_FACTION_ID,
        factionName: t('blueprint_recipe.generic'),
        licences: [],
      })
    }

    return result
  })

  const factionCheckState = computed(() => {
    const state: Record<string, 'all' | 'none' | 'partial'> = {}
    for (const entry of factionLicenceTree.value) {
      const excluded = factionLicenceFilter.value.get(entry.factionId)
      const total = entry.licences.length
      if (entry.factionId === GENERIC_FACTION_ID) {
        state[entry.factionId] = excluded ? 'all' : 'none'
        continue
      }
      if (!excluded || excluded.size === 0) {
        state[entry.factionId] = 'none'
      } else {
        let relevantExcluded = 0
        for (const l of entry.licences) {
          if (excluded.has(l.id)) relevantExcluded++
        }
        if (relevantExcluded === 0) {
          state[entry.factionId] = 'none'
        } else if (relevantExcluded === total) {
          state[entry.factionId] = 'all'
        } else {
          state[entry.factionId] = 'partial'
        }
      }
    }
    return state
  })

  const factionLicenceAllState = computed(() => {
    let hasAny = false
    let hasAll = true
    for (const entry of factionLicenceTree.value) {
      const excluded = factionLicenceFilter.value.get(entry.factionId)
      if (entry.factionId === GENERIC_FACTION_ID) {
        if (excluded) hasAny = true
        else hasAll = false
        continue
      }
      const total = entry.licences.length
      if (total === 0) continue
      let relevantExcluded = 0
      if (excluded) {
        for (const l of entry.licences) {
          if (excluded.has(l.id)) relevantExcluded++
        }
      }
      if (relevantExcluded > 0) hasAny = true
      if (relevantExcluded < total) hasAll = false
    }
    if (!hasAny) return 'none'
    if (hasAll) return 'all'
    return 'partial'
  })

  const allFactionLicenceTree = computed(() => {
    const data = store.blueprintsData.value
    if (!data || !data.faction_blueprints) return []
    const fb = data.faction_blueprints
    const merged: Record<string, Set<string>> = {}
    for (const cls of Object.values(fb)) {
      for (const fid of Object.keys(cls)) {
        if (!merged[fid]) merged[fid] = new Set()
        const licences = cls[fid]
        if (!licences) continue
        for (const lid of Object.keys(licences)) {
          merged[fid].add(lid)
        }
      }
    }
    return Object.entries(merged).map(([fid, lids]) => ({
      factionId: fid,
      licences: Array.from(lids),
    }))
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

    if (factionLicenceFilter.value.size > 0) {
      result = result.filter(bp => {
        const fs = bp.factions || []
        const l = bp.licence
        if (fs.length === 0) {
          return !factionLicenceFilter.value.has(GENERIC_FACTION_ID)
        }
        if (!l) return true
        return !fs.every(fid => {
          const excluded = factionLicenceFilter.value.get(fid)
          return excluded ? excluded.has(l) : false
        })
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

  function toggleFactionAllLicences(factionId: string) {
    if (factionId === GENERIC_FACTION_ID) {
      const next = new Map(factionLicenceFilter.value)
      if (next.has(GENERIC_FACTION_ID)) {
        next.delete(GENERIC_FACTION_ID)
      } else {
        next.set(GENERIC_FACTION_ID, new Set())
      }
      factionLicenceFilter.value = next
      return
    }

    const entry = allFactionLicenceTree.value.find(e => e.factionId === factionId)
    if (!entry) return

    const next = new Map(factionLicenceFilter.value)
    const current = next.get(factionId)

    if (current && current.size > 0) {
      next.delete(factionId)
    } else {
      next.set(factionId, new Set(entry.licences))
    }

    factionLicenceFilter.value = next
  }

  function toggleAllFactionLicences() {
    if (factionLicenceFilter.value.size > 0) {
      factionLicenceFilter.value = new Map()
    } else {
      const next = new Map<string, Set<string>>()
      for (const entry of allFactionLicenceTree.value) {
        next.set(entry.factionId, new Set(entry.licences))
      }
      if (factionLicenceTree.value.some(e => e.factionId === GENERIC_FACTION_ID)) {
        next.set(GENERIC_FACTION_ID, new Set())
      }
      factionLicenceFilter.value = next
    }
  }

  function toggleFactionLicence(factionId: string, licenceId: string) {
    const next = new Map(factionLicenceFilter.value)
    const current = next.get(factionId) || new Set<string>()
    const updated = new Set(current)

    if (updated.has(licenceId)) {
      updated.delete(licenceId)
    } else {
      updated.add(licenceId)
    }

    if (updated.size > 0) {
      next.set(factionId, updated)
    } else {
      next.delete(factionId)
    }

    factionLicenceFilter.value = next
  }

  function toggleExpandedFaction(factionId: string) {
    const next = new Set(expandedFactions.value)
    if (next.has(factionId)) {
      next.delete(factionId)
    } else {
      next.add(factionId)
    }
    expandedFactions.value = next
  }

  const props: BlueprintRecipePresenterProps = {
    typesNav,
    selectedTypeId,
    selectedClassId,
    filteredBlueprints,
    searchQuery,
    factionLicenceTree,
    factionLicenceFilter,
    factionCheckState,
    expandedFactions,
    factionDisplayNames,
    factionLicenceAllState,
  }

  const emits: BlueprintRecipePresenterEmits = {
    selectType,
    selectClass,
    updateSearchQuery,
    toggleFactionAllLicences,
    toggleAllFactionLicences,
    toggleFactionLicence,
    toggleExpandedFaction,
  }

  return { props, emits }
}
