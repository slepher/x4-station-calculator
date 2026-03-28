<script setup lang="ts">
defineProps<{
  title: string
  ownerName: string
  sunlightPercent: number
  resources: Array<{
    wareId: string
    label: string
    respawnLabel: string
    color: string
  }>
  sunlightLabel: string
  sunlightSuffix: string
}>()
</script>

<template>
  <section class="sector-tooltip-card">
    <header class="sector-tooltip-header">
      <h3 class="sector-tooltip-title">{{ title }}</h3>
      <p class="sector-tooltip-owner">{{ ownerName }}</p>
    </header>

    <div class="sector-tooltip-grid">
      <span class="resource-name">{{ sunlightLabel }}</span>
      <span class="resource-value">{{ sunlightPercent }}{{ sunlightSuffix }}</span>
      <span class="resource-color sunlight-swatch"></span>

      <template v-for="resource in resources" :key="resource.wareId">
        <span class="resource-name">{{ resource.label }}</span>
        <span class="resource-value">{{ resource.respawnLabel }}</span>
        <span class="resource-color" :style="{ backgroundColor: resource.color }"></span>
      </template>
    </div>
  </section>
</template>

<style scoped>
.sector-tooltip-card {
  min-width: 220px;
  max-width: 280px;
  user-select: none;
  border-radius: 16px;
  border: 1px solid rgba(252, 211, 77, 0.28);
  background:
    linear-gradient(180deg, rgba(30, 24, 16, 0.96), rgba(10, 10, 10, 0.96));
  box-shadow:
    0 18px 50px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  padding: 16px 18px;
  color: #fff7ed;
}

.sector-tooltip-header {
  margin-bottom: 14px;
  text-align: center;
}

.sector-tooltip-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 500;
  color: #fffbeb;
}

.sector-tooltip-owner {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.2;
  color: rgba(255, 251, 235, 0.82);
}

.sector-tooltip-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px 14px;
  align-items: center;
}

.resource-name {
  font-size: 13px;
  line-height: 1.2;
  color: rgba(255, 247, 237, 0.9);
}

.resource-value {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 600;
  text-align: right;
  color: rgba(255, 247, 237, 0.82);
}

.resource-color {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 0 0 1px rgba(255, 255, 255, 0.06);
}

.sunlight-swatch {
  background: #facc15;
}
</style>
