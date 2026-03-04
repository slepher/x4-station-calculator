<script setup lang="ts">
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import { metricPanelCases } from '@/components/test/fixtures/metricPanelCases'
</script>

<template>
  <div class="metric-panel-playground min-h-screen bg-slate-950 p-8" data-testid="metric-panel-playground">
    <div class="mx-auto max-w-7xl space-y-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-slate-100">Metric Panel Playground</h1>
        <p class="text-sm text-slate-400">
          用固定 fixture 快速覆盖 `MetricsPanel` 的顺序、过滤与空值边界。
        </p>
      </header>

      <section class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <article
          v-for="testCase in metricPanelCases"
          :key="testCase.id"
          class="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3"
          :data-testid="`metric-panel-case-${testCase.id}`"
        >
          <div class="space-y-1">
            <h2 class="text-base font-semibold text-slate-100">{{ testCase.title }}</h2>
            <p class="text-xs text-slate-400">{{ testCase.description }}</p>
            <ul class="text-xs text-emerald-300/90 list-disc list-inside">
              <li v-for="item in testCase.expected" :key="item">{{ item }}</li>
            </ul>
          </div>

          <MetricsPanel
            :panel-id="testCase.id"
            :title="testCase.title"
            :obj-current="testCase.objCurrent"
            :obj-target="testCase.objTarget"
            :schema="testCase.schema"
            :order="testCase.order"
            :view-tab="testCase.viewTab"
            :rounded-keys="['speed', 'travelSpeed', 'boostSpeed']"
          />
        </article>
      </section>
    </div>
  </div>
</template>
