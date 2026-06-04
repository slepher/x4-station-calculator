<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useBlueprintRecipePresenter } from '@/components/empire/presenters/useBlueprintRecipePresenter'
import type { PlayerBindingData, BlueprintPurchaseStatus, BlueprintLockedReason, LicencePurchaseState } from '@/components/empire/presenters/useBlueprintRecipePresenter'

const props = defineProps<{
  playerData?: PlayerBindingData | null
}>()

const gameData = useGameDataStore()
const { blueprintsData, factions } = storeToRefs(gameData)

const playerDataRef = computed(() => props.playerData ?? null)

const p = useBlueprintRecipePresenter({ blueprintsData, factions, playerData: playerDataRef })
const { t } = useI18n()

const {
  typesNav, selectedTypeId, selectedClassId, filteredBlueprints, searchQuery,
  factionLicenceTree, factionLicenceFilter, factionCheckState, expandedFactions,
  factionLicenceAllState, isLiveMode,
  blueprintStatusFilter, toggleBlueprintStatusFilter, toggleAllBlueprintStatusFilter,
  blueprintStatusAllState,
  blueprintStatusMap, blueprintLockedReasonMap, blueprintStatusCounts,
  getFactionLicenceState,
} = p.props
const {
  selectType, selectClass, updateSearchQuery,
  toggleFactionAllLicences, toggleAllFactionLicences, toggleFactionLicence, toggleExpandedFaction,
} = p.emits

const expandedTypes = ref<Set<string>>(new Set(p.props.typesNav.value.map(t => t.id)))

const noblueprintsaleFactions = computed(() => {
  const set = new Set<string>()
  for (const f of factions.value) {
    if (f.noblueprintsale || f.nodiplomacyselection) set.add(f.id)
  }
  set.add('__generic__')
  return set
})

const licenceStateColors: Record<LicencePurchaseState, string> = {
  licensed: 'bp-lic-licensed',
  eligible: 'bp-lic-eligible',
  rep_needed: 'bp-lic-rep-needed',
  default: 'bp-lic-default',
}

const blueprintStatusLabels: Record<string, string> = {
  owned: t('blueprint_recipe.status_owned'),
  purchasable: t('blueprint_recipe.status_purchasable'),
  licence_needed: t('blueprint_recipe.status_licence_needed'),
  rep_needed: t('blueprint_recipe.status_rep_needed'),
  locked: t('blueprint_recipe.status_locked'),
  no_licence: t('blueprint_recipe.status_no_licence'),
}

const blueprintStatusClasses: Record<string, string> = {
  owned: 'bp-badge-owned',
  purchasable: 'bp-badge-purchasable',
  licence_needed: 'bp-badge-licence-needed',
  rep_needed: 'bp-badge-rep-needed',
  locked: 'bp-badge-locked',
  no_licence: 'bp-badge-no-licence',
}

const lockedReasonLabels: Record<BlueprintLockedReason, string> = {
  no_seller: t('blueprint_recipe.locked_no_seller'),
  faction_no_blueprint_sale: t('blueprint_recipe.locked_faction_no_sale'),
  no_diplomacy: t('blueprint_recipe.locked_no_diplomacy'),
  unknown_licence: t('blueprint_recipe.locked_unknown_licence'),
}

function toggleType(typeId: string) {
  const next = new Set(expandedTypes.value)
  if (next.has(typeId)) {
    next.delete(typeId)
  } else {
    next.add(typeId)
  }
  expandedTypes.value = next
}

function resolveName(bp: { nameId: string; name: string; id: string }): string {
  if (bp.nameId) {
    const resolved = t(bp.nameId)
    if (resolved !== bp.nameId) return resolved
  }
  return bp.name || bp.id
}

function formatPrice(price: number | undefined): string {
  if (price == null) return ''
  if (price >= 1e6) return (price / 1e6).toFixed(1) + ' MCr'
  if (price >= 1e3) return (price / 1e3).toFixed(1) + ' kCr'
  return price.toFixed(0) + ' Cr'
}

function resolveLicenceForFaction(factionId: string, ltype: string | undefined): string {
  if (!ltype) return ''
  const faction = factions.value.find(f => f.id === factionId)
  if (faction && faction.licences) {
    const match = faction.licences.find(l => l.type === ltype)
    if (match && match.nameId) {
      const resolved = t(match.nameId)
      if (resolved !== match.nameId) return resolved
      if (match.name) return match.name
    }
  }
  return ''
}

