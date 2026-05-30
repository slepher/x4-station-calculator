<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import i18n from '@/i18n'
import type { X4ResearchItem } from '@/types/x4'
import {
  buildResearchLayoutGroups,
  getNodeConnectionSides,
  makeOrthogonalEdgePath,
  resolveEdgePointsInContainer,
} from './researchLayout'
import type { LayoutGroup, LayoutNode, LayoutRow } from './researchLayout'

const gameData = useGameDataStore()
const t = i18n.global.t.bind(i18n.global)

const showConditional = ref(false)
const selectedItemId = ref<string | null>(null)

const items = computed<X4ResearchItem[]>(() => {
  if (!gameData.researchData) return []
  return gameData.researchData.items.filter(item => {
    if (item.category === 'mission_progress') return false
    if (item.category === 'abandoned') return false
    if (item.category === 'conditional') return showConditional.value
    return true
  })
})

const itemMap = computed(() => {
  const map = new Map<string, X4ResearchItem>()
  items.value.forEach(item => map.set(item.id, item))
  return map
})

const layoutGroups = computed(() => buildResearchLayoutGroups(items.value))

interface RenderedEdge {
  key: string
  path: string
}

interface RowMetric {
  width: number
  height: number
}

const rowElements = new Map<string, HTMLElement>()
const nodeElements = new Map<string, HTMLElement>()
const renderedEdges = ref<Record<string, RenderedEdge[]>>({})
const rowMetrics = ref<Record<string, RowMetric>>({})
let animationFrameId: number | null = null

const selectedItem = computed(() => {
  if (!selectedItemId.value) return null
  return itemMap.value.get(selectedItemId.value) ?? null
})

function getVisibleDeps(itemId: string, group: LayoutGroup): X4ResearchItem[] {
  const visibleIds = new Set(group.rows.flatMap(r => r.nodes).map(n => n.id))
  const item = itemMap.value.get(itemId)
  if (!item) return []
  return item.dependencies
    .filter(d => visibleIds.has(d))
    .map(d => itemMap.value.get(d))
    .filter(Boolean) as X4ResearchItem[]
}

function makeLayers(row: LayoutRow): LayoutNode[][] {
  const layerMap = new Map<number, LayoutNode[]>()
  for (const ln of row.nodes) {
    const arr = layerMap.get(ln.layer) || []
    arr.push(ln)
    layerMap.set(ln.layer, arr)
  }
  const result: LayoutNode[][] = []
  for (let i = 0; ; i++) {
    const layer = layerMap.get(i)
    if (!layer) break
    result.push(layer)
  }
  return result
}

function makeRowKey(groupId: string, row: LayoutRow, index: number): string {
  return `${groupId}:${row.id}:${index}`
}

function makeNodeKey(rowKey: string, nodeId: string): string {
  return `${rowKey}:${nodeId}`
}

function setRowElement(key: string, value: Element | ComponentPublicInstance | null) {
  const element = resolveElement(value)
  if (element === null) {
    rowElements.delete(key)
  } else {
    rowElements.set(key, element)
  }
  scheduleEdgeRefresh()
}

function setNodeElement(key: string, value: Element | ComponentPublicInstance | null) {
  const element = resolveElement(value)
  if (element === null) {
    nodeElements.delete(key)
  } else {
    nodeElements.set(key, element)
  }
  scheduleEdgeRefresh()
}

function resolveElement(value: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (value === null) return null
  if (value instanceof Element) {
    if (value instanceof HTMLElement) return value
    return null
  }
  const vueElement = value.$el
  if (vueElement instanceof HTMLElement) return vueElement
  return null
}

function scheduleEdgeRefresh() {
  if (typeof window === 'undefined') return
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId)
  }
  animationFrameId = window.requestAnimationFrame(() => {
    animationFrameId = null
    refreshEdges()
  })
}

