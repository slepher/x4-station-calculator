<script setup lang="ts">
import type { ShipBlueprint } from '@/types/x4'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import { useShipBuildStatsPresenter } from './presenters/useShipBuildStatsPresenter'
const props = defineProps<{ shipBlueprint: ShipBlueprint | null; targetBlueprint?: ShipBlueprint | null; comparison?: boolean }>()
const { t, panelCurrentValues, panelTargetValues, panelSchema, panelViewTab, getWeaponStatsByUseEquipmentStats, getTurretStatsByUseEquipmentStats, getShieldStatsByUseEquipmentStats, getEngineStatsByUseEquipmentStats, getThrusterStatsByUseEquipmentStats, buildDetailStatsByUseEquipmentStats, currentDetailedShipStats, targetDetailedShipStats, getDefaultMax } = useShipBuildStatsPresenter(props)
defineExpose({ t, panelCurrentValues, panelTargetValues, panelSchema, panelViewTab, getWeaponStatsByUseEquipmentStats, getTurretStatsByUseEquipmentStats, getShieldStatsByUseEquipmentStats, getEngineStatsByUseEquipmentStats, getThrusterStatsByUseEquipmentStats, buildDetailStatsByUseEquipmentStats, currentDetailedShipStats, targetDetailedShipStats, getDefaultMax })
</script>

<template>
  <div class="col-span-12 lg:col-span-4" data-testid="ship-build-panel-stats">
    <MetricsPanel
      panel-id="ship-build-stats-panel"
      :title="t('ship_build.panel_stats')"
      header-height="48px"
      :obj-current="panelCurrentValues"
      :obj-target="panelTargetValues"
      :schema="panelSchema"
      order="row"
      :view-tab="panelViewTab"
      :rounded-keys="[]"
    >
      <template #header-actions><slot name="actions" /></template>
    </MetricsPanel>
  </div>
</template>

<style scoped>
</style>
