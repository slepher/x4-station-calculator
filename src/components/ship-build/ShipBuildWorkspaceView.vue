<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { FitMode } from '@/components/ship-build/fitTypes'
import type { ShipBlueprint } from '@/types/x4'
import ShipBuildPanelFit from '@/components/ship-build/ShipBuildPanelFit.vue'
import ShipBuildPanelEquipment from '@/components/ship-build/ShipBuildPanelEquipment.vue'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import ShipBuildPanelMaterials from '@/components/ship-build/ShipBuildPanelMaterials.vue'

const shipBuildStore = useShipBuildStore()
const { selectedShip, selectedShipId, blueprint } = storeToRefs(shipBuildStore)
const { buildPreviewBlueprint } = shipBuildStore

const showMaterial = ref(true)

const isPickerOpen = ref(false)
const pickerTarget = ref<{
  key: string
  count: number
  totalCount: number
  connectionKeys: string[]
  options: { id: string; name: string; mk: string | null; race: string | null; tags: string[] }[]
} | null>(null)
const highlightedEquipmentId = ref<string | null>(null)
const pickerMode = ref<FitMode>('connection')
const targetBlueprint = ref<ShipBlueprint | null>(null)

const currentSlotType = ref('')
const currentEquipmentId = ref<string | null>(null)
const currentIsShield = ref(false)

const handlePickerOpen = (slotType: string, equipmentId: string | null, isShield: boolean) => {
  isPickerOpen.value = true
  showMaterial.value = false
  currentSlotType.value = slotType
  currentEquipmentId.value = equipmentId
  currentIsShield.value = isShield
}

const handlePickerClose = () => {
  isPickerOpen.value = false
  showMaterial.value = true
  targetBlueprint.value = null
}

const handleHighlightedEquipmentIdChange = (id: string | null) => {
  highlightedEquipmentId.value = id
}

const handlePickerTargetChange = (target: typeof pickerTarget.value) => {
  pickerTarget.value = target
}

const handlePickerModeChange = (mode: FitMode) => {
  pickerMode.value = mode
}

watch(
  [isPickerOpen, highlightedEquipmentId, pickerTarget, blueprint, pickerMode],
  ([open, highlightedId, target, currentBlueprint, mode]) => {
    if (!open || !highlightedId || !target || !currentBlueprint) {
      targetBlueprint.value = null
      return
    }
    targetBlueprint.value = buildPreviewBlueprint({
      connectionKeys: target.connectionKeys,
      equipmentId: highlightedId,
      mode,
      targetCount: mode === 'group' ? target.totalCount : undefined
    })
  },
  { deep: true }
)

watch(selectedShipId, (next, prev) => {
  if (next === prev) return
  isPickerOpen.value = false
  showMaterial.value = true
  pickerTarget.value = null
  highlightedEquipmentId.value = null
  currentSlotType.value = ''
  currentEquipmentId.value = null
  currentIsShield.value = false
  pickerMode.value = 'connection'
  targetBlueprint.value = null
})
</script>

<template>
  <div v-if="selectedShip" class="grid grid-cols-12 gap-8 items-start" data-testid="ship-build-panels">
    <ShipBuildPanelFit
      :key="selectedShipId || 'no-ship'"
      :wide="!showMaterial"
      @picker-open="handlePickerOpen"
      @picker-close="handlePickerClose"
      @update:highlightedEquipmentId="handleHighlightedEquipmentIdChange"
      @update:pickerTarget="handlePickerTargetChange"
      @update:pickerMode="handlePickerModeChange"
    />

    <template v-if="isPickerOpen">
      <div class="col-span-4 flex flex-col gap-4">
        <ShipBuildPanelEquipment
          :is-picker-open="isPickerOpen"
          :picker-target="pickerTarget"
          :highlighted-equipment-id="highlightedEquipmentId"
          :selected-ship="selectedShip"
          :slot-type="currentSlotType"
          :current-equipment-id="currentEquipmentId"
          :is-shield="currentIsShield"
        />
        <ShipBuildPanelStats
          :ship-blueprint="blueprint"
          :target-blueprint="targetBlueprint"
        />
      </div>
    </template>
    <template v-else>
      <ShipBuildPanelStats
        :ship-blueprint="blueprint"
        :target-blueprint="targetBlueprint"
      />
      <ShipBuildPanelMaterials
        :ship-blueprint="blueprint"
      />
    </template>
  </div>
</template>
