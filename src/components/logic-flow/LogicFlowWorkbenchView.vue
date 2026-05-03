<script setup lang="ts">
import LogicFlowCandidateZone from '@/components/logic-flow/LogicFlowCandidateZone.vue'
import BuildFlowZone from '@/components/logic-flow/BuildFlowZone.vue'
import LogicFlowPlanningZone from '@/components/logic-flow/LogicFlowPlanningZone.vue'
</script>

<template>
  <div class="flow-layout flex flex-col gap-6">
    <LogicFlowCandidateZone class="shrink-0" />
    <BuildFlowZone class="shrink-0 relative" />
    <LogicFlowPlanningZone class="flex-1" />
  </div>
</template>
