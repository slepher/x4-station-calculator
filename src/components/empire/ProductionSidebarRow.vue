<script setup lang="ts">
import type { SidebarRow } from './presenters/useProductionSidebarPresenter'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
withDefaults(defineProps<{ row: SidebarRow; compact: boolean; sortable?: boolean; menu?: boolean; indented?: boolean; expanded?: boolean | null; foldColor?: string }>(), { expanded: null })
defineEmits<{ select: [id: string]; menu: [id: string, event: MouseEvent]; toggle: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="sidebar-row" :class="{ active: row.active, indented, 'sidebar-tree-header': expanded !== null }" :data-testid="row.testId" :data-station-id="row.type === 'station' ? row.id : undefined" :data-entry-id="row.id" :title="row.tooltip" @contextmenu.prevent.stop="menu && $emit('menu', row.id, $event)">
    <span v-if="sortable && !compact" class="station-drag-handle" aria-hidden="true">⠿</span>
    <button v-if="expanded !== null" class="sector-chevron-btn" :style="{ backgroundColor: foldColor }" data-testid="sidebar-tree-toggle" :aria-expanded="expanded" :aria-label="t(expanded ? 'sidebar.collapse_group' : 'sidebar.expand_group', { name: row.name })" @click.stop="$emit('toggle')">
      <ChevronUpIcon v-if="expanded" class="sidebar-chevron-icon" aria-hidden="true" />
      <ChevronDownIcon v-else class="sidebar-chevron-icon" aria-hidden="true" />
    </button>
    <button v-if="expanded === null || !compact" class="sidebar-nav" :class="{ disabled: row.disabled }" :aria-current="row.active ? 'page' : undefined" :aria-disabled="row.disabled" @click.stop="$emit('select', row.id)">
      <span v-if="expanded === null" class="sidebar-icon-wrap"><img class="sidebar-item-icon" :class="row.iconClass" :src="row.icon" alt=""><span v-if="row.status" class="sidebar-status-dot" :aria-label="row.status" /></span>
      <span v-if="!compact" class="sidebar-item-label">{{ row.name }}</span>
    </button>
    <button v-if="menu && !compact" class="sidebar-more" data-testid="sidebar-station-menu" :aria-label="row.tooltip" @click.stop="$emit('menu', row.id, $event)">⋮</button>
  </div>
</template>