function refreshEdges() {
  const nextEdges: Record<string, RenderedEdge[]> = {}
  const nextMetrics: Record<string, RowMetric> = {}

  for (const group of layoutGroups.value) {
    group.rows.forEach((row, index) => {
      const key = makeRowKey(group.id, row, index)
      const rowElement = rowElements.get(key)
      if (rowElement === undefined) return

      const rowRect = rowElement.getBoundingClientRect()
      nextMetrics[key] = {
        width: rowRect.width,
        height: rowRect.height,
      }

      const edges: RenderedEdge[] = []
      row.edges.forEach(([sourceId, targetId]) => {
        const sourceElement = nodeElements.get(makeNodeKey(key, sourceId))
        const targetElement = nodeElements.get(makeNodeKey(key, targetId))
        if (sourceElement === undefined || targetElement === undefined) return

        const sourceRect = sourceElement.getBoundingClientRect()
        const targetRect = targetElement.getBoundingClientRect()
        edges.push({
          key: `${sourceId}:${targetId}`,
          path: makeOrthogonalEdgePath(resolveEdgePointsInContainer(
            rowRect,
            sourceRect,
            targetRect,
            rowElement,
          )),
        })
      })
      nextEdges[key] = edges
    })
  }

  rowMetrics.value = nextMetrics
  renderedEdges.value = nextEdges
}

function getRenderedEdges(key: string): RenderedEdge[] {
  const edges = renderedEdges.value[key]
  if (edges === undefined) return []
  return edges
}

function nodeConnectionClasses(row: LayoutRow, nodeId: string) {
  const sides = getNodeConnectionSides(row, nodeId)
  return {
    'has-incoming': sides.incoming,
    'has-outgoing': sides.outgoing,
  }
}

function rowMetricStyle(key: string) {
  const metric = rowMetrics.value[key]
  if (metric === undefined) {
    return {
      width: '0px',
      height: '0px',
    }
  }
  return {
    width: `${metric.width}px`,
    height: `${metric.height}px`,
  }
}

watch(layoutGroups, () => {
  nextTick(() => scheduleEdgeRefresh())
}, { flush: 'post' })

onMounted(() => {
  nextTick(() => scheduleEdgeRefresh())
  window.addEventListener('resize', scheduleEdgeRefresh)
})

onBeforeUnmount(() => {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId)
  }
  window.removeEventListener('resize', scheduleEdgeRefresh)
})

function displayName(item: X4ResearchItem): string {
  return t(item.nameId)
}

function displayDesc(item: X4ResearchItem): string {
  return item.descriptionId ? t(item.descriptionId) : ''
}

function resolveWareName(wareId: string): string {
  const locWare = gameData.localizedWaresMap[wareId]
  if (locWare && locWare.nameId) return t(locWare.nameId)
  return wareId
}

function getMissionProgressNotes(item: X4ResearchItem): string[] {
  if (!gameData.researchData) return []
  const notes: string[] = []
  for (const depId of item.dependencies) {
    const dep = gameData.researchData.items.find(i => i.id === depId)
    if (dep && dep.category === 'mission_progress') {
      notes.push(`${t('research.note.mission_progress')}: ${displayName(dep)}`)
    }
  }
  return notes
}

function getItemDependencies(item: X4ResearchItem): X4ResearchItem[] {
  return item.dependencies
    .map(id => itemMap.value.get(id))
    .filter(Boolean) as X4ResearchItem[]
}

function resolveUnlockText(unlock: NonNullable<X4ResearchItem['unlock']>): string {
  const p = unlock.params
  const ship = p?.shipNameId ? t(p.shipNameId) : ''
  const sector = p?.sectorNameId ? t(p.sectorNameId) : ''
  const item = p?.itemNameId ? t(p.itemNameId) : ''
  const npc = p?.npcNameId ? t(p.npcNameId) : ''
  const count = p?.count ? String(p.count) : ''

  if (unlock.key === 'abandoned_ship') {
    if (ship && sector) return t('research.unlock.abandoned_ship', { ship, sector })
    if (ship) return t('research.unlock.abandoned_ship_nosector', { ship })
  }
  if (unlock.key === 'erlking') {
    if (ship && sector) return t('research.unlock.erlking', { ship, sector })
  }
  if (unlock.key === 'condensate_sample') {
    if (npc && item) return t('research.unlock.condensate_sample', { npc, item })
  }
  if (unlock.key === 'xen_equipment') {
    if (item) return t('research.unlock.xen_equipment', { item })
  }
  if (unlock.key === 'interference_network') {
    if (count) return t('research.unlock.interference_network', { count })
  }

  return t(`research.unlock.${unlock.key}`)
}

