<script setup lang="ts">
import { computed } from 'vue'
import type {
  TerraformingConditionScaleModel,
  TerraformingStatLineModel,
  TerraformingStatScaleModel,
} from '@/components/empire/presenters/useTerraformingPresenter'

interface Props {
  model: TerraformingStatScaleModel | TerraformingConditionScaleModel | TerraformingStatLineModel
  compact?: boolean
  centered?: boolean
  mode?: 'status' | 'condition' | 'impact'
  showEffectLabel?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'clickStat', statId: string): void
}>()

const requiredStateSet = computed(() => {
  if (!('requiredStates' in props.model) || !props.model.requiredStates) return new Set<number>()
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
    for (let value = range.start; value <= range.end; value += 1) {
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
  if (props.mode === 'status' || requiredStateSet.value.size === 0) {
    return [] as Array<{ startIndex: number; endIndex: number }>
  }

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

const effectMeta = computed(() => {
  if (!('effectDirection' in props.model)) {
    return {
      direction: 'none',
      start: null,
      end: null,
      label: '',
    } as const
  }

  const start = props.model.effectFromValue
  const end = props.model.effectToValue
  if (start === null || end === null || start === end) {
    return {
      direction: 'none',
      start: null,
      end: null,
      label: props.model.effectLabel || '',
    } as const
  }

  return {
    direction: props.model.effectDirection,
    start: Math.min(start, end) + 1,
    end: Math.max(start, end),
    label: props.model.effectLabel || '',
  } as const
})

const titleText = computed(() => {
  const lines = [
    `${props.model.statName}: ${props.model.currentValue}`,
    `state: ${props.model.currentState ?? '-'}`,
  ]
  if ('requirementLabel' in props.model && props.model.requirementLabel) {
    lines.push(`requirement: ${props.model.requirementLabel}`)
  }
  if ('effectLabel' in props.model && props.model.effectLabel) {
    lines.push(`effect: ${props.model.effectLabel}`)
  }
  return lines.join('\n')
})

const hasVisibleBlocks = computed(() => visibleBlocks.value.length > 0)

const numericText = computed(() => {
  if ('numericText' in props.model && props.model.numericText) return props.model.numericText
  if ('requirementLabel' in props.model && props.model.requirementLabel) {
    const prefix = `${props.model.statName} `
    if (props.model.requirementLabel.startsWith(prefix)) {
      return props.model.requirementLabel.slice(prefix.length)
    }
    return props.model.requirementLabel
  }
  return props.model.currentValue.toLocaleString()
})

function blockBorderStyle(block: { value: number; state: number; rgb: string }): { borderColor: string; backgroundColor?: string; '--effect-color'?: string } {
  if (block.value <= props.model.currentValue) {
    return { borderColor: block.rgb, backgroundColor: block.rgb, '--effect-color': block.rgb }
  }
  return { borderColor: block.rgb, backgroundColor: 'transparent', '--effect-color': block.rgb }
}

function isEffectBlock(value: number): boolean {
  if (effectMeta.value.direction === 'none') return false
  const { start, end } = effectMeta.value
  if (start === null || end === null) return false
  return value >= start && value <= end
}
</script>

<template>
  <div class="stat-scale" :class="{ compact, centered, impact: mode === 'impact' }" :title="titleText">
    <div class="scale-line" :class="{ centered, impact: mode === 'impact' }">
      <span class="stat-name" @click.stop="emit('clickStat', model.statId)">{{ model.statName }}</span>
      <template v-if="hasVisibleBlocks">
        <span
          v-if="mode === 'impact' && showEffectLabel && effectMeta.label"
          class="effect-label"
        >
          {{ effectMeta.label }}
        </span>
        <div class="block-strip" :class="{ condition: mode === 'condition' || mode === 'impact', impact: mode === 'impact' }">
          <div
            v-for="segment in requiredSegments"
            :key="`${model.statId}-segment-${segment.startIndex}-${segment.endIndex}`"
            class="condition-segment"
            :style="{
              left: `calc(${segment.startIndex} * (var(--block-size) + var(--block-gap)) - var(--segment-padding-x))`,
              width: `calc(${segment.endIndex - segment.startIndex + 1} * var(--block-size) + ${segment.endIndex - segment.startIndex} * var(--block-gap) + 2 * var(--segment-padding-x))`,
            }"
          />
          <div
            v-for="block in visibleBlocks"
            :key="`${model.statId}-${block.state}-${block.value}`"
            class="scale-block"
            :class="{
              unsafe: block.habitable === false,
              'effect-increase': isEffectBlock(block.value) && effectMeta.direction === 'increase',
              'effect-decrease': isEffectBlock(block.value) && effectMeta.direction === 'decrease',
            }"
            :style="blockBorderStyle(block)"
          >
            <span
              v-if="isEffectBlock(block.value) && effectMeta.direction !== 'none'"
              class="effect-marker"
              :class="{
                increase: effectMeta.direction === 'increase',
                decrease: effectMeta.direction === 'decrease',
              }"
            />
            <span class="sr-only">{{ block.value }}</span>
          </div>
        </div>
      </template>
      <template v-else>
        <span class="numeric-value" :class="{ impact: mode === 'impact' }">{{ numericText }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stat-scale {
  --void-bg: rgb(2, 6, 23);
  @apply rounded border border-slate-700/40 bg-slate-950/40 px-2 py-2;
}
.stat-scale.compact { @apply px-2 py-2; }
.stat-scale.impact { @apply px-2 py-1.5; }

.scale-line { @apply flex items-center gap-1.5 flex-wrap text-xs; }
.scale-line.centered { @apply justify-center text-center; }
.scale-line.impact {
  @apply flex-nowrap;
  gap: 0.5625rem;
}

.stat-name { @apply text-slate-300 font-medium shrink-0 cursor-pointer hover:text-sky-400 transition-colors; }
.numeric-value { @apply font-mono text-sky-300; }
.numeric-value.impact { @apply text-slate-300; }
.effect-label { @apply text-[11px] text-sky-300 font-mono shrink-0; }

.block-strip {
  --block-size: 1rem;
  --block-gap: 0.375rem;
  --segment-padding-x: calc(var(--block-gap) / 2 + 1px);
  --segment-padding-y: 2px;
  @apply relative flex items-center;
  margin-left: var(--block-gap);
  gap: var(--block-gap);
  min-height: calc(var(--block-size) + 2 * var(--segment-padding-y));
}

.block-strip.impact {
  --block-size: 0.875rem;
  --block-gap: 0.25rem;
  margin-left: 0;
}

.scale-block {
  @apply h-4 w-4 rounded-sm border border-white/10 opacity-85 transition-all flex-none relative overflow-hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.block-strip.impact .scale-block {
  width: var(--block-size);
  height: var(--block-size);
}

.scale-block.unsafe {
  filter: saturate(0.75);
}

.condition-segment {
  @apply absolute pointer-events-none border border-white/85;
  top: calc(-1 * var(--segment-padding-y));
  bottom: calc(-1 * var(--segment-padding-y));
  border-radius: calc(0.125rem + var(--segment-padding-y));
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18), 0 0 8px rgba(255, 255, 255, 0.12);
}

.effect-marker {
  @apply absolute inset-[22%] rounded-[2px] pointer-events-none;
}

.effect-marker.increase {
  background: var(--effect-color);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.35);
}

.effect-marker.decrease {
  background: var(--void-bg);
  box-shadow: inset 0 0 0 1px var(--effect-color);
}
</style>
