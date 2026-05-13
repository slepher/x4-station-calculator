<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { PreviewDerivedItem, PreviewItem, PreviewLinePlan, PreviewRequiredTag, PreviewDerivedTag } from '@/types/build-plan'
import type { LocalizedX4ModuleGroup } from '@/types/x4'

const { t, locale } = useI18n()
const gameData = useGameDataStore()

const props = defineProps<{
  lines: PreviewLinePlan[]
  title?: string
}>()

const derivedOrder: PreviewDerivedTag[] = ['target', 'production', 'build-material']
const requiredOrder: PreviewRequiredTag[] = ['production', 'build-material']

function getModuleCount(line: PreviewLinePlan): number {
  return new Set(
    line.items
      .filter((item): item is PreviewDerivedItem => item.kind === 'derived')
      .map(item => item.moduleId),
  ).size
}

function sortDerivedTags(tags: PreviewDerivedTag[]): PreviewDerivedTag[] {
  return [...tags].sort((left, right) => derivedOrder.indexOf(left) - derivedOrder.indexOf(right))
}

function sortRequiredTags(tags: PreviewRequiredTag[]): PreviewRequiredTag[] {
  return [...tags].sort((left, right) => requiredOrder.indexOf(left) - requiredOrder.indexOf(right))
}

function getTagLabel(tag: PreviewDerivedTag | PreviewRequiredTag): string {
  if (tag === 'target') return t('build_plan.target_short')
  if (tag === 'production') return t('build_plan.production_short')
  return t('build_plan.build_material_short')
}

function getDisplayName(item: PreviewItem): string {
  if (item.kind === 'derived') {
    const module = gameData.localizedModulesMap[item.moduleId]
    return module?.localeName || item.moduleId
  }
  const ware = gameData.localizedWaresMap[item.wareId]
  return ware?.localeName || item.wareId
}

function getModuleGroup(item: PreviewItem): LocalizedX4ModuleGroup | undefined {
  if (item.kind === 'derived') {
    const module = gameData.localizedModulesMap[item.moduleId]
    return module?.group ? gameData.localizedModuleGroupsMap[module.group] : undefined
  }
  const module = gameData.findModuleForWare(item.wareId, 'argon')
  return module?.group ? gameData.localizedModuleGroupsMap[module.group] : undefined
}

function getColorBarStyle(item: PreviewItem): Record<string, string> {
  const colorRgb = getModuleGroup(item)?.color_rgb
  return { backgroundColor: colorRgb || '#0ea5e9' }
}

function getDlcTag(item: PreviewItem): { label: string; isActive: boolean } | null {
  if (item.kind === 'derived') {
    const module = gameData.localizedModulesMap[item.moduleId]
    if (module && module.dlc_tag !== 'base') {
      return {
        label: gameData.getDlcDisplayName(module.dlc_tag),
        isActive: gameData.isDlcActive(module.dlc_tag),
      }
    }
    return null
  }
  const ware = gameData.localizedWaresMap[item.wareId]
  if (ware && ware.dlc_tag !== 'base') {
    return {
      label: gameData.getDlcDisplayName(ware.dlc_tag),
      isActive: gameData.isDlcActive(ware.dlc_tag),
    }
  }
  return null
}
</script>

<template>
  <div v-if="lines.length > 0" class="allocation-section space-y-2" data-testid="preview-section">
    <div v-if="title" class="allocation-section-title">{{ title }}</div>
    <div
      v-for="line in lines"
      :key="line.groupId || '__unmatched__'"
      class="allocation-group"
      :class="line.isUnmatched ? 'allocation-group--unmatched' : ''"
    >
      <div class="allocation-group-header">
        <span class="allocation-group-name">
          {{ line.isUnmatched ? t('build_plan.unmatched') : line.groupName || line.groupId }}
        </span>
        <span class="allocation-group-count">{{ getModuleCount(line) }}</span>
      </div>

      <div class="allocation-goal-list">
        <div
          v-for="(item, idx) in line.items"
          :key="`${line.groupId || 'un'}-${idx}`"
          class="goal-row"
        >
          <div class="color-bar" :style="getColorBarStyle(item)"></div>

          <div class="goal-info">
            <div class="goal-title-row">
              <span class="goal-name">{{ getDisplayName(item) }}</span>
              <span
                v-if="getDlcTag(item)"
                class="dlc-tag"
                :class="getDlcTag(item)!.isActive ? 'dlc-tag--active' : 'dlc-tag--inactive'"
              >
                {{ getDlcTag(item)!.label }}
              </span>
            </div>
          </div>

          <div class="goal-controls">
            <template v-if="item.kind === 'derived'">
              <span
                v-for="tag in sortDerivedTags(item.derived)"
                :key="`${idx}-d-${tag}-${locale}`"
                class="preview-tag preview-tag--derived"
              >
                {{ getTagLabel(tag) }}
              </span>
            </template>
            <template v-else>
              <span
                v-for="tag in sortRequiredTags(item.required)"
                :key="`${idx}-r-${tag}-${locale}`"
                class="preview-tag preview-tag--required"
              >
                {{ getTagLabel(tag) }}
              </span>
            </template>
            <span class="derived-badge" :title="t('build_plan.derived_locked')">
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.allocation-section-title {
  @apply text-xs font-semibold text-slate-400 uppercase tracking-wider;
}

.allocation-group {
  @apply bg-slate-800/40 border border-slate-700/60 rounded overflow-hidden;
}

.allocation-group--unmatched {
  @apply border-slate-600/30 border-dashed;
}

.allocation-group-header {
  @apply flex items-center justify-between px-2 py-1 bg-slate-700/40 border-b border-slate-700/60;
}

.allocation-group-name {
  @apply text-xs font-medium text-slate-300 truncate;
}

.allocation-group-count {
  @apply text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded;
}

.allocation-goal-list {
  @apply divide-y divide-slate-700/30;
}

.goal-row {
  @apply flex items-center px-2 py-1.5 hover:bg-slate-700/20 transition-colors;
}

.color-bar {
  @apply w-1 h-5 rounded-sm mr-1.5 flex-shrink-0;
}

.goal-info {
  @apply flex-1 min-w-0 mr-1.5;
}

.goal-title-row {
  @apply flex items-center gap-1 min-w-0;
}

.goal-name {
  @apply truncate text-xs text-slate-300;
}

.dlc-tag {
  @apply inline-flex max-w-[80px] flex-shrink-0 items-center rounded border px-1 py-px text-[9px] font-semibold uppercase tracking-wide;
}

.dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.goal-controls {
  @apply flex items-center gap-1 flex-shrink-0;
}

.preview-tag {
  @apply text-[10px] px-1 py-0.5 rounded font-medium;
}

.preview-tag--derived {
  @apply bg-emerald-900/40 text-emerald-300;
}

.preview-tag--required {
  @apply bg-rose-900/40 text-rose-300;
}

.derived-badge {
  @apply text-slate-500;
}
</style>