function resolveDlcName(dlcTag: string): string {
  if (dlcTag === 'base') return ''
  const dlc = gameData.dlcs.find(d => d.id === `ego_${dlcTag}`)
  if (dlc && dlc.nameId) return t(dlc.nameId)
  return ''
}

function selectItem(id: string) {
  selectedItemId.value = selectedItemId.value === id ? null : id
}

function closeDetail() {
  selectedItemId.value = null
}
</script>

<template>
  <div class="research-workbench">
    <div class="research-main">
      <div class="research-toolbar">
        <label class="toggle-label">
          <input type="checkbox" v-model="showConditional" />
          {{ t('research.show_conditional') }}
        </label>
      </div>
      <div v-if="items.length === 0" class="research-empty">
        {{ t('research.loading') }}
      </div>
      <div v-for="group in layoutGroups" :key="group.id" class="research-group">
        <h3 class="research-group-title">{{ t(group.nameKey) }}</h3>
        <div
          v-for="(row, ri) in group.rows"
          :key="ri"
          class="research-row-wrap"
          :class="{ 'has-edges': row.edges.length > 0 }"
        >
          <div v-if="row.edges.length === 0" class="research-row flat-nodes">
            <div
              v-for="ln in row.nodes"
              :key="ln.id"
              :ref="(el) => setNodeElement(makeNodeKey(makeRowKey(group.id, row, ri), ln.id), el)"
              class="research-node"
              :class="{ 'is-selected': selectedItemId === ln.id, 'is-conditional': itemMap.get(ln.id)?.category === 'conditional' }"
              @click.stop="selectItem(ln.id)"
            >
              <div class="research-node-name">{{ displayName(itemMap.get(ln.id)!) }}</div>
              <div class="research-node-meta">
                <span v-if="itemMap.get(ln.id)!.researchTime > 0" class="research-node-time">{{ itemMap.get(ln.id)!.researchTime }}s</span>
                <span v-if="Object.keys(itemMap.get(ln.id)!.cost).length > 0" class="research-node-cost">{{ Object.keys(itemMap.get(ln.id)!.cost).length }}{{ t('research.resource_count') }}</span>
                <span v-if="itemMap.get(ln.id)?.category === 'conditional'" class="research-node-cond-tag">{{ t('research.tag_conditional') }}</span>
              </div>
              <div v-if="getVisibleDeps(ln.id, group).length > 0" class="research-node-deps">
                {{ t('research.deps_prefix') }}: {{ getVisibleDeps(ln.id, group).map(d => displayName(d)).join(', ') }}
              </div>
              <div v-for="note in getMissionProgressNotes(itemMap.get(ln.id)!)" :key="note" class="research-node-note">
                {{ note }}
              </div>
            </div>
          </div>
          <div
            v-else
            :ref="(el) => setRowElement(makeRowKey(group.id, row, ri), el)"
            class="research-chain-canvas"
          >
            <svg
              class="research-edge-layer"
              :style="rowMetricStyle(makeRowKey(group.id, row, ri))"
              aria-hidden="true"
            >
              <defs>
                <filter :id="`research-edge-glow-${group.id}-${ri}`" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="#cfeaff" flood-opacity="0.75" />
                </filter>
              </defs>
              <path
                v-for="edge in getRenderedEdges(makeRowKey(group.id, row, ri))"
                :key="edge.key"
                class="research-edge-line"
                :d="edge.path"
                :filter="`url(#research-edge-glow-${group.id}-${ri})`"
              />
            </svg>
            <div class="research-chain">
              <template v-for="(layerNodes, li) in makeLayers(row)" :key="li">
                <div class="chain-layer">
                  <div
                    v-for="ln in layerNodes"
                    :key="ln.id"
                    :ref="(el) => setNodeElement(makeNodeKey(makeRowKey(group.id, row, ri), ln.id), el)"
                    class="research-node"
                    :class="[
                      {
                        'is-selected': selectedItemId === ln.id,
                        'is-conditional': itemMap.get(ln.id)?.category === 'conditional',
                      },
                      nodeConnectionClasses(row, ln.id),
                    ]"
                    @click.stop="selectItem(ln.id)"
                  >
                    <div class="research-node-name">{{ displayName(itemMap.get(ln.id)!) }}</div>
                    <div class="research-node-meta">
                      <span v-if="itemMap.get(ln.id)!.researchTime > 0" class="research-node-time">{{ itemMap.get(ln.id)!.researchTime }}s</span>
                      <span v-if="Object.keys(itemMap.get(ln.id)!.cost).length > 0" class="research-node-cost">{{ Object.keys(itemMap.get(ln.id)!.cost).length }}{{ t('research.resource_count') }}</span>
                      <span v-if="itemMap.get(ln.id)?.category === 'conditional'" class="research-node-cond-tag">{{ t('research.tag_conditional') }}</span>
                    </div>
                    <div v-if="getVisibleDeps(ln.id, group).length > 0" class="research-node-deps">
                      {{ t('research.deps_prefix') }}: {{ getVisibleDeps(ln.id, group).map(d => displayName(d)).join(', ') }}
                    </div>
                    <div v-for="note in getMissionProgressNotes(itemMap.get(ln.id)!)" :key="note" class="research-node-note">
                      {{ note }}
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="selectedItem" class="research-overlay" @click="closeDetail">
        <div class="research-detail-panel" @click.stop>
          <button class="research-detail-close" @click="closeDetail">&times;</button>
          <h3 class="research-detail-name">{{ displayName(selectedItem) }}</h3>
          <p v-if="selectedItem.descriptionId" class="research-detail-desc">{{ displayDesc(selectedItem) }}</p>
          <div class="research-detail-section">
            <h4>{{ t('research.detail.basic') }}</h4>
            <p>{{ t('research.detail.research_time') }}: {{ selectedItem.researchTime > 0 ? selectedItem.researchTime + 's' : t('research.detail.instant') }}</p>
            <p>{{ t('research.detail.category') }}: {{ t(`research.category.${selectedItem.category}`) }}</p>
            <p v-if="selectedItem.dlcTag && selectedItem.dlcTag !== 'base'">DLC: {{ resolveDlcName(selectedItem.dlcTag) }}</p>
          </div>
          <div v-if="Object.keys(selectedItem.cost).length > 0" class="research-detail-section">
            <h4>{{ t('research.detail.cost') }}</h4>
            <ul>
              <li v-for="(amount, wareId) in selectedItem.cost" :key="wareId">
                {{ resolveWareName(wareId) }} &times; {{ amount }}
              </li>
            </ul>
          </div>
          <div v-if="getItemDependencies(selectedItem).length > 0" class="research-detail-section">
            <h4>{{ t('research.detail.dependencies') }}</h4>
            <ul>
              <li v-for="dep in getItemDependencies(selectedItem)" :key="dep.id">
                {{ displayName(dep) }}
              </li>
            </ul>
          </div>
          <div v-if="selectedItem.unlock" class="research-detail-section">
            <h4>{{ t('research.detail.unlock') }}</h4>
            <p>{{ resolveUnlockText(selectedItem.unlock) }}</p>
          </div>
          <div v-if="getMissionProgressNotes(selectedItem).length > 0" class="research-detail-section">
            <h4>{{ t('research.detail.notes') }}</h4>
            <p v-for="note in getMissionProgressNotes(selectedItem)" :key="note">{{ note }}</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.research-workbench {
  height: 100%;
  overflow-y: auto;
  background: var(--color-bg-secondary, #1a1a2e);
}

.research-main {
  padding: 1rem;
}

.research-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border, #333);
}

