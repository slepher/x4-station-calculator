import { computed, ref, type Ref, type ComputedRef } from 'vue'
import i18n from '@/i18n'
import type { BlueprintsData, X4Blueprint, BlueprintTypeCategory, BlueprintClassCategory, X4Faction } from '@/types/x4'

export interface BlueprintRecipePresenterProps {
  typesNav: ComputedRef<{ id: string; name: string; classes: { id: string; name: string }[] }[]>
  selectedTypeId: Ref<string | null>
  selectedClassId: Ref<string | null>
  filteredBlueprints: ComputedRef<X4Blueprint[]>
  searchQuery: Ref<string>
  factionDisplayNames: ComputedRef<Record<string, string>>
  licenceDisplayNames: ComputedRef<Record<string, string>>
}

export interface BlueprintRecipePresenterEmits {
  selectType: (typeId: string) => void
  selectClass: (classId: string) => void
  updateSearchQuery: (query: string) => void
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

  const factionDisplayNames = computed(() => {
    const map: Record<string, string> = {}
    for (const f of store.factions.value) {
      map[f.id] = f.nameId ? t(f.nameId) : (f.name || f.id)
    }
    return map
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

  const filteredBlueprints = computed(() => {
    const data = store.blueprintsData.value
    if (!data || !selectedClassId.value) return []

    let result = data.blueprints.filter(bp => bp.class === selectedClassId.value && !bp.noplayerblueprint)

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

  const props: BlueprintRecipePresenterProps = {
    typesNav,
    selectedTypeId,
    selectedClassId,
    filteredBlueprints,
    searchQuery,
    factionDisplayNames,
    licenceDisplayNames,
  }

  const emits: BlueprintRecipePresenterEmits = {
    selectType,
    selectClass,
    updateSearchQuery,
  }

  return { props, emits }
}
