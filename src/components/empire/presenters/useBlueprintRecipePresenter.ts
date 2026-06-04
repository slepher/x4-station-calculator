import { computed, ref, type Ref, type ComputedRef } from 'vue'
import i18n from '@/i18n'
import type { BlueprintsData, X4Blueprint, BlueprintTypeCategory, BlueprintClassCategory, X4Faction } from '@/types/x4'

const GENERIC_FACTION_ID = '__generic__'

export type LicencePurchaseState = 'licensed' | 'eligible' | 'rep_needed' | 'default'

export type BlueprintPurchaseStatus = 'owned' | 'purchasable' | 'licence_needed' | 'rep_needed' | 'locked' | 'no_licence' | 'no_player_data'

export type BlueprintLockedReason = 'no_seller' | 'faction_no_blueprint_sale' | 'no_diplomacy' | 'unknown_licence'

export interface PlayerBindingData {
  blueprints: string[]
  relations: Record<string, number>
  licences: Record<string, string[]>
}

export interface FactionLicenceEntry {
  factionId: string
  factionName: string
  relationLabel?: string
  licences: { id: string; name: string; rep: number | null; state?: LicencePurchaseState }[]
}

function repFromMinrelation(mr: number | undefined): number | null {
  if (mr == null || mr === 0) return null
  const sign = mr > 0 ? 1 : -1
  return sign * Math.ceil(10 * Math.log10(Math.abs(mr) * 1000))
}

function formatRelation(raw: number | undefined): string {
  if (raw == null) return ''
  if (raw === 0) return '0'
  const sign = raw > 0 ? '+' : '-'
  return sign + String(Math.ceil(10 * Math.log10(Math.abs(raw) * 1000)))
}

function hasPlayerLicenceForFaction(
  playerData: PlayerBindingData,
  licenceType: string,
  factionId: string,
): boolean {
  return playerData.licences[licenceType]?.includes(factionId) === true
}

function getLicencePurchaseState(
  factionId: string,
  licenceType: string,
  playerData: PlayerBindingData | null,
  minrelation: number | undefined,
): LicencePurchaseState {
  if (!playerData) return 'default'
  if (hasPlayerLicenceForFaction(playerData, licenceType, factionId)) return 'licensed'
  if (minrelation == null || playerData.relations[factionId] == null) return 'default'
  if (playerData.relations[factionId] >= minrelation) return 'eligible'
  return 'rep_needed'
}

function getBlueprintPurchaseStatus(
  bp: X4Blueprint,
  playerData: PlayerBindingData | null,
  factions: X4Faction[],
  classLicenceFactions: Record<string, Record<string, Record<string, number>>> | undefined,
  selectedClassId: string | null,
): { status: BlueprintPurchaseStatus; lockedReason?: BlueprintLockedReason } {
  if (!playerData) return { status: 'no_player_data' }
  if (playerData.blueprints.includes(bp.id)) return { status: 'owned' }
  if (!bp.licence) return { status: 'no_licence' }

  const licenceType = bp.licence
  const sellingFactions = resolveSellingFactions(bp, factions, classLicenceFactions, selectedClassId)

  if (sellingFactions.length === 0) {
    const allFactions = bp.factions || []
    if (allFactions.length === 0) return { status: 'locked', lockedReason: 'no_seller' }
    const hasNoDiplomacy = allFactions.every(fid => factions.find(f => f.id === fid)?.nodiplomacyselection)
    if (hasNoDiplomacy) return { status: 'locked', lockedReason: 'no_diplomacy' }
    const hasNoSale = allFactions.every(fid => factions.find(f => f.id === fid)?.noblueprintsale)
    if (hasNoSale) return { status: 'locked', lockedReason: 'faction_no_blueprint_sale' }
    return { status: 'locked', lockedReason: 'unknown_licence' }
  }

  const hasLicensed = sellingFactions.some(fid => getLicenceStateForFaction(fid, licenceType, playerData, factions) === 'licensed')
  if (hasLicensed) return { status: 'purchasable' }

  const hasEligible = sellingFactions.some(fid => getLicenceStateForFaction(fid, licenceType, playerData, factions) === 'eligible')
  if (hasEligible) return { status: 'licence_needed' }

  return { status: 'rep_needed' }
}

function resolveSellingFactions(
  bp: X4Blueprint,
  factions: X4Faction[],
  classLicenceFactions: Record<string, Record<string, Record<string, number>>> | undefined,
  selectedClassId: string | null,
): string[] {
  const licenceType = bp.licence
  if (!licenceType) return []

  const bpFactions = bp.factions || []
  if (bpFactions.length === 0) return []

  let licenceFactions: Set<string> | undefined
  if (selectedClassId && classLicenceFactions?.[selectedClassId]) {
    const clsData = classLicenceFactions[selectedClassId]
    const candidates = new Set<string>()
    for (const fid of Object.keys(clsData)) {
      if (clsData[fid]?.[licenceType] != null) candidates.add(fid)
    }
    if (candidates.size > 0) licenceFactions = candidates
  }

  return bpFactions.filter(fid => {
    const faction = factions.find(f => f.id === fid)
    if (!faction) return false
    if (faction.noblueprintsale || faction.nodiplomacyselection) return false
    if (licenceFactions && !licenceFactions.has(fid)) return false
    return faction.licences?.some(l => l.type === licenceType)
  })
}