.toggle-label {
  font-size: 0.85rem;
  color: var(--color-text, #ccc);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.research-empty {
  color: var(--color-text-secondary, #666);
  font-size: 0.9rem;
  text-align: center;
  padding: 3rem;
}

.research-group {
  margin-bottom: 2rem;
}

.research-group-title {
  font-size: 1rem;
  color: var(--color-text, #ddd);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border, #333);
}

.research-nodes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.research-row-wrap {
  margin-bottom: 1rem;
}

.research-row-wrap.has-edges {
  overflow-x: auto;
  position: relative;
  scrollbar-width: none;
}

.research-row-wrap.has-edges::-webkit-scrollbar {
  display: none;
}

.research-row.flat-nodes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.research-chain-canvas {
  position: relative;
  width: max-content;
  min-width: min-content;
  padding: 0.5rem 0;
  overflow: visible;
}

.research-chain {
  display: flex;
  align-items: flex-start;
  gap: 2.5rem;
  position: relative;
  width: max-content;
  z-index: 1;
}

.chain-layer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 180px;
  position: relative;
  z-index: 1;
}

.research-edge-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 0;
  overflow: visible;
  min-width: 100%;
  min-height: 100%;
}

.research-edge-line {
  fill: none;
  stroke: rgba(235, 246, 255, 0.92);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.research-node {
  background: var(--color-bg, #222244);
  border: 1px solid var(--color-border, #333);
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s;
  min-width: 180px;
  max-width: 220px;
}

.research-row-wrap.has-edges .research-node {
  position: relative;
  z-index: 2;
}

.research-row-wrap.has-edges .research-node.has-incoming::before,
.research-row-wrap.has-edges .research-node.has-outgoing::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 0 6px rgba(220, 242, 255, 0.95);
  transform: translateY(-50%);
  z-index: 3;
}

.research-row-wrap.has-edges .research-node.has-incoming::before {
  left: -5px;
}

.research-row-wrap.has-edges .research-node.has-outgoing::after {
  right: -5px;
}

.research-node:hover {
  border-color: var(--color-accent, #66aaff);
}

.research-node.is-selected {
  border-color: var(--color-accent, #66aaff);
  background: rgba(102, 170, 255, 0.1);
}

.research-node.is-conditional {
  border-left: 3px solid #f0a050;
}

.research-node-name {
  font-size: 0.9rem;
  color: var(--color-text, #ccc);
  font-weight: 500;
  margin-bottom: 0.35rem;
}

.research-node-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #777);
}

.research-node-cond-tag {
  background: rgba(240, 160, 80, 0.2);
  color: #f0a050;
  padding: 0 4px;
  border-radius: 2px;
  font-size: 0.7rem;
}

.research-node-deps {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #666);
  margin-top: 0.35rem;
}

.research-node-note {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #555);
  margin-top: 0.25rem;
  font-style: italic;
}

.research-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.research-detail-panel {
  background: var(--color-bg, #1e1e3a);
  border: 1px solid var(--color-border, #444);
  border-radius: 8px;
  max-width: 520px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.research-detail-close {
  float: right;
  background: none;
  border: none;
  color: var(--color-text-secondary, #888);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0 0.25rem;
}

.research-detail-name {
  font-size: 1.1rem;
  color: var(--color-text, #ddd);
  margin: 0 0 0.5rem;
}

.research-detail-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #777);
  margin: 0 0 1rem;
  line-height: 1.4;
}

.research-detail-section {
  margin-bottom: 1rem;
}

.research-detail-section h4 {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #888);
  margin: 0 0 0.35rem;
  text-transform: uppercase;
}

.research-detail-section p,
.research-detail-section li {
  font-size: 0.85rem;
  color: var(--color-text, #bbb);
  margin: 0.15rem 0;
}

.research-detail-section ul {
  list-style: none;
  padding: 0;
}
</style>
