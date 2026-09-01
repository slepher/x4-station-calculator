<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useNpcTradePresenter } from '@/components/empire/presenters/useNpcTradePresenter'
import X4NumberInput from '@/components/common/X4NumberInput.vue'

const { t } = useI18n()
const presenter = useNpcTradePresenter()
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
          <select
            class="field-control"
            :value="presenter.props.selectedPlayerStationGroupId.value === null ? '' : presenter.props.selectedPlayerStationGroupId.value"
            data-testid="npc-trade-player-station-group"
            @change="presenter.emits.selectPlayerStationGroup(($event.target as HTMLSelectElement).value === '' ? null : ($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ t('npc_trade.select_station_group') }}</option>
            <option v-for="group in presenter.props.stationGroups.value" :key="group.id" :value="group.id">
              {{ group.label }}
            </option>
          </select>
        </label>

        <label class="field-group">
          <span class="field-label">{{ t('npc_trade.player_station') }}</span>
          <select
            class="field-control"
            :disabled="presenter.props.selectedPlayerStationGroupId.value === null"
            :value="presenter.props.selectedPlayerStationId.value === null ? '' : presenter.props.selectedPlayerStationId.value"
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
          </select>
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

        <div class="field-group ware-search">
          <label class="field-label" for="npc-trade-ware-search">{{ t('npc_trade.ware_search') }}</label>
          <input
            id="npc-trade-ware-search"
            class="field-control"
            type="search"
            :value="presenter.props.searchQuery.value"
            :placeholder="t('npc_trade.ware_search_placeholder')"
            data-testid="npc-trade-ware-search"
            @input="presenter.emits.setSearchQuery(($event.target as HTMLInputElement).value)"
          >
          <div v-if="presenter.props.searchGroups.value.length" class="search-results custom-scrollbar">
            <div v-for="group in presenter.props.searchGroups.value" :key="group.id">
              <div class="search-group-label">{{ group.label }}</div>
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                class="search-result"
                :data-testid="`npc-trade-ware-result-${item.id}`"
                @click="presenter.emits.addWare(item.id)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="ware-pills" aria-live="polite">
          <div
            v-for="target in presenter.props.wareTargets.value"
            :key="target.wareId"
            class="ware-pill"
          >
            <span class="ware-pill-name">{{ target.label }}</span>
            <label class="qty-label">
              <span>{{ t('npc_trade.target_qty') }}</span>
              <X4NumberInput
                :model-value="target.targetQty === null ? 0 : target.targetQty"
                :min="0"
                width-class="w-20"
                :data-testid="`npc-trade-target-${target.wareId}`"
                @update:model-value="(value: number) => presenter.emits.updateTargetQty(target.wareId, value === 0 ? null : value)"
              />
            </label>
            <button
              type="button"
              class="remove-button"
              :aria-label="t('npc_trade.remove_ware', { ware: target.label })"
              :data-testid="`npc-trade-remove-${target.wareId}`"
              @click="presenter.emits.removeWare(target.wareId)"
            >×</button>
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
            <select
              class="field-control"
              :value="presenter.props.rankMode.value"
              data-testid="npc-trade-rank-mode"
              @change="presenter.emits.setRankMode(($event.target as HTMLSelectElement).value as 'primary' | 'composite')"
            >
              <option value="primary">{{ t('npc_trade.rank_mode.primary') }}</option>
              <option value="composite" :disabled="!presenter.props.canUseComposite.value">{{ t('npc_trade.rank_mode.composite') }}</option>
            </select>
          </label>
          <label class="field-group">
            <span class="field-label">{{ t('npc_trade.sort.label') }}</span>
            <select
              class="field-control"
              :value="presenter.props.sortMetric.value"
              data-testid="npc-trade-sort-metric"
              @change="presenter.emits.setSortMetric(($event.target as HTMLSelectElement).value as 'quantity' | 'price' | 'fillablePrice' | 'targetTotal')"
            >
              <option value="quantity">{{ t('npc_trade.sort.quantity') }}</option>
              <option value="price">{{ t('npc_trade.sort.price') }}</option>
              <option value="fillablePrice" :disabled="!presenter.props.canUseTargetMetric.value">{{ t('npc_trade.sort.fillable_price') }}</option>
              <option value="targetTotal" :disabled="!presenter.props.canUseTargetMetric.value">{{ presenter.props.direction.value === 'sell' ? t('npc_trade.sort.total_revenue') : t('npc_trade.sort.total_cost') }}</option>
            </select>
          </label>
          <label class="field-group">
            <span class="field-label">{{ t('npc_trade.primary_ware') }}</span>
            <select
              class="field-control"
              :value="presenter.props.primaryWareId.value === null ? '' : presenter.props.primaryWareId.value"
              data-testid="npc-trade-primary-ware"
              @change="presenter.emits.setPrimaryWare(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="target in presenter.props.wareTargets.value" :key="target.wareId" :value="target.wareId">
                {{ target.label }}
              </option>
            </select>
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              :checked="presenter.props.groupBySector.value"
              data-testid="npc-trade-group-sector"
              @change="presenter.emits.setGroupBySector(($event.target as HTMLInputElement).checked)"
            >
            <span>{{ t('npc_trade.group_by_sector') }}</span>
          </label>
        </div>

        <div v-if="presenter.props.pageState.value !== 'results'" class="empty-state" :data-testid="`npc-trade-state-${presenter.props.pageState.value}`">
          {{ presenter.props.pageStateLabel.value }}
        </div>
        <div v-else class="candidate-list" data-testid="npc-trade-results">
          <section v-for="section in presenter.props.candidateSections.value" :key="section.key" class="candidate-section">
            <h3 v-if="section.sectorLabel" class="sector-header">{{ section.sectorLabel }}</h3>
            <article v-for="station in section.stations" :key="station.key" class="station-card">
              <header class="station-header">
                <div>
                  <div class="station-title">{{ station.stationName }}</div>
                  <div class="station-code">{{ station.code }}</div>
                </div>
                <div class="station-identity">
                  <span>{{ station.sectorLabel }}</span>
                  <span>{{ station.factionLabel }}</span>
                  <span>{{ station.relativeLabel }}</span>
                </div>
              </header>
              <div v-for="ware in station.wareOffers" :key="ware.wareId" class="ware-offers">
                <h4>{{ ware.wareLabel }}</h4>
                <div v-for="offer in ware.offers" :key="offer.tradeId" class="offer-row">
                  <span class="source-badge">{{ offer.sourceLabel }}</span>
                  <span>{{ t('npc_trade.amount') }}: {{ offer.amount }}</span>
                  <span v-if="offer.desired !== undefined">{{ t('npc_trade.desired') }}: {{ offer.desired }}</span>
                  <span>{{ t('npc_trade.price') }}: {{ offer.price }}</span>
                </div>
              </div>
            </article>
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
.field-control { @apply w-full rounded border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500; }
.segmented-control { @apply grid grid-cols-2 rounded border border-slate-700 overflow-hidden; }
.segmented-control button { @apply px-3 py-2 text-sm text-slate-400 bg-slate-950/50 hover:text-slate-200; }
.segmented-control button.active { @apply bg-sky-500/20 text-sky-300; }
.ware-search { @apply relative; }
.search-results { @apply max-h-64 overflow-y-auto rounded border border-slate-700 bg-slate-950; }
.search-group-label { @apply sticky top-0 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-900; }
.search-result { @apply block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-sky-500/10 hover:text-sky-300; }
.ware-pills { @apply flex flex-col gap-2; }
.ware-pill { @apply flex items-center gap-2 rounded border border-slate-700 bg-slate-800/40 p-2; }
.ware-pill-name { @apply flex-1 min-w-0 text-sm text-slate-200 truncate; }
.qty-label { @apply flex items-center gap-1 text-xs text-slate-500; }
.jump-filter-row { @apply flex items-center justify-between gap-3; }
.remove-button { @apply h-7 w-7 rounded text-slate-500 hover:bg-red-500/10 hover:text-red-300; }
.sort-grid { @apply grid grid-cols-1 sm:grid-cols-2 gap-3; }
.checkbox-row { @apply flex items-center gap-2 text-sm text-slate-300 self-end pb-2; }
.empty-state { @apply rounded border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500; }
.candidate-list, .candidate-section { @apply flex flex-col gap-3; }
.sector-header { @apply flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-sky-300; }
.station-card { @apply rounded border border-slate-700/80 bg-slate-950/40 p-3; }
.station-header { @apply flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800; }
.station-title { @apply text-sm font-semibold text-slate-100; }
.station-code { @apply text-xs text-slate-500; }
.station-identity { @apply flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs text-slate-400; }
.ware-offers { @apply mt-3 flex flex-col gap-2; }
.ware-offers h4 { @apply text-sm font-medium text-slate-200; }
.offer-row { @apply grid grid-cols-2 gap-2 rounded bg-slate-800/40 px-2 py-2 text-xs text-slate-400 sm:grid-cols-4; }
.source-badge { @apply text-sky-300; }
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
