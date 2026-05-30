<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useResearchPresenter } from '@/components/empire/presenters/useResearchPresenter'
import { getNodeConnectionSides } from './researchLayout'
import type { LayoutRow } from './researchLayout'
import ResearchEdgeLayer from './ResearchEdgeLayer.vue'

const gameData = useGameDataStore()
const { researchData, waresMap, localizedWaresMap, ships, maps, dlcs } = storeToRefs(gameData)
const p = useResearchPresenter({
  researchData,
  waresMap,
  localizedWaresMap,
  ships,
  maps,
  dlcs,
})

function nodeConnectionClasses(row: LayoutRow, nodeId: string) {
  const sides = getNodeConnectionSides(row, nodeId)
  return {
    'has-incoming': sides.incoming,
    'has-outgoing': sides.outgoing,
  }
}

function makeNodeKey(prefix: string, nodeId: string): string {
  return `research-node:${prefix}:${nodeId}`
}
</script>

<template>
  <div class="research-workbench">
    <div class="research-main">
      <div class="research-toolbar">
        <label class="toggle-label">
          <input type="checkbox" v-model="p.showConditional.value" />
          {{ p.t('research.show_conditional') }}
        </label>
      </div>
      <div v-if="p.filteredItems.value.length === 0" class="research-empty">
        {{ p.t('research.loading') }}
      </div>
      <div v-for="group in p.layoutGroups.value" :key="group.id" class="research-group">
        <h3 class="research-group-title">{{ p.t(group.nameKey) }}</h3>
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
              class="research-node"
              :class="{ 'is-selected': p.selectedItemId.value === ln.id, 'is-conditional': p.itemMap.value.get(ln.id)?.category === 'conditional' }"
              @click.stop="p.selectedItemId.value = p.selectedItemId.value === ln.id ? null : ln.id"
            >
              <div class="research-node-name">
                {{ p.displayName(p.itemMap.value.get(ln.id)!) }}
                <span
                  v-if="p.getMissionProgressNotes(p.itemMap.value.get(ln.id)!).length > 0"
                  class="research-info-icon"
                  v-tippy="{ content: p.getMissionProgressTooltip(p.itemMap.value.get(ln.id)!), placement: 'top', theme: 'material' }"
                >ⓘ</span>
              </div>
              <div class="research-node-meta">
                <span v-if="p.itemMap.value.get(ln.id)!.researchTime > 0" class="research-node-time">{{ p.itemMap.value.get(ln.id)!.researchTime }}s</span>
                <span v-if="Object.keys(p.itemMap.value.get(ln.id)!.cost).length > 0" class="research-node-cost">{{ p.formatCr(p.computeCostCr(p.itemMap.value.get(ln.id)!)) }}</span>
                <span v-if="p.itemMap.value.get(ln.id)?.category === 'conditional'" class="research-node-cond-tag">{{ p.t('research.tag_conditional') }}</span>
              </div>
            </div>
          </div>
          <div
            v-else
            class="research-chain-surface"
          >
            <ResearchEdgeLayer
              :row-key="`${group.id}:${ri}`"
              :edges="row.edges"
            />
            <div class="research-chain">
              <template v-for="(layerNodes, li) in p.makeLayers(row)" :key="li">
                <div class="chain-layer">
                  <div
                    v-for="ln in layerNodes"
                    :key="ln.id"
                    :data-tag-id="makeNodeKey(`${group.id}:${ri}`, ln.id)"
                    class="research-node"
                    :class="[
                      {
                        'is-selected': p.selectedItemId.value === ln.id,
                        'is-conditional': p.itemMap.value.get(ln.id)?.category === 'conditional',
                      },
                      nodeConnectionClasses(row, ln.id),
                    ]"
                    @click.stop="p.selectedItemId.value = p.selectedItemId.value === ln.id ? null : ln.id"
                  >
                    <div class="research-node-name">{{ p.displayName(p.itemMap.value.get(ln.id)!) }}
                      <span
                        v-if="p.getMissionProgressNotes(p.itemMap.value.get(ln.id)!).length > 0"
                        class="research-info-icon"
                        v-tippy="{ content: p.getMissionProgressTooltip(p.itemMap.value.get(ln.id)!), placement: 'top', theme: 'material' }"
                      >ⓘ</span>
                    </div>
                    <div class="research-node-meta">
                      <span v-if="p.itemMap.value.get(ln.id)!.researchTime > 0" class="research-node-time">{{ p.itemMap.value.get(ln.id)!.researchTime }}s</span>
                      <span v-if="Object.keys(p.itemMap.value.get(ln.id)!.cost).length > 0" class="research-node-cost">{{ p.formatCr(p.computeCostCr(p.itemMap.value.get(ln.id)!)) }}</span>
                      <span v-if="p.itemMap.value.get(ln.id)?.category === 'conditional'" class="research-node-cond-tag">{{ p.t('research.tag_conditional') }}</span>
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
      <div v-if="p.selectedItem.value" class="research-overlay" @click="p.selectedItemId.value = null">
        <div class="research-detail-panel" @click.stop>
          <button class="research-detail-close" @click="p.selectedItemId.value = null">&times;</button>
          <h3 class="research-detail-name">{{ p.displayName(p.selectedItem.value) }}</h3>
          <p v-if="p.selectedItem.value.descriptionId" class="research-detail-desc">{{ p.displayDesc(p.selectedItem.value) }}</p>
          <div class="research-detail-section">
            <h4>{{ p.t('research.detail.basic') }}</h4>
            <p>{{ p.t('research.detail.research_time') }}: {{ p.selectedItem.value.researchTime > 0 ? p.selectedItem.value.researchTime + 's' : p.t('research.detail.instant') }}</p>
            <p>{{ p.t('research.detail.category') }}: {{ p.t(`research.category.${p.selectedItem.value.category}`) }}</p>
            <p v-if="p.selectedItem.value.dlcTag && p.selectedItem.value.dlcTag !== 'base'">DLC: {{ p.resolveDlcName(p.selectedItem.value.dlcTag) }}</p>
          </div>
          <div v-if="Object.keys(p.selectedItem.value.cost).length > 0" class="research-detail-section">
            <h4>{{ p.t('research.detail.cost') }}</h4>
            <ul>
              <li v-for="(amount, wareId) in p.selectedItem.value.cost" :key="wareId">
                {{ p.resolveWareName(wareId) }} &times; {{ amount }}
              </li>
            </ul>
          </div>
          <div v-if="p.getItemDependencies(p.selectedItem.value).length > 0" class="research-detail-section">
            <h4>{{ p.t('research.detail.dependencies') }}</h4>
            <ul>
              <li v-for="dep in p.getItemDependencies(p.selectedItem.value)" :key="dep.id">
                {{ p.displayName(dep) }}
              </li>
            </ul>
          </div>
          <div v-if="p.selectedItem.value.unlock" class="research-detail-section">
            <h4>{{ p.t('research.detail.unlock') }}</h4>
            <p>{{ p.resolveUnlockText(p.selectedItem.value.unlock) }}</p>
          </div>
          <div v-if="p.getMissionProgressNotes(p.selectedItem.value).length > 0" class="research-detail-section">
            <h4>{{ p.t('research.detail.notes') }}</h4>
            <p v-for="note in p.getMissionProgressNotes(p.selectedItem.value)" :key="note">{{ note }}</p>
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

.research-row-wrap {
  margin-bottom: 1rem;
}

.research-row-wrap.has-edges {
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-color: var(--color-border, #444) transparent;
  scrollbar-width: thin;
}

.research-row-wrap.has-edges::-webkit-scrollbar {
  height: 6px;
}

.research-row-wrap.has-edges::-webkit-scrollbar-track {
  background: transparent;
}

.research-row-wrap.has-edges::-webkit-scrollbar-thumb {
  background: var(--color-border, #444);
  border-radius: 3px;
}

.research-row.flat-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 2.5rem;
}

.research-chain-surface {
  display: inline-block;
  position: relative;
  max-width: 100%;
  z-index: 0;
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
  gap: 0.75rem;
  width: 200px;
  flex-shrink: 0;
}

.research-chain-surface .research-node {
  position: relative;
}

.research-chain-surface .research-node.has-incoming::before,
.research-chain-surface .research-node.has-outgoing::after {
  content: '';
  position: absolute;
  background: var(--color-accent, #66aaff);
  opacity: 0.2;
  pointer-events: none;
  z-index: 0;
}

.research-chain-surface .research-node.has-incoming::before {
  left: -2.5rem;
  top: 50%;
  width: 2.5rem;
  height: 1px;
}

.research-chain-surface .research-node.has-outgoing::after {
  right: -2.5rem;
  top: 50%;
  width: 2.5rem;
  height: 1px;
}

.research-node {
  background: var(--color-bg, #222244);
  border: 1px solid var(--color-border, #333);
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s;
  width: 200px;
  flex-shrink: 0;
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

.research-info-icon {
  font-size: 0.85rem;
  color: var(--color-accent, #66aaff);
  margin-left: 0.35rem;
  cursor: help;
  vertical-align: text-top;
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