function getLicenceStateForFaction(
  factionId: string,
  licenceType: string,
  playerData: PlayerBindingData | null,
  factions: X4Faction[],
): LicencePurchaseState {
  if (!playerData) return 'default'
  const faction = factions.find(f => f.id === factionId)
  if (!faction || !faction.licences) return 'default'
  const licence = faction.licences.find(l => l.type === licenceType)
  return getLicencePurchaseState(factionId, licenceType, playerData, licence?.minrelation)
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
  isLiveMode: ComputedRef<boolean>
  blueprintStatusFilter: Ref<Set<BlueprintPurchaseStatus>>
  blueprintStatusAllState: ComputedRef<'all' | 'none' | 'partial'>
  toggleBlueprintStatusFilter: (status: BlueprintPurchaseStatus) => void
  toggleAllBlueprintStatusFilter: () => void
  blueprintStatusMap: ComputedRef<Record<string, BlueprintPurchaseStatus>>
  blueprintLockedReasonMap: ComputedRef<Record<string, BlueprintLockedReason>>
  blueprintStatusCounts: ComputedRef<Record<string, number>>
  getFactionLicenceState: (factionId: string, licenceType: string) => LicencePurchaseState
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
  playerData?: Ref<PlayerBindingData | null>
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
  const blueprintStatusFilter = ref<Set<BlueprintPurchaseStatus>>(
    new Set(['owned', 'purchasable', 'licence_needed', 'rep_needed', 'locked', 'no_licence']),
  )

  const playerDataRef = computed(() => store.playerData?.value ?? null)

  const isLiveMode = computed(() => playerDataRef.value !== null)

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
    const factionNoBlueprintSale = new Set(
      store.factions.value
        .filter(f => f.noblueprintsale || f.nodiplomacyselection)
        .map(f => f.id),
    )

    const result: FactionLicenceEntry[] = Object.entries(merged)
      .map(([fid, lm]) => {
        const pd = playerDataRef.value
        const relRaw = pd?.relations?.[fid]
        return {
          factionId: fid,
          factionName: fdn[fid] || fid,
          relationLabel: pd ? formatRelation(relRaw) : undefined,
          licences: Object.entries(lm)
            .map(([lid]) => {
              const fl = floop[fid]?.[lid]
              const state = getLicencePurchaseState(fid, lid, pd, fl?.mr)
              return { id: lid, name: fl?.name || gln[lid] || lid, rep: repFromMinrelation(fl?.mr), state }
            })
            .sort((a, b) => {
              if (a.rep == null && b.rep == null) return a.name.localeCompare(b.name)
              if (a.rep == null) return 1
              if (b.rep == null) return -1
              return a.rep - b.rep
            }),
        }
      })
      .sort((a, b) => {
        const aNoSale = factionNoBlueprintSale.has(a.factionId)
        const bNoSale = factionNoBlueprintSale.has(b.factionId)
        if (aNoSale !== bNoSale) return aNoSale ? 1 : -1
        return a.factionName.localeCompare(b.factionName)
      })

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

  const blueprintStatusMap = computed(() => {
    const map: Record<string, BlueprintPurchaseStatus> = {}
    const pd = playerDataRef.value
    const clsLicFactions = store.blueprintsData.value?.faction_blueprints
    for (const bp of classBlueprints.value) {
      const { status } = getBlueprintPurchaseStatus(
        bp, pd, store.factions.value, clsLicFactions, selectedClassId.value,
      )
      map[bp.id] = status
    }
    return map
  })

  const blueprintLockedReasonMap = computed(() => {
    const map: Record<string, BlueprintLockedReason> = {}
    const pd = playerDataRef.value
    const clsLicFactions = store.blueprintsData.value?.faction_blueprints
    for (const bp of classBlueprints.value) {
      const { lockedReason } = getBlueprintPurchaseStatus(
        bp, pd, store.factions.value, clsLicFactions, selectedClassId.value,
      )
      if (lockedReason) map[bp.id] = lockedReason
    }
    return map
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

    if (blueprintStatusFilter.value.size < 6) {
      result = result.filter(bp => blueprintStatusFilter.value.has(blueprintStatusMap.value[bp.id] ?? 'no_player_data'))
    }

    return result
  })

  const blueprintStatusCounts = computed(() => {
    const counts: Record<string, number> = {}
    const q = searchQuery.value.toLowerCase().trim()
    let result = classBlueprints.value

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

    for (const bp of result) {
      const s = blueprintStatusMap.value[bp.id] || 'no_player_data'
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  })

  function getFactionLicenceState(factionId: string, licenceType: string): LicencePurchaseState {
    return getLicenceStateForFaction(factionId, licenceType, playerDataRef.value, store.factions.value)
  }

  function toggleBlueprintStatusFilter(status: BlueprintPurchaseStatus) {
    const next = new Set(blueprintStatusFilter.value)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    blueprintStatusFilter.value = next
  }

  const ALL_BLUEPRINT_STATUSES: BlueprintPurchaseStatus[] = ['owned', 'purchasable', 'licence_needed', 'rep_needed', 'locked', 'no_licence']

  const blueprintStatusAllState = computed(() => {
    const size = blueprintStatusFilter.value.size
    if (size === 0) return 'none'
    if (size === ALL_BLUEPRINT_STATUSES.length) return 'all'
    return 'partial'
  })

  function toggleAllBlueprintStatusFilter() {
    const currentSize = blueprintStatusFilter.value.size
    if (currentSize > 0) {
      blueprintStatusFilter.value = new Set()
    } else {
      blueprintStatusFilter.value = new Set(ALL_BLUEPRINT_STATUSES)
    }
  }

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
    isLiveMode,
    blueprintStatusFilter,
    blueprintStatusAllState,
    toggleBlueprintStatusFilter,
    toggleAllBlueprintStatusFilter,
    blueprintStatusMap,
    blueprintLockedReasonMap,
    blueprintStatusCounts,
    getFactionLicenceState,
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
