<script setup lang="ts">
import { ref, computed } from 'vue'
import { SketchPicker, ChromePicker, CompactPicker, SwatchesPicker, PhotoshopPicker, TwitterPicker, SliderPicker, MaterialPicker } from 'vue-color'
import { differenceCiede2000, parse } from 'culori'

const deltaE = differenceCiede2000()

function parseColors(hexes: string[]) {
  return hexes.map(c => parse(c)).filter((c): c is NonNullable<ReturnType<typeof parse>> => Boolean(c))
}

// ══════════════════════════════════════════════════════
// 色板
// ══════════════════════════════════════════════════════
// 自动分配用：27 彩色（9 色系 × 3 明度）
const COLORFUL: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E',
]

// UI 展示用：30 色 = 27 彩色 + 白/黑/透明（10 列 × 3 行）
const PALETTE: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF', '#FFFFFF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF', '#000000',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E', 'transparent',
]

/** 从不含 "#FFFFFF", "#000000", "transparent" 的彩色中 maximin 选 */
function pickDistinctColors(used: string[], count = 1): string[] {
  const parsedUsed = parseColors(used)
  const candidates = [...COLORFUL]
  const result: string[] = []

  while (result.length < count && candidates.length > 0) {
    let bestIdx = 0
    let bestMinDist = -Infinity
    const allSelected = [...parsedUsed, ...parseColors(result)]

    for (let i = 0; i < candidates.length; i++) {
      const pc = parse(candidates[i]!)
      if (!pc) continue
      const minDist = allSelected.length === 0 ? Infinity : Math.min(...allSelected.map(u => deltaE(pc, u)))
      if (minDist > bestMinDist) { bestMinDist = minDist; bestIdx = i }
    }
    result.push(candidates[bestIdx]!)
    candidates.splice(bestIdx, 1)
  }
  return result
}

/** 一次性选出 count 个相互差异最大的彩色 */
function getAllDistinctColors(count: number): string[] {
  return pickDistinctColors([], Math.min(count, COLORFUL.length))
}

// ══════════════════════════════════════════════════════
// Card state
// ══════════════════════════════════════════════════════
const PICKERS = ['Sketch', 'Chrome', 'Compact', 'Swatches', 'Photoshop', 'Twitter', 'Slider', 'Material'] as const
type PickerType = typeof PICKERS[number]

interface CardData { id: number; color: string; text: string; picker: PickerType }

const words = ['Station Hub', 'Trade Post', 'Sector Prime', 'Nova Core', 'Void Gate', 'Star Forge', 'Quantum Relay', 'Plasma Forge',
  'Crystal Mine', 'Energy Cell', 'Ore Refinery', 'Silicon Wafer', 'Microchip Plant', 'Smart Chip Fab', 'Claytronics Factory']

let nextId = 1
function randomWord() { return words[Math.floor(Math.random() * words.length)]! }
function createCard(): CardData {
  return { id: nextId++, color: '', text: randomWord(), picker: PICKERS[(nextId - 1) % PICKERS.length]! }
}

const cards = ref<CardData[]>([])
const colorsInUse = computed(() => cards.value.map(c => c.color).filter(Boolean))

function initCards(n: number) {
  cards.value = Array.from({ length: n }, createCard)
  const palette = getAllDistinctColors(n)
  cards.value.forEach((card, i) => { card.color = palette[i]! })
}
function addCard() {
  const card = createCard()
  card.color = pickDistinctColors(colorsInUse.value)[0]!
  cards.value.push(card)
}
function removeCard(id: number) { cards.value = cards.value.filter(c => c.id !== id) }
function rerollColors() {
  const palette = getAllDistinctColors(cards.value.length)
  cards.value.forEach((card, i) => { card.color = palette[i]! })
}
function onColorUpdate(card: CardData, hex: string) { card.color = hex }

// ══════════════════════════════════════════════════════
// Popover
// ══════════════════════════════════════════════════════
interface Popover { cardId: number; x: number; y: number }

const activePopover = ref<Popover | null>(null)
const activeCard = computed<CardData | null>(() =>
  activePopover.value ? cards.value.find(c => c.id === activePopover.value!.cardId) ?? null : null
)
function togglePopover(e: MouseEvent, cardId: number) {
  if (activePopover.value?.cardId === cardId) { activePopover.value = null; return }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  activePopover.value = { cardId, x: rect.left, y: rect.bottom + 4 }
}
function closePopover() { activePopover.value = null }
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closePopover() }

function minDeltaE(card: CardData): number {
  if (!card.color) return Infinity
  const p = parse(card.color)
  if (!p) return Infinity
  const others = parseColors(colorsInUse.value.filter(c => c !== card.color))
  return others.length ? Math.min(...others.map(u => deltaE(p, u))) : Infinity
}

initCards(8)
</script>

