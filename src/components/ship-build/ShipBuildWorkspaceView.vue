<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShipBuildWorkspacePresenter } from './presenters/useShipBuildWorkspacePresenter'
import type { ShipBuildSide } from '@/store/useShipBuildStore'
import ShipBuildPanelFit from './ShipBuildPanelFit.vue'
import ShipBuildPanelEquipment from './ShipBuildPanelEquipment.vue'
import ShipBuildPanelStats from './ShipBuildPanelStats.vue'
import ShipBuildPanelMaterials from './ShipBuildPanelMaterials.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
const { t } = useI18n()
const { columns, compare, selectedShip, pickerSide, pickerTarget, pickerMode, pickerShip,
  highlightedEquipmentId, currentSlotType, currentEquipmentId, currentIsShield,
  blueprintA, blueprintB, editingBlueprint, preview, locked, deletion, error, confirmDelete, cancelDelete, openComparison, openPicker, closePicker, confirmPicker, exit } = useShipBuildWorkspacePresenter()
</script>

<template>
  <ConfirmDialog v-if="deletion" :title="t('shipBuild.action_delete')" :message="t('shipBuild.confirm_delete_blueprint')"
    :name="deletion.name" :confirm-label="t('shipBuild.action_delete')" :error="error" @close="cancelDelete" @confirm="confirmDelete" />
  <div v-if="selectedShip" class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" data-testid="ship-build-panels">
    <div v-for="column in columns" :key="column" class="min-w-0" :data-column="column">
      <ShipBuildPanelFit v-if="column === 'A' || column === 'B'" :side="column as ShipBuildSide"
        :external-highlighted-equipment-id="pickerSide === column ? highlightedEquipmentId : null"
        :picker-open-external="pickerSide === column"
        @picker-open="(slot, id, shield) => openPicker(column as ShipBuildSide, slot, id, shield)"
        @picker-close="closePicker"
        @update:highlighted-equipment-id="highlightedEquipmentId = $event"
        @update:picker-target="pickerTarget = $event"
        @update:picker-mode="pickerMode = $event" />
      <template v-else-if="column === 'stats'">
        <div v-if="compare && pickerSide === null" class="comparison-stats" data-testid="ship-compare-stats">
          <ShipBuildPanelStats :ship-blueprint="blueprintA" :target-blueprint="blueprintB" comparison>
            <template #actions>
              <div class="compare-actions">
              <button class="compare-toggle" :title="t('shipCompare.exit_hint')" :disabled="locked" data-testid="ship-compare-exit" @click="exit('A')">{{ t('shipCompare.exit') }}</button>
              <button class="compare-secondary" :title="t('shipCompare.keep_b_hint')" :disabled="locked" data-testid="ship-compare-keep-b" @click="exit('B')">{{ t('shipCompare.keep_b') }}</button>
              </div>
            </template>
          </ShipBuildPanelStats>
        </div>
        <template v-else>
          <ShipBuildPanelEquipment v-if="pickerSide !== null" panel-mode="equipment" :is-picker-open="true"
            :picker-target="pickerTarget" :highlighted-equipment-id="highlightedEquipmentId" :selected-ship="pickerShip"
            :slot-type="currentSlotType" :current-equipment-id="currentEquipmentId" :is-shield="currentIsShield" />
          <ShipBuildPanelStats :ship-blueprint="editingBlueprint" :target-blueprint="preview">
            <template v-if="pickerSide === null" #actions>
              <button class="compare-toggle" :disabled="locked" data-testid="ship-compare-open" @click="openComparison">{{ t('shipCompare.open') }}</button>
            </template>
          </ShipBuildPanelStats>
        </template>
      </template>
      <template v-else-if="column === 'picker'">
        <ShipBuildPanelEquipment panel-mode="picker" :is-picker-open="true"
          :picker-target="pickerTarget" :highlighted-equipment-id="highlightedEquipmentId" :selected-ship="pickerShip"
          :slot-type="currentSlotType" :current-equipment-id="currentEquipmentId" :is-shield="currentIsShield"
          @update:highlighted-equipment-id="highlightedEquipmentId = $event" @cancel="closePicker" @confirm="confirmPicker" />
      </template>
      <ShipBuildPanelMaterials v-else-if="column === 'materials'" :ship-blueprint="blueprintA" />
    </div>
  </div>
</template>

<style scoped>
.compare-actions {
  display: contents;
}
.compare-actions > button {
  @apply w-20 min-w-0 px-1 whitespace-nowrap;
}
.comparison-stats :deep(.metrics-panel-header) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem 5rem minmax(0, 1fr);
  column-gap: 1rem;
}
.comparison-stats :deep(.metrics-panel-header > :last-child) {
  justify-self: end;
}
.compare-toggle {
  @apply shrink-0 rounded-md border border-emerald-400/70 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40;
}
.compare-secondary {
  @apply shrink-0 rounded-md border border-slate-600 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-40;
}
</style>