function licenceStateForTag(factionId: string, licenceType: string | undefined): LicencePurchaseState {
  if (!licenceType) return 'default'
  return getFactionLicenceState(factionId, licenceType)
}

function statusCount(status: string): number {
  return blueprintStatusCounts.value[status] || 0
}
</script>

<template>
  <div class="blueprint-recipe-workbench">
    <div class="bp-nav custom-scrollbar">
      <div
        v-for="typeGroup in typesNav"
        :key="typeGroup.id"
        class="bp-nav-group"
      >
        <button
          class="bp-nav-type"
          :class="{ active: selectedTypeId === typeGroup.id }"
          @click="selectType(typeGroup.id); toggleType(typeGroup.id)"
        >
          <svg
            class="bp-nav-chevron"
            :class="{ rotated: expandedTypes.has(typeGroup.id) }"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m9 18 6-6-6-6"></path>
          </svg>
          <span class="bp-nav-type-name">{{ typeGroup.name }}</span>
        </button>
        <div v-if="expandedTypes.has(typeGroup.id)" class="bp-nav-classes">
          <button
            v-for="cls in typeGroup.classes"
            :key="cls.id"
            class="bp-nav-class"
            :class="{ active: selectedClassId === cls.id }"
            @click="selectClass(cls.id)"
          >
            {{ cls.name }}
          </button>
        </div>
      </div>
    </div>

    <div class="bp-filter-panel custom-scrollbar">
      <div v-if="isLiveMode && selectedClassId" class="bp-filter-section">
        <div class="bp-filter-title">
          <label class="bp-filter-item bp-filter-title-item">
            <input
              type="checkbox"
              :indeterminate.prop="blueprintStatusAllState === 'partial'"
              :checked="blueprintStatusAllState === 'all'"
              @change="toggleAllBlueprintStatusFilter()"
            />
            <span>{{ t('blueprint_recipe.blueprint_status') }}</span>
          </label>
        </div>
        <label
          v-for="status in ['owned', 'purchasable', 'licence_needed', 'rep_needed', 'locked', 'no_licence']"
          :key="status"
          class="bp-filter-item bp-filter-status-item"
        >
          <input
            type="checkbox"
            :checked="blueprintStatusFilter.has(status as BlueprintPurchaseStatus)"
            @change="toggleBlueprintStatusFilter(status as BlueprintPurchaseStatus)"
          />
          <span>{{ blueprintStatusLabels[status] }}</span>
          <span class="bp-status-count">{{ statusCount(status) }}</span>
        </label>
      </div>

      <div v-if="factionLicenceTree.length > 0" class="bp-filter-section">
        <div class="bp-filter-title">
          <label class="bp-filter-item bp-filter-title-item">
            <input
              v-if="selectedClassId"
              type="checkbox"
              :indeterminate.prop="factionLicenceAllState === 'partial'"
              :checked="factionLicenceAllState === 'none'"
              @change="toggleAllFactionLicences()"
            />
            <span>{{ t('blueprint_recipe.factions') }}</span>
          </label>
        </div>
        <div
          v-for="entry in factionLicenceTree"
          :key="entry.factionId"
          class="bp-filter-faction-group"
        >
          <div class="bp-filter-faction">
            <button
              v-if="!noblueprintsaleFactions.has(entry.factionId)"
              class="bp-filter-expand"
              @click="toggleExpandedFaction(entry.factionId)"
            >
              {{ expandedFactions.has(entry.factionId) ? '▼' : '▶' }}
            </button>
            <span v-else class="bp-filter-expand-placeholder" />
            <label class="bp-filter-item bp-filter-faction-item">
              <input
                v-if="selectedClassId"
                type="checkbox"
                :indeterminate.prop="!noblueprintsaleFactions.has(entry.factionId) && factionCheckState[entry.factionId] === 'partial'"
                :checked="factionCheckState[entry.factionId] === 'none'"
                @change="toggleFactionAllLicences(entry.factionId)"
              />
              <span class="bp-filter-label">{{ entry.factionName }}</span>
              <span v-if="isLiveMode && entry.relationLabel != null" class="bp-faction-rep">{{ entry.relationLabel }}</span>
            </label>
          </div>
          <div v-if="!noblueprintsaleFactions.has(entry.factionId) && expandedFactions.has(entry.factionId)" class="bp-filter-licences">
            <label
              v-for="l in entry.licences"
              :key="l.id"
              class="bp-filter-item bp-filter-licence-item"
            >
              <input
                v-if="selectedClassId"
                type="checkbox"
                :checked="!(factionLicenceFilter.get(entry.factionId)?.has(l.id) ?? false)"
                @change="toggleFactionLicence(entry.factionId, l.id)"
              />
              <span class="bp-filter-label" :class="[licenceStateColors[l.state || 'default']]">{{ l.name }}</span>
              <span class="bp-licence-rep">{{ l.rep != null ? (l.rep > 0 ? '+' : '') + l.rep : '' }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="bp-content custom-scrollbar">
      <div class="bp-search-bar">
        <input
          :value="searchQuery"
          type="text"
          class="bp-search-input"
          :placeholder="t('blueprint_recipe.search')"
          @input="updateSearchQuery(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="bp-list">
        <div class="bp-list-header">
          <span class="bp-list-count">
            {{ filteredBlueprints.length }} {{ t('blueprint_recipe.results') }}
          </span>
        </div>

        <div v-if="filteredBlueprints.length === 0" class="bp-empty">
          {{ t('blueprint_recipe.no_results') }}
        </div>

        <div
          v-for="bp in filteredBlueprints"
          :key="bp.id"
          class="bp-item"
        >
          <div class="bp-item-top">
            <div class="bp-item-title">
              <div v-if="isLiveMode" class="bp-item-badges">
                <span
                  :class="['bp-badge', blueprintStatusClasses[blueprintStatusMap[bp.id]!] || 'bp-badge-default']"
                >{{ blueprintStatusLabels[blueprintStatusMap[bp.id]!] || blueprintStatusMap[bp.id] }}</span>
              </div>
              <div class="bp-item-name">{{ resolveName(bp) }}</div>
            </div>
            <span v-if="bp.price" class="bp-item-price">{{ formatPrice(bp.price) }}</span>
          </div>
          <div class="bp-item-factions" v-if="(bp.factions || []).length > 0">
            <div
              v-for="faction in bp.factions || []"
              :key="faction"
              class="bp-faction-group"
            >
              <span
                class="bp-tag bp-tag-faction"
                :class="{ 'bp-fr-none': !!resolveLicenceForFaction(faction, bp.licence) }"
              >{{ p.props.factionDisplayNames.value[faction] || faction }}</span>
              <span v-if="resolveLicenceForFaction(faction, bp.licence)" class="bp-tag bp-tag-licence" :class="[licenceStateColors[licenceStateForTag(faction, bp.licence)]]">{{ resolveLicenceForFaction(faction, bp.licence) }}</span>
            </div>
          </div>
          <div class="bp-item-meta" v-if="bp.missiononly || bp.noplayerblueprint || (isLiveMode && blueprintLockedReasonMap[bp.id])">
            <span v-if="bp.missiononly" class="bp-tag bp-tag-warn">{{ t('blueprint_recipe.mission_only') }}</span>
            <span v-if="bp.noplayerblueprint" class="bp-tag bp-tag-warn">{{ t('blueprint_recipe.no_player_blueprint') }}</span>
            <span v-if="isLiveMode && blueprintLockedReasonMap[bp.id]" class="bp-tag bp-tag-locked-reason">{{ lockedReasonLabels[blueprintLockedReasonMap[bp.id]!] }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blueprint-recipe-workbench {
  @apply flex flex-1 min-h-0;
}

.bp-nav {
  @apply w-56 flex-shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-900/50;
}

.bp-nav-group {
  @apply border-b border-slate-800/50;
}

.bp-nav-type {
  @apply w-full flex items-center gap-1.5 px-3 py-2 text-left text-sm font-medium;
  @apply text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 transition-colors;
}

.bp-nav-type.active {
  @apply text-sky-400 bg-slate-800/30;
}

.bp-nav-chevron {
  @apply w-3 h-3 flex-shrink-0 text-slate-500 transition-transform duration-150;
}

.bp-nav-chevron.rotated {
  @apply rotate-90;
}

.bp-nav-type-name {
  @apply flex-1 truncate;
}

.bp-nav-classes {
  @apply pl-6 pb-1;
}

.bp-nav-class {
  @apply w-full text-left px-3 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50;
  @apply rounded transition-colors;
}

.bp-nav-class.active {
  @apply text-sky-400 bg-slate-800/30;
}

.bp-filter-panel {
  @apply w-64 flex-shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-900/30 px-2 py-2;
}

.bp-filter-section {
  @apply mb-3;
}

.bp-filter-title {
  @apply flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1;
}

.bp-filter-faction-group {
  @apply mb-0.5;
}

.bp-filter-faction {
  @apply flex items-center gap-0.5;
}

.bp-filter-expand {
  @apply w-4 h-4 flex items-center justify-center text-[8px] text-slate-500 hover:text-slate-300;
  @apply flex-shrink-0 leading-none;
}

.bp-filter-expand-placeholder {
  @apply w-4 h-4 flex-shrink-0;
}

.bp-filter-item {
  @apply flex w-full items-center gap-1.5 px-1 py-0.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded;
}

.bp-filter-item input {
  @apply w-3 h-3;
}

.bp-filter-title-item {
  margin-left: -4px;
}

.bp-filter-licences {
  @apply pl-6;
}

.bp-filter-licence-item {
  @apply pl-1;
}

.bp-filter-faction-item {
  @apply min-w-0;
}

.bp-filter-label {
  @apply min-w-0 flex-1 truncate;
}

.bp-licence-rep {
  @apply ml-auto text-[10px] text-amber-400/70 font-mono inline-block w-8 text-right flex-shrink-0;
}

.bp-content {
  @apply flex-1 flex flex-col min-w-0 overflow-y-auto;
}

.bp-search-bar {
  @apply px-4 pt-4 pb-2;
}

.bp-search-input {
  @apply w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md;
  @apply text-slate-200 placeholder-slate-500 outline-none;
  @apply focus:border-sky-500 transition-colors;
}

.bp-list-header {
  @apply px-4 py-2 flex items-center;
}

.bp-list-count {
  @apply text-xs text-slate-500;
}

.bp-empty {
  @apply flex-1 flex items-center justify-center text-sm text-slate-500;
}

.bp-item {
  @apply px-4 py-2.5 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors;
}

.bp-item-top {
  @apply flex items-center justify-between;
}

.bp-item-title {
  @apply flex min-w-0 items-center gap-2;
}

.bp-item-name {
  @apply min-w-0 text-sm font-medium text-slate-200 truncate;
}

.bp-item-price {
  @apply ml-2 text-xs text-amber-400 flex-shrink-0;
}

.bp-item-factions {
  @apply flex flex-wrap items-center gap-1.5 mt-1.5;
}

.bp-item-meta {
  @apply flex flex-wrap items-center gap-1.5 mt-1.5;
}

.bp-faction-group {
  @apply inline-flex items-center gap-0;
}

.bp-tag {
  @apply inline-block text-[10px] px-1.5 py-0.5 font-medium;
  border-radius: 4px;
}

.bp-tag-faction {
  @apply bg-slate-700/50 text-slate-400 border border-slate-600/50;
}

.bp-tag-licence {
  @apply bg-blue-900/50 text-blue-300 border border-blue-800/50;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
}

.bp-fr-none {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.bp-tag-warn {
  @apply bg-amber-900/50 text-amber-400 border border-amber-800/50 rounded;
}

.bp-tag-locked-reason {
  @apply bg-red-900/50 text-red-400 border border-red-800/50 rounded;
}

.bp-faction-rep {
  @apply ml-auto text-[10px] text-amber-400/70 font-mono inline-block w-8 text-right flex-shrink-0;
}

.bp-filter-status-item {
  @apply justify-between;
}

.bp-status-count {
  @apply text-[10px] text-slate-500 font-mono ml-auto;
}

.bp-item-badges {
  @apply flex items-center gap-1;
}

.bp-badge {
  @apply text-[10px] px-1.5 py-0.5 font-medium rounded;
}

.bp-badge-owned {
  @apply bg-emerald-900/50 text-emerald-400 border border-emerald-800/50;
}

.bp-badge-purchasable {
  @apply bg-green-900/50 text-green-400 border border-green-800/50;
}

.bp-badge-licence-needed {
  @apply bg-orange-900/50 text-orange-400 border border-orange-800/50;
}

.bp-badge-rep-needed {
  @apply bg-red-900/50 text-red-400 border border-red-800/50;
}

.bp-badge-locked {
  @apply bg-slate-900/50 text-slate-400 border border-slate-700/50;
}

.bp-badge-no-licence {
  @apply bg-blue-900/50 text-blue-300 border border-blue-800/50;
}

.bp-badge-default {
  @apply bg-slate-900/50 text-slate-400 border border-slate-700/50;
}

.bp-lic-licensed {
  @apply text-green-400;
}

.bp-lic-eligible {
  @apply text-orange-400;
}

.bp-lic-rep-needed {
  @apply text-red-400;
}

.bp-lic-default {
  @apply text-blue-300;
}
</style>
