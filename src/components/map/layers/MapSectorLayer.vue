<script setup lang="ts">
import type { SectorResourceEntry } from '@/components/map/types'
import type { MapSectorPolygonCluster } from '@/composables/useMapSvgSectors'

type SectorHoverPayload = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  owner: string
  sunlight: number
  resources: SectorResourceEntry[]
  hasKhaakHive: boolean
  khaakHiveSources: string[]
}

defineProps<{
  clusterPolygons: MapSectorPolygonCluster[]
  gameDataEnforceDlcActivation: boolean
  sectorLabelFontSize: number
  mapFontFamily: string
  sectorClipId: (clusterId: string, sectorId: string) => string
  hexPoints: (cx: number, cy: number, radius: number) => string
  shouldRenderResourceOverlay: (sectorId: string) => boolean
  buildPieSliceGeometries: (sectorId: string, cx: number, cy: number, radius: number) => Array<{ ware: string; color: string; path: string }>
  buildResourceGroupBadgeGeometries: (sectorId: string, cx: number, cy: number, radius: number) => Array<{ key: string; label: string; x: number; y: number; width: number; height: number }>
  sectorFillColor: (sectorId: string, defaultColor: string) => string
  sectorFillOpacity: (sectorId: string) => number
  sectorStrokeColor: (sectorId: string, defaultColor: string) => string
  sectorStrokeWidth: (sectorId: string, defaultValue: number) => number
  sectorStrokeOpacity: (sectorId: string, defaultValue: number) => number
  sectorFilter: (sectorId: string) => string | undefined
  sectorLabelWeight: (sectorId: string) => number
  sectorLabelFill: (sectorId: string) => string
}>()

const emit = defineEmits<{
  (e: 'sector-hover', event: MouseEvent, payload: SectorHoverPayload): void
  (e: 'sector-leave', sectorId: string): void
}>()
</script>

