<script setup lang="ts">
import { computed } from 'vue'
import type { TerraformingConditionScaleModel, TerraformingStatScaleModel } from '@/components/empire/presenters/useTerraformingPresenter'

interface Props {
  model: TerraformingStatScaleModel | TerraformingConditionScaleModel
  compact?: boolean
  centered?: boolean
  mode?: 'status' | 'condition'
}

const props = defineProps<Props>()

const requiredStateSet = computed(() => {
  if (!('requiredStates' in props.model)) return new Set<number>()
  return new Set(props.model.requiredStates)
})

const visibleBlocks = computed(() => {
  const blocks: Array<{
    value: number
    state: number
    rgb: string
    habitable?: boolean
  }> = []

  for (const range of props.model.ranges) {
    const start = range.start
    const end = range.end

    for (let value = start; value <= end; value += 1) {
      if (value === 0) continue
      blocks.push({
        value,
        state: range.state,
        rgb: range.rgb,
        habitable: range.habitable,
      })
    }
  }

  return blocks
})

const requiredSegments = computed(() => {
  if (props.mode !== 'condition') return [] as Array<{ startIndex: number; endIndex: number }>

  const segments: Array<{ startIndex: number; endIndex: number }> = []
  let currentStart: number | null = null

  visibleBlocks.value.forEach((block, index) => {
    const isRequired = requiredStateSet.value.has(block.state)
    if (isRequired && currentStart === null) {
      currentStart = index
      return
    }
    if (!isRequired && currentStart !== null) {
      segments.push({ startIndex: currentStart, endIndex: index - 1 })
      currentStart = null
    }
  })

  if (currentStart !== null) {
    segments.push({ startIndex: currentStart, endIndex: visibleBlocks.value.length - 1 })
  }

  return segments
})

const titleText = computed(() => {
  const lines = [
    `${props.model.statName}: ${props.model.currentValue}`,
    `state: ${props.model.currentState ?? '-'}`,
  ]
  if ('requirementLabel' in props.model && props.model.requirementLabel) {
    lines.push(`requirement: ${props.model.requirementLabel}`)
  }
  return lines.join('\n')
})

const hasVisibleBlocks = computed(() => visibleBlocks.value.length > 0)

const numericRequirementText = computed(() => {
  if (!('requirementLabel' in props.model)) return ''
  const prefix = `${props.model.statName} `
  if (props.model.requirementLabel.startsWith(prefix)) {
    return props.model.requirementLabel.slice(prefix.length)
  }
  return props.model.requirementLabel
})

function blockStyle(): { backgroundColor: string } {
  return { backgroundColor: 'transparent' }
}

function blockBorderStyle(block: { value: number; state: number; rgb: string }): { borderColor: string; backgroundColor?: string } {
  if (block.value <= props.model.currentValue) {
    return { borderColor: block.rgb, backgroundColor: block.rgb }
  }
  return { borderColor: block.rgb, backgroundColor: 'transparent' }
}
</script>

<template>
  <div class="stat-scale" :class="{ compact, centered }" :title="titleText">
    <div class="scale-line" :class="{ centered }">
      <span class="stat-name">{{ model.statName }}</span>
      <template v-if="hasVisibleBlocks">
        <div class="block-strip" :class="{ condition: mode === 'condition' }">
          <div
            v-for="segment in requiredSegments"
            v-if="mode === 'condition'"
            :key="`${model.statId}-segment-${segment.startIndex}-${segment.endIndex}`"
            class="condition-segment"
            :style="{
              left: `calc(${segment.startIndex} * (var(--block-size) + var(--block-gap)) - var(--segment-padding))`,
              width: `calc(${segment.endIndex - segment.startIndex + 1} * var(--block-size) + ${segment.endIndex - segment.startIndex} * var(--block-gap) + 2 * var(--segment-padding))`,
            }"
          />
          <div
            v-for="block in visibleBlocks"
            :key="`${model.statId}-${block.state}-${block.value}`"
            class="scale-block"
            :class="{ unsafe: block.habitable === false }"
            :style="{ ...blockStyle(), ...blockBorderStyle(block) }"
          >
            <span class="sr-only">{{ block.value }}</span>
          </div>
        </div>
      </template>
      <template v-else>
        <span class="numeric-value">{{ model.currentValue.toLocaleString() }}</span>
        <span v-if="mode === 'condition' && numericRequirementText" class="numeric-requirement">
          {{ numericRequirementText }}
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stat-scale { @apply rounded border border-slate-700/40 bg-slate-950/40 px-2 py-1.5; }
.stat-scale.compact { @apply px-2 py-1; }

.scale-line { @apply flex items-center gap-1.5 flex-wrap text-xs; }
.scale-line.centered { @apply justify-center text-center; }
.stat-name { @apply text-slate-300 font-medium; }
.numeric-value { @apply font-mono text-sky-300; }
.numeric-requirement { @apply text-slate-500 font-mono; }
.block-strip {
  --block-size: 1rem;
  --block-gap: 0.375rem;
  --segment-padding: 2px;
  @apply relative flex items-center;
  gap: var(--block-gap);
}
.scale-block {
  @apply h-4 w-4 rounded-sm border border-white/10 opacity-85 transition-all flex-none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
.scale-block.unsafe {
  filter: saturate(0.75);
}
.condition-segment {
  @apply absolute pointer-events-none border border-white/85;
  top: calc(-1 * var(--segment-padding));
  bottom: calc(-1 * var(--segment-padding));
  border-radius: calc(0.125rem + var(--segment-padding));
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18), 0 0 8px rgba(255, 255, 255, 0.12);
}
</style>
