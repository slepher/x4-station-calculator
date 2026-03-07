<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import ShipBuildSelectorView from '@/components/ship-build/ShipBuildSelectorView.vue'
import ShipBuildWorkspaceView from '@/components/ship-build/ShipBuildWorkspaceView.vue'

const { translateEquipmentType, translateEquipment } = useX4I18n()
const shipBuildStore = useShipBuildStore()
const { viewMode, selectedShipId } = storeToRefs(shipBuildStore)
const { setDisplayResolvers } = shipBuildStore
setDisplayResolvers({
  translateEquipment,
  translateEquipmentType
})
</script>

<template>
  <div
    class="ship-build-view flex flex-col gap-6"
    data-testid="ship-build-view"
    :data-view-mode="viewMode"
    :data-selected-ship-id="selectedShipId || ''"
  >
    <ShipBuildSelectorView v-if="viewMode === 'selector'" />
    <ShipBuildWorkspaceView v-else />
  </div>
</template>
