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
const { buildPreviewBlueprint, applyConnectionAssignment } = shipBuildStore

const isPickerOpen = ref(false)
const pickerTarget = ref<{
  key: string
  size: string
  tags: string[]
  count: number
  totalCount: number
  connectionKeys: string[]
} | null>(null)
const highlightedEquipmentId = ref<string | null>(null)
const pickerMode = ref<FitMode>('connection')
const targetBlueprint = ref<ShipBlueprint | null>(null)

const currentSlotType = ref('')
const currentEquipmentId = ref<string | null>(null)
const currentIsShield = ref(false)

const handlePickerOpen = (slotType: string, equipmentId: string | null, isShield: boolean) => {
  isPickerOpen.value = true
  currentSlotType.value = slotType
  currentEquipmentId.value = equipmentId
  currentIsShield.value = isShield
}

const handlePickerClose = () => {
  isPickerOpen.value = false
  targetBlueprint.value = null
}

const handlePickerCancel = () => {
  handlePickerClose()
}

const handlePickerConfirm = () => {
  if (!pickerTarget.value) return
  const equipmentId = highlightedEquipmentId.value ?? null
  pickerTarget.value.connectionKeys.forEach((connectionKey) => {
    applyConnectionAssignment({ connectionKey, equipmentId })
  })
  handlePickerClose()
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

const currentShipId = () => {
  const blueprintShipId = blueprint.value?.shipId
  if (blueprintShipId) return blueprintShipId
  return selectedShipId.value
}

watch(currentShipId, (next, prev) => {
  if (next === prev) return
  isPickerOpen.value = false
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
      :key="currentShipId() || 'no-ship'"
      :wide="false"
      :external-highlighted-equipment-id="highlightedEquipmentId"
      :picker-open-external="isPickerOpen"
      @picker-open="handlePickerOpen"
      @picker-close="handlePickerClose"
      @update:highlightedEquipmentId="handleHighlightedEquipmentIdChange"
      @update:pickerTarget="handlePickerTargetChange"
      @update:pickerMode="handlePickerModeChange"
    />

    <template v-if="isPickerOpen">
      <div class="col-span-12 lg:col-span-4">
        <ShipBuildPanelEquipment
          panel-mode="picker"
          :is-picker-open="isPickerOpen"
          :picker-target="pickerTarget"
          :highlighted-equipment-id="highlightedEquipmentId"
          :selected-ship="selectedShip"
          :slot-type="currentSlotType"
          :current-equipment-id="currentEquipmentId"
          :is-shield="currentIsShield"
          @update:highlightedEquipmentId="handleHighlightedEquipmentIdChange"
          @cancel="handlePickerCancel"
          @confirm="handlePickerConfirm"
        />
      </div>
      <div class="col-span-12 lg:col-span-4 flex flex-col gap-4">
        <ShipBuildPanelEquipment
          panel-mode="equipment"
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