<template>
  <div class="root" @keydown="onKeydown">
    <div class="bar">
      <button class="btn" @click="addCard">+ 添加卡片</button>
      <button class="btn btn2" @click="rerollColors">⟳ 重新着色</button>
      <span class="count">{{ cards.length }} 张</span>
    </div>

    <div class="grid">
      <div v-for="card in cards" :key="card.id" class="card" :style="{ borderLeftColor: card.color || '#555' }">
        <div class="card-head">
          <span class="card-idx">#{{ card.id }}</span>
          <span class="card-name">{{ card.text }}</span>
          <span class="card-tag">{{ card.picker }}</span>
          <div class="card-acts">
            <button class="swatch" :class="{ empty: !card.color }"
              :style="{ background: card.color || 'transparent' }"
              @click="togglePopover($event, card.id)" title="选色" />
            <button class="del" @click="removeCard(card.id)" title="删除">×</button>
          </div>
        </div>
        <div class="card-foot">
          <code v-if="card.color" class="hex">{{ card.color }}</code>
          <code v-else class="hex dim">未着色</code>
          <span v-if="card.color && cards.length > 1" class="de" :class="{
            'de--ok': minDeltaE(card) >= 20, 'de--warn': minDeltaE(card) < 20 && minDeltaE(card) >= 15, 'de--bad': minDeltaE(card) < 15
          }">ΔE {{ minDeltaE(card).toFixed(1) }}</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="activePopover" class="overlay" @click="closePopover" />
      <div v-if="activePopover && activeCard" class="popper" :style="{ left: activePopover.x + 'px', top: activePopover.y + 'px' }"
        @click="(e: MouseEvent) => { if ((e.target as HTMLElement).closest('.preset-color')) closePopover() }">
        <SketchPicker v-if="activeCard.picker === 'Sketch'" :model-value="activeCard.color || '#3b82f6'" :preset-colors="PALETTE"
          :disable-alpha="true" @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
        <ChromePicker v-else-if="activeCard.picker === 'Chrome'" :model-value="activeCard.color || '#3b82f6'" :disable-alpha="true"
          :formats="['hex']" @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
        <CompactPicker v-else-if="activeCard.picker === 'Compact'" :model-value="activeCard.color || '#3b82f6'"
          @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
        <SwatchesPicker v-else-if="activeCard.picker === 'Swatches'" :model-value="activeCard.color || '#3b82f6'"
          @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
        <PhotoshopPicker v-else-if="activeCard.picker === 'Photoshop'" :model-value="activeCard.color || '#3b82f6'" ok-label="确定"
          cancel-label="取消" @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
        <TwitterPicker v-else-if="activeCard.picker === 'Twitter'" :model-value="activeCard.color || '#3b82f6'"
          @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
        <SliderPicker v-else-if="activeCard.picker === 'Slider'" :model-value="activeCard.color || '#3b82f6'"
          @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
        <MaterialPicker v-else-if="activeCard.picker === 'Material'" :model-value="activeCard.color || '#3b82f6'"
          @update:model-value="(v: any) => { if (typeof v === 'string') onColorUpdate(activeCard!, v) }" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.root { min-height: 100vh; background: #0f172a; color: #e2e8f0; padding: 24px; font-family: monospace; }
.bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.btn, .btn2 { border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 13px; font-family: monospace; }
.btn { background: #3b82f6; color: #fff; } .btn:hover { background: #2563eb; }
.btn2 { background: #475569; color: #fff; } .btn2:hover { background: #64748b; }
.count { color: #94a3b8; font-size: 13px; margin-left: 8px; }

.grid { display: flex; flex-wrap: wrap; gap: 10px; }
.card { background: #1e293b; border: 1px solid #334155; border-left: 4px solid #555; border-radius: 8px; padding: 10px 12px; width: 260px; transition: border-left-color .2s; }
.card-head { display: flex; align-items: center; gap: 8px; }
.card-idx { color: #64748b; font-size: 11px; min-width: 24px; }
.card-name { flex: 1; font-size: 14px; font-weight: 600; }
.card-tag { font-size: 10px; color: #64748b; background: #1e293b; border: 1px solid #334155; border-radius: 3px; padding: 1px 5px; }
.card-acts { display: flex; align-items: center; gap: 6px; }
.swatch { width: 20px; height: 20px; border-radius: 4px; border: 1px solid #475569; cursor: pointer; flex-shrink: 0; transition: transform .15s; }
.swatch:hover { transform: scale(1.15); }
.swatch.empty { border-style: dashed; border-color: #64748b; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 4px; }
.del:hover { color: #fca5a5; }
.card-foot { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.hex { font-size: 11px; color: #94a3b8; }
.dim { color: #64748b; }
.de { font-size: 11px; padding: 1px 6px; border-radius: 3px; }
.de--ok { color: #4ade80; background: #052e16; }
.de--warn { color: #fbbf24; background: #422006; }
.de--bad { color: #f87171; background: #450a0a; }

.overlay { position: fixed; inset: 0; z-index: 999; }
.popper { position: fixed; z-index: 1000; }
.popper :deep(.vc-sketch-picker) { width: 260px; }
.popper :deep(.presets) { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; padding: 10px 10px 8px; }
.popper :deep(.preset-color) { width: 100% !important; height: auto !important; aspect-ratio: 1; margin: 0 !important; }
.popper :deep(.preset-color[aria-selected="true"]) { box-shadow: 0 0 0 2px #1e293b, 0 0 0 4px #60a5fa !important; z-index: 1; }
</style>
