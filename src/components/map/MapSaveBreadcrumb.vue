<script setup lang="ts">
import { computed } from 'vue'

interface BreadcrumbItem {
  key: string
  label: string
  clickable?: boolean
}

const props = defineProps<{
  items: BreadcrumbItem[]
}>()

const emit = defineEmits<{
  (e: 'navigate', key: string): void
}>()

const processedItems = computed(() => {
  return props.items.map((item, index) => ({
    ...item,
    clickable: item.clickable ?? index < props.items.length - 1,
    isLast: index === props.items.length - 1
  }))
})

function onItemClick(key: string, clickable: boolean) {
  if (clickable) {
    emit('navigate', key)
  }
}
</script>

<template>
  <div class="save-breadcrumb">
    <template v-for="item in processedItems" :key="item.key">
      <span
        class="breadcrumb-item"
        :class="{ clickable: item.clickable, last: item.isLast }"
        @click="onItemClick(item.key, item.clickable)"
      >
        {{ item.label }}
      </span>
      <span v-if="!item.isLast" class="breadcrumb-separator">→</span>
    </template>
  </div>
</template>

<style scoped>
.save-breadcrumb {
  @apply flex items-center gap-1 text-xs text-amber-200/80 mb-3;
}

.breadcrumb-item {
  @apply transition-colors duration-150;
}

.breadcrumb-item.clickable {
  @apply cursor-pointer hover:text-amber-100;
}

.breadcrumb-item.last {
  @apply text-amber-50 font-medium;
}

.breadcrumb-separator {
  @apply text-amber-100/50;
}
</style>