<script setup lang="ts">
import X4Select from '@/components/common/X4Select.vue'
import { useI18n } from 'vue-i18n'
import { useNpcTradePresenter } from '@/components/empire/presenters/useNpcTradePresenter'
import CandidateSearchBox from '@/components/common/CandidateSearchBox.vue'
import GroupedCandidatePopover from '@/components/common/GroupedCandidatePopover.vue'
import X4NumberInput from '@/components/common/X4NumberInput.vue'

const { t } = useI18n()
const presenter = useNpcTradePresenter()

const selectWare = (wareId: string, close: () => void) => {
  presenter.emits.addWare(wareId)
  close()
}
</script>

<template>
  <main class="npc-trade-grid" data-testid="npc-trade-workbench">
    <section class="panel-card col-span-12 lg:col-span-3" aria-labelledby="npc-trade-conditions-title">
      <h2 id="npc-trade-conditions-title" class="panel-header">{{ t('npc_trade.conditions') }}</h2>
      <div class="panel-content">
        <fieldset class="field-group">
          <legend class="field-label">{{ t('npc_trade.direction.label') }}</legend>
          <div class="segmented-control">
            <button
              type="button"
              :class="{ active: presenter.props.direction.value === 'sell' }"
              data-testid="npc-trade-direction-sell"
              @click="presenter.emits.setDirection('sell')"
            >
              {{ t('npc_trade.direction.sell') }}
            </button>
            <button
              type="button"
              :class="{ active: presenter.props.direction.value === 'buy' }"
              data-testid="npc-trade-direction-buy"
              @click="presenter.emits.setDirection('buy')"
            >
              {{ t('npc_trade.direction.buy') }}
            </button>
          </div>
        </fieldset>

        <label class="field-group">
          <span class="field-label">{{ t('npc_trade.player_station_group') }}</span>
          <X4Select
            class="field-control"
            :model-value="presenter.props.selectedPlayerStationGroupId.value === null ? '' : presenter.props.selectedPlayerStationGroupId.value"
            data-testid="npc-trade-player-station-group"
            @change="presenter.emits.selectPlayerStationGroup(($event.target as HTMLSelectElement).value === '' ? null : ($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ t('npc_trade.select_station_group') }}</option>
            <option v-for="group in presenter.props.stationGroups.value" :key="group.id" :value="group.id">
              {{ group.label }}
            </option>
          </X4Select>
        </label>

        <label class="field-group">
          <span class="field-label">{{ t('npc_trade.player_station') }}</span>
          <X4Select
            class="field-control"
            :disabled="presenter.props.selectedPlayerStationGroupId.value === null"
            :model-value="presenter.props.selectedPlayerStationId.value === null ? '' : presenter.props.selectedPlayerStationId.value"
            data-testid="npc-trade-player-station"
            @change="presenter.emits.selectPlayerStation(($event.target as HTMLSelectElement).value === '' ? null : ($event.target as HTMLSelectElement).value)"
          >
            <option v-if="presenter.props.selectedPlayerStationId.value === null" value="">{{ t('npc_trade.select_station') }}</option>
            <option
              v-for="option in presenter.props.selectedStationOptions.value"
              :key="option.id"
              :value="option.id"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </option>
          </X4Select>
        </label>

        <label v-if="presenter.props.selectedPlayerStationId.value !== null" class="jump-filter-row">
          <span class="field-label">{{ t('npc_trade.max_jumps') }}</span>
          <X4NumberInput
            :model-value="presenter.props.jumpLimit.value"
            :min="0"
            width-class="w-20"
            data-testid="npc-trade-max-jumps"
            @update:model-value="presenter.emits.setJumpLimit"
          />
        </label>

        <div class="field-group">
          <button
            type="button"
            class="field-control"
            :disabled="!presenter.props.autoFillAvailable.value"
            :title="presenter.props.autoFillDisabledReason.value === null ? undefined : presenter.props.autoFillDisabledReason.value"
            data-testid="npc-trade-auto-fill-button"
            @click="presenter.emits.autoFill"
          >{{ t('npc_trade.auto_fill.button') }}</button>
          <label class="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              :checked="presenter.props.autoFillEnabled.value"
              data-testid="npc-trade-auto-fill-enabled"
              @change="presenter.emits.setAutoFillEnabled(($event.target as HTMLInputElement).checked)"
            />
            {{ t('npc_trade.auto_fill.enabled') }}
          </label>
          <p class="field-label">{{ t('npc_trade.auto_fill.hint') }}</p>
          <p class="field-label" data-testid="npc-trade-auto-fill-scope">{{ presenter.props.autoFillScope.value }}</p>
          <p v-if="presenter.props.autoFillDisabledReason.value" class="text-xs text-amber-300">{{ presenter.props.autoFillDisabledReason.value }}</p>
          <p v-if="presenter.props.autoFillSource.value" class="field-label" data-testid="npc-trade-auto-fill-source">{{ presenter.props.autoFillSource.value }}</p>
          <p class="text-xs text-sky-300" role="status" data-testid="npc-trade-auto-fill-status">{{ presenter.props.autoFillStatus.value }}</p>
          <button
            v-if="presenter.props.autoFillCanUndo.value"
            type="button"
            class="text-left text-xs text-sky-300"
            data-testid="npc-trade-auto-fill-undo"
            @click="presenter.emits.undoAutoFill"
          >{{ t('npc_trade.auto_fill.undo') }}</button>
          <details v-if="presenter.props.autoFillDetails.value.length > 0" class="text-xs text-slate-400" data-testid="npc-trade-auto-fill-details">
            <summary class="cursor-pointer text-sky-300">{{ t('npc_trade.auto_fill.details') }}</summary>
            <p class="py-2">{{ t('npc_trade.auto_fill.account_hint') }}</p>
            <div v-for="item in presenter.props.autoFillDetails.value" :key="item.wareId" class="border-t border-slate-700 py-2">
              <p class="text-slate-200">{{ item.label }} · {{ item.currentLabel }}</p>
              <p>{{ item.summary }}</p>
              <details class="mt-1">
                <summary class="cursor-pointer">{{ t('npc_trade.player_station') }}</summary>
                <div v-for="station in item.stations" :key="station.entityId" class="py-1">
                  <p>{{ station.label }}</p>
                  <p>{{ station.summary }}</p>
                </div>
              </details>
            </div>
          </details>
        </div>

        <div class="field-group ware-search">
          <label class="field-label" for="npc-trade-ware-search">{{ t('npc_trade.ware_search') }}</label>
          <CandidateSearchBox
            input-id="npc-trade-ware-search"
            :query="presenter.props.searchQuery.value"
            :placeholder="t('npc_trade.ware_search_placeholder')"
            anchor-selector=".panel-card"
            :has-results="presenter.props.searchGroups.value.length > 0"
            @update-query="presenter.emits.setSearchQuery"
          >
            <template #default="{ open, position, close }">
              <GroupedCandidatePopover
                :open="open"
                :position="position"
                :groups="presenter.props.searchGroups.value"
                @select="selectWare($event, close)"
              />
            </template>
          </CandidateSearchBox>
        </div>

        <div class="ware-pills" aria-live="polite">
          <div
            v-for="target in presenter.props.wareTargets.value"
            :key="target.wareId"
            class="ware-pill"
          >
            <div class="ware-pill-header">
              <span class="ware-pill-name">{{ target.label }}</span>
              <button
                type="button"
                class="remove-button"
                :aria-label="t('npc_trade.remove_ware', { ware: target.label })"
                :data-testid="`npc-trade-remove-${target.wareId}`"
                @click="presenter.emits.removeWare(target.wareId)"
              >×</button>
            </div>
            <div class="ware-pill-controls">
              <span v-if="target.sourceLabel" class="text-xs text-sky-300">{{ target.sourceLabel }}</span>
              <label class="qty-label">
                <span class="sr-only">{{ target.label }} · {{ t('npc_trade.target_qty') }}</span>
                <X4NumberInput
                  :model-value="target.targetQty === null ? 0 : target.targetQty"
                  :min="0"
                  width-class="w-28"
                  :data-testid="`npc-trade-target-${target.wareId}`"
                  @update:model-value="(value: number) => presenter.emits.updateTargetQty(target.wareId, value === 0 ? null : value)"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel-card col-span-12 lg:col-span-5" aria-labelledby="npc-trade-candidates-title">
      <h2 id="npc-trade-candidates-title" class="panel-header">{{ t('npc_trade.candidates') }}</h2>
      <div class="panel-content">
        <div class="sort-grid">
          <label class="field-group">
            <span class="field-label">{{ t('npc_trade.rank_mode.label') }}</span>
            <X4Select
              class="field-control"
              :model-value="presenter.props.rankMode.value"
              data-testid="npc-trade-rank-mode"
              @change="presenter.emits.setRankMode(($event.target as HTMLSelectElement).value as 'primary' | 'composite')"
            >
              <option value="primary">{{ t('npc_trade.rank_mode.primary') }}</option>
              <option value="composite" :disabled="!presenter.props.canUseComposite.value">{{ t('npc_trade.rank_mode.composite') }}</option>
            </X4Select>
          </label>
          <label class="field-group">
            <span class="field-label">{{ t('npc_trade.sort.label') }}</span>
            <X4Select
              class="field-control"
              :model-value="presenter.props.sortMetric.value"
              data-testid="npc-trade-sort-metric"
              @change="presenter.emits.setSortMetric(($event.target as HTMLSelectElement).value as 'quantity' | 'price' | 'fillablePrice' | 'targetTotal')"
            >
              <option value="quantity">{{ t('npc_trade.sort.quantity') }}</option>
              <option value="price">{{ t('npc_trade.sort.price') }}</option>
              <option value="fillablePrice" :disabled="!presenter.props.canUseTargetMetric.value">{{ t('npc_trade.sort.fillable_price') }}</option>
              <option value="targetTotal" :disabled="!presenter.props.canUseTargetMetric.value">{{ presenter.props.direction.value === 'sell' ? t('npc_trade.sort.total_revenue') : t('npc_trade.sort.total_cost') }}</option>
            </X4Select>
          </label>
          <label class="field-group">
            <span class="field-label">{{ t('npc_trade.primary_ware') }}</span>
            <X4Select
              class="field-control"
              :model-value="presenter.props.primaryWareId.value === null ? '' : presenter.props.primaryWareId.value"
              data-testid="npc-trade-primary-ware"
              @change="presenter.emits.setPrimaryWare(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="target in presenter.props.wareTargets.value" :key="target.wareId" :value="target.wareId">
                {{ target.label }}
              </option>
            </X4Select>
          </label>
        </div>

        <div v-if="presenter.props.pageState.value !== 'results'" class="empty-state" :data-testid="`npc-trade-state-${presenter.props.pageState.value}`">
          {{ presenter.props.pageStateLabel.value }}
        </div>
        <div v-else class="candidate-list" data-testid="npc-trade-results">
          <section v-for="section in presenter.props.candidateSections.value" :key="section.key" class="candidate-section">
            <header class="sector-header">
              <span>{{ section.sectorLabel }}</span>
              <span class="sector-meta">
                <span v-if="section.sectorOwnerLabel">{{ section.sectorOwnerLabel }}</span>
                <span>{{ section.jumpLabel }}</span>
              </span>
            </header>
            <article v-for="station in section.stations" :key="station.key" class="station-card">
              <header class="station-header">
                <div>
                  <div class="station-title">{{ station.stationName }}</div>
                  <div class="station-code">{{ station.code }}</div>
                  <div v-if="station.ownerLabel" class="station-owner">{{ station.ownerLabel }}</div>
                </div>
                <span v-if="station.distanceLabel" class="station-distance">{{ station.distanceLabel }}</span>
              </header>
              <div v-for="ware in station.wareOffers" :key="ware.wareId" class="ware-offers">
                <h4>{{ ware.wareLabel }}</h4>
                <div v-for="offer in ware.offers" :key="offer.tradeId" class="offer-row">
                  <span class="source-badge">{{ offer.sourceLabel }}</span>
                  <span>{{ t('npc_trade.amount') }}: {{ offer.amount }}</span>
                  <span>{{ t('npc_trade.price') }}: {{ offer.price }}</span>
                </div>
              </div>
            </article>
          </section>
          <nav
            v-if="presenter.props.candidatePageCount.value > 1"
            class="pagination"
            :aria-label="t('npc_trade.pagination.label')"
          >
            <button
              type="button"
              :disabled="presenter.props.candidatePage.value <= 1"
              :aria-label="t('npc_trade.pagination.previous')"
              data-testid="npc-trade-page-prev"
              @click="presenter.emits.setCandidatePage(presenter.props.candidatePage.value - 1)"
            >‹</button>
            <span>{{ t('npc_trade.pagination.status', { current: presenter.props.candidatePage.value, total: presenter.props.candidatePageCount.value }) }}</span>
            <button
              type="button"
              :disabled="presenter.props.candidatePage.value >= presenter.props.candidatePageCount.value"
              :aria-label="t('npc_trade.pagination.next')"
              data-testid="npc-trade-page-next"
              @click="presenter.emits.setCandidatePage(presenter.props.candidatePage.value + 1)"
            >›</button>
          </nav>

          <section
            v-if="presenter.props.ineligibleFactionGroups.value.length > 0"
            class="ineligible-candidates"
            data-testid="npc-trade-insufficient-relations"
          >
            <h3 class="ineligible-title">{{ t('npc_trade.insufficient_relations') }}</h3>
            <details
              v-for="faction in presenter.props.ineligibleFactionGroups.value"
              :key="faction.key"
              :open="faction.expanded"
              class="faction-group"
              :data-testid="`npc-trade-ineligible-faction-${faction.key}`"
              @toggle="presenter.emits.setIneligibleFactionExpanded(faction.key, ($event.currentTarget as HTMLDetailsElement).open)"
            >
              <summary class="faction-summary">
                <span>{{ faction.factionLabel }}</span>
                <span>{{ t('npc_trade.reputation', { value: faction.reputationLabel }) }}</span>
              </summary>
              <div
                v-if="faction.expanded"
                class="faction-sectors"
                :data-testid="`npc-trade-ineligible-sectors-${faction.key}`"
              >
                <section v-for="section in faction.sectors" :key="section.key" class="candidate-section">
                  <header class="sector-header">
                    <span>{{ section.sectorLabel }}</span>
                    <span class="sector-meta">
                      <span v-if="section.sectorOwnerLabel">{{ section.sectorOwnerLabel }}</span>
                      <span>{{ section.jumpLabel }}</span>
                    </span>
                  </header>
                  <article v-for="station in section.stations" :key="station.key" class="station-card">
                    <header class="station-header">
                      <div>
                        <div class="station-title">{{ station.stationName }}</div>
                        <div class="station-code">{{ station.code }}</div>
                      </div>
                      <span v-if="station.distanceLabel" class="station-distance">{{ station.distanceLabel }}</span>
                    </header>
                    <div v-for="ware in station.wareOffers" :key="ware.wareId" class="ware-offers">
                      <h4>{{ ware.wareLabel }}</h4>
                      <div v-for="offer in ware.offers" :key="offer.tradeId" class="offer-row">
                        <span class="source-badge">{{ offer.sourceLabel }}</span>
                        <span>{{ t('npc_trade.amount') }}: {{ offer.amount }}</span>
                        <span>{{ t('npc_trade.price') }}: {{ offer.price }}</span>
                      </div>
                    </div>
                  </article>
                </section>
                <nav
                  v-if="faction.pageCount > 1"
                  class="pagination"
                  :aria-label="t('npc_trade.pagination.label')"
                >
                  <button
                    type="button"
                    :disabled="faction.page <= 1"
                    :aria-label="t('npc_trade.pagination.previous')"
                    :data-testid="`npc-trade-ineligible-page-prev-${faction.key}`"
                    @click="presenter.emits.setIneligibleFactionPage(faction.key, faction.page - 1)"
                  >‹</button>
                  <span>{{ t('npc_trade.pagination.status', { current: faction.page, total: faction.pageCount }) }}</span>
                  <button
                    type="button"
                    :disabled="faction.page >= faction.pageCount"
                    :aria-label="t('npc_trade.pagination.next')"
                    :data-testid="`npc-trade-ineligible-page-next-${faction.key}`"
                    @click="presenter.emits.setIneligibleFactionPage(faction.key, faction.page + 1)"
                  >›</button>
                </nav>
              </div>
            </details>
          </section>
        </div>
      </div>
    </section>

    <section class="panel-card col-span-12 lg:col-span-4" aria-labelledby="npc-trade-ships-title">
      <h2 id="npc-trade-ships-title" class="panel-header">{{ t('npc_trade.ships') }}</h2>
      <div class="panel-content">
        <div v-if="presenter.props.shipGroups.value.length === 0" class="empty-state">
          {{ t('npc_trade.no_ships') }}
        </div>
        <section v-for="group in presenter.props.shipGroups.value" :key="group.sectorMacro" class="ship-sector">
          <header class="sector-header">
            <span>{{ group.sectorLabel }}</span>
            <span v-if="group.bindingGroupNames.length" class="binding-groups">{{ group.bindingGroupNames.join(' · ') }}</span>
          </header>
          <div v-for="ship in group.ships" :key="ship.componentId" class="ship-row">
            <div class="ship-details">
              <div class="ship-name">{{ ship.shipName }} · {{ ship.shipType }} · {{ ship.size }}</div>
              <div v-if="ship.customName" class="ship-custom-name">{{ ship.customName }}</div>
              <div class="ship-meta">
                <span>{{ t('npc_trade.ship.capacity') }}: {{ ship.capacity }}</span>
                <span>{{ ship.relativeLabel }}</span>
              </div>
              <div v-if="ship.loadLimits.length" class="ship-load-limits">
                <span v-for="item in ship.loadLimits" :key="item.wareId">{{ item.wareLabel }}: {{ item.maxAmount }}</span>
              </div>
            </div>
            <span class="availability-badge" :class="ship.availability">{{ ship.availabilityLabel }}</span>
          </div>
        </section>
        <nav
          v-if="presenter.props.shipPageCount.value > 1"
          class="pagination"
          :aria-label="t('npc_trade.pagination.ship_label')"
        >
          <button
            type="button"
            :disabled="presenter.props.shipPage.value <= 1"
            :aria-label="t('npc_trade.pagination.previous')"
            data-testid="npc-trade-ship-page-prev"
            @click="presenter.emits.setShipPage(presenter.props.shipPage.value - 1)"
          >‹</button>
          <span>{{ t('npc_trade.pagination.status', { current: presenter.props.shipPage.value, total: presenter.props.shipPageCount.value }) }}</span>
          <button
            type="button"
            :disabled="presenter.props.shipPage.value >= presenter.props.shipPageCount.value"
            :aria-label="t('npc_trade.pagination.next')"
            data-testid="npc-trade-ship-page-next"
            @click="presenter.emits.setShipPage(presenter.props.shipPage.value + 1)"
          >›</button>
        </nav>
      </div>
    </section>
  </main>
</template>

<style scoped>
.npc-trade-grid { @apply grid grid-cols-12 gap-8 items-start px-4 pt-4; }
.panel-card { @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden; }
.panel-header { @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30; }
.panel-content { @apply p-4 flex flex-col gap-4; }
.field-group { @apply flex flex-col gap-1.5; }
.field-label { @apply text-xs font-medium text-slate-400; }
.field-control { @apply w-full rounded border border-slate-700 bg-slate-950/70 py-2 text-sm text-slate-200 outline-none focus:border-sky-500; }
.segmented-control { @apply grid grid-cols-2 rounded border border-slate-700 overflow-hidden; }
.segmented-control button { @apply px-3 py-2 text-sm text-slate-400 bg-slate-950/50 hover:text-slate-200; }
.segmented-control button.active { @apply bg-sky-500/20 text-sky-300; }
.ware-pills { @apply flex flex-col gap-2; }
.ware-pill { @apply flex flex-col gap-2 rounded border border-slate-700 bg-slate-800/40 p-2; }
.ware-pill-header { @apply flex items-start gap-2; }
.ware-pill-controls { @apply flex items-center justify-between gap-2; }
.ware-pill-name { @apply flex-1 min-w-0 whitespace-normal break-words text-sm text-slate-200; }
.qty-label { @apply ml-auto shrink-0; }
.jump-filter-row { @apply flex items-center justify-between gap-3; }
.remove-button { @apply h-7 w-7 shrink-0 rounded text-slate-500 hover:bg-red-500/10 hover:text-red-300; }
.sort-grid { @apply grid grid-cols-1 sm:grid-cols-2 gap-3; }
.empty-state { @apply rounded border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500; }
.candidate-list, .candidate-section { @apply flex flex-col gap-3; }
.sector-header { @apply flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-sky-300; }
.sector-meta { @apply flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-normal text-slate-400; }
.station-card { @apply rounded border border-slate-700/80 bg-slate-950/40 p-3; }
.station-header { @apply flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800; }
.station-title { @apply text-sm font-semibold text-slate-100; }
.station-code, .station-owner { @apply text-xs text-slate-500; }
.station-distance { @apply text-xs text-slate-400; }
.ware-offers { @apply mt-3 flex flex-col gap-2; }
.ware-offers h4 { @apply text-sm font-medium text-slate-200; }
.offer-row { @apply grid grid-cols-2 gap-2 rounded bg-slate-800/40 px-2 py-2 text-xs text-slate-400 sm:grid-cols-4; }
.source-badge { @apply text-sky-300; }
.ineligible-candidates { @apply mt-3 flex flex-col gap-3 border-t border-slate-700/60 pt-4; }
.ineligible-title { @apply text-sm font-semibold text-amber-300; }
.faction-group { @apply rounded border border-amber-800/50 bg-amber-950/10; }
.faction-summary { @apply flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-amber-200; }
.faction-sectors { @apply flex flex-col gap-4 border-t border-amber-800/30 p-3; }
.pagination { @apply flex items-center justify-center gap-3 text-xs text-slate-400; }
.pagination button { @apply h-8 min-w-8 rounded border border-slate-700 bg-slate-950/50 text-slate-300 hover:border-sky-500 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40; }
.ship-sector { @apply flex flex-col gap-2; }
.binding-groups { @apply text-xs font-normal text-slate-500; }
.ship-row { @apply flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/40 p-3; }
.ship-details { @apply min-w-0 flex flex-col gap-1; }
.ship-name { @apply text-sm text-slate-200; }
.ship-custom-name { @apply text-xs text-sky-300; }
.ship-meta, .ship-load-limits { @apply flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500; }
.availability-badge { @apply rounded-full px-2 py-1 text-xs; }
.availability-badge.immediatelyAvailable { @apply bg-emerald-500/15 text-emerald-300; }
.availability-badge.reclaimable { @apply bg-amber-500/15 text-amber-300; }
</style>