<template>
  <g class="clusters">
    <template v-for="cluster in clusterPolygons" :key="cluster.id">
      <g
        v-if="cluster.sectors.length === 1"
        class="sector-hover-target"
        :data-sector-hover-id="cluster.sectors[0]?.id || ''"
        :data-map-sector-id="cluster.sectors[0]?.id || ''"
        :data-cluster-id="cluster.id"
        @mouseenter="emit('sector-hover', $event, {
          sectorId: cluster.sectors[0]?.id || '',
          clusterId: cluster.sectors[0]?.clusterId || cluster.id,
          name: cluster.sectors[0]?.name || '',
          displayName: cluster.sectors[0]?.displayName || '',
          owner: cluster.sectors[0]?.owner || 'ownerless',
          sunlight: cluster.sectors[0]?.sunlight || 0,
          resources: cluster.sectors[0]?.resources || [],
          hasKhaakHive: cluster.sectors[0]?.hasKhaakHive || false,
          khaakHiveSources: cluster.sectors[0]?.khaakHiveSources || []
        })"
        @mouseleave="emit('sector-leave', cluster.sectors[0]?.id || '')"
      >
        <g
          v-if="cluster.sectors[0] && shouldRenderResourceOverlay(cluster.sectors[0].id)"
          :clip-path="`url(#${sectorClipId(cluster.id, cluster.sectors[0].id)})`"
        >
          <path
            v-for="slice in buildPieSliceGeometries(cluster.sectors[0].id, cluster.sectors[0].sx, cluster.sectors[0].sy, cluster.sectors[0].radius)"
            :key="`${cluster.sectors[0]?.id}-${slice.ware}`"
            data-testid="resource-pie-slice"
            :d="slice.path"
            :fill="slice.color"
            fill-opacity="0.95"
          />
        </g>
        <polygon
          :points="hexPoints(cluster.sectors[0]?.sx || cluster.cx, cluster.sectors[0]?.sy || cluster.cy, cluster.sectors[0]?.radius || cluster.singleRadius || 0)"
          :fill="sectorFillColor(cluster.sectors[0]?.id || '', cluster.sectors[0]?.color || cluster.color)"
          :fill-opacity="sectorFillOpacity(cluster.sectors[0]?.id || '')"
          :stroke="sectorStrokeColor(cluster.sectors[0]?.id || '', cluster.sectors[0]?.color || cluster.color)"
          :stroke-width="sectorStrokeWidth(cluster.sectors[0]?.id || '', 2.8)"
          :stroke-opacity="sectorStrokeOpacity(cluster.sectors[0]?.id || '', 0.95)"
          :filter="sectorFilter(cluster.sectors[0]?.id || '')"
          class="sector-polygon"
          :data-sector-id="cluster.sectors[0]?.id || ''"
          :data-cluster-id="cluster.id"
          :stroke-dasharray="!gameDataEnforceDlcActivation && cluster.isDlcActive === false ? '6,4' : undefined"
        />
        <text
          :x="(cluster.sectors[0]?.sx || cluster.cx).toFixed(1)"
          :y="(cluster.singleLabelY || cluster.sectors[0]?.labelY || 0).toFixed(1)"
          text-anchor="middle"
          dominant-baseline="text-before-edge"
          alignment-baseline="text-before-edge"
          :font-size="(cluster.singleLabelFontSize || sectorLabelFontSize).toFixed(1)"
          :font-family="mapFontFamily"
          :font-weight="sectorLabelWeight(cluster.sectors[0]?.id || '')"
          :fill="sectorLabelFill(cluster.sectors[0]?.id || '')"
          :data-cluster-id="cluster.id"
        >
          {{ cluster.singleLabel }}
        </text>
        <g
          v-for="badge in buildResourceGroupBadgeGeometries(cluster.sectors[0]?.id || '', cluster.sectors[0]?.sx || cluster.cx, cluster.sectors[0]?.sy || cluster.cy, cluster.sectors[0]?.radius || cluster.singleRadius || 0)"
          :key="badge.key"
          data-testid="resource-group-badge"
        >
          <rect
            :x="badge.x.toFixed(1)"
            :y="badge.y.toFixed(1)"
            :width="badge.width.toFixed(1)"
            :height="badge.height.toFixed(1)"
            rx="4"
            ry="4"
            fill="rgba(5, 5, 5, 0.78)"
            stroke="rgba(251, 191, 36, 0.38)"
          />
          <text
            :x="(badge.x + badge.width / 2).toFixed(1)"
            :y="(badge.y + badge.height / 2).toFixed(1)"
            :data-testid="`resource-group-badge-${cluster.sectors[0]?.id || ''}-${badge.label}`"
            text-anchor="middle"
            dominant-baseline="middle"
            alignment-baseline="middle"
            :font-size="Math.max(8, (badge.height * 0.7)).toFixed(1)"
            :font-family="mapFontFamily"
            font-weight="700"
            fill="#fef3c7"
          >
            {{ badge.label }}
          </text>
        </g>
      </g>
      <template v-else>
        <polygon
          :points="hexPoints(cluster.cx, cluster.cy, cluster.clusterRadius)"
          fill="none"
          :stroke="cluster.color"
          stroke-width="2.8"
          stroke-opacity="0.95"
          class="cluster-polygon"
          :data-cluster-id="cluster.id"
          :stroke-dasharray="!gameDataEnforceDlcActivation && cluster.isDlcActive === false ? '6,4' : undefined"
        />
        <template v-for="sector in cluster.sectors" :key="sector.id">
          <g
            class="sector-hover-target"
            :data-sector-hover-id="sector.id"
            :data-map-sector-id="sector.id"
            :data-cluster-id="cluster.id"
            @mouseenter="emit('sector-hover', $event, {
              sectorId: sector.id,
              clusterId: sector.clusterId,
              name: sector.name,
              displayName: sector.displayName,
              owner: sector.owner,
              sunlight: sector.sunlight,
              resources: sector.resources,
              hasKhaakHive: sector.hasKhaakHive,
              khaakHiveSources: sector.khaakHiveSources
            })"
            @mouseleave="emit('sector-leave', sector.id)"
          >
            <g
              v-if="shouldRenderResourceOverlay(sector.id)"
              :clip-path="`url(#${sectorClipId(cluster.id, sector.id)})`"
            >
              <path
                v-for="slice in buildPieSliceGeometries(sector.id, sector.sx, sector.sy, sector.radius)"
                :key="`${sector.id}-${slice.ware}`"
                data-testid="resource-pie-slice"
                :d="slice.path"
                :fill="slice.color"
                fill-opacity="0.95"
              />
            </g>
            <polygon
              :points="hexPoints(sector.sx, sector.sy, sector.radius)"
              :fill="sectorFillColor(sector.id, sector.color)"
              :fill-opacity="sectorFillOpacity(sector.id)"
              :stroke="sectorStrokeColor(sector.id, sector.color)"
              :stroke-width="sectorStrokeWidth(sector.id, 2.2)"
              :stroke-opacity="sectorStrokeOpacity(sector.id, 0.9)"
              :filter="sectorFilter(sector.id)"
              class="sector-polygon"
              :data-sector-id="sector.id"
              :data-cluster-id="cluster.id"
              :stroke-dasharray="!gameDataEnforceDlcActivation && cluster.isDlcActive === false ? '6,4' : undefined"
              :stroke-dashoffset="!gameDataEnforceDlcActivation && cluster.isDlcActive === false ? ((sector.sx + sector.sy) % 10).toFixed(1) : undefined"
            />
            <text
              :x="sector.sx.toFixed(1)"
              :y="sector.labelY.toFixed(1)"
              text-anchor="middle"
              dominant-baseline="text-before-edge"
              alignment-baseline="text-before-edge"
              :font-size="sector.labelFontSize.toFixed(1)"
              :font-family="mapFontFamily"
              :font-weight="sectorLabelWeight(sector.id)"
              :fill="sectorLabelFill(sector.id)"
              :data-sector-id="sector.id"
              :data-cluster-id="cluster.id"
            >
              {{ sector.label }}
            </text>
            <g
              v-for="badge in buildResourceGroupBadgeGeometries(sector.id, sector.sx, sector.sy, sector.radius)"
              :key="badge.key"
              data-testid="resource-group-badge"
            >
              <rect
                :x="badge.x.toFixed(1)"
                :y="badge.y.toFixed(1)"
                :width="badge.width.toFixed(1)"
                :height="badge.height.toFixed(1)"
                rx="4"
                ry="4"
                fill="rgba(5, 5, 5, 0.78)"
                stroke="rgba(251, 191, 36, 0.38)"
              />
              <text
                :x="(badge.x + badge.width / 2).toFixed(1)"
                :y="(badge.y + badge.height / 2).toFixed(1)"
                :data-testid="`resource-group-badge-${sector.id}-${badge.label}`"
                text-anchor="middle"
                dominant-baseline="middle"
                alignment-baseline="middle"
                :font-size="Math.max(8, (badge.height * 0.7)).toFixed(1)"
                :font-family="mapFontFamily"
                font-weight="700"
                fill="#fef3c7"
              >
                {{ badge.label }}
              </text>
            </g>
          </g>
        </template>
      </template>
    </template>
  </g>
</template>

<style scoped>
.sector-hover-target {
  pointer-events: auto;
}
</style>
