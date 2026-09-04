import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const readRepoFile = (relativePath: string) => {
  const url = new URL(`../../../${relativePath}`, import.meta.url)
  return readFileSync(fileURLToPath(url), 'utf8')
}

describe('map SVG layer order', () => {
  it('renders region fills below sector borders and map structures', () => {
    const canvas = readRepoFile('src/components/map/MapSvgCanvas.vue')
    const sectorFillIndex = canvas.indexOf('<MapSectorFillLayer')
    const groupColorIndex = canvas.indexOf('<MapSectorGroupColorLayer')
    const sectorIndex = canvas.indexOf('<MapSectorLayer')
    const baseLinkIndex = canvas.indexOf('render-mode="base"')
    const routeIndex = canvas.indexOf('<MapHubLinkRouteLayer')
    const iconLinkIndex = canvas.indexOf('render-mode="icons"')
    const overlayIndex = canvas.indexOf('<MapOverlayLayer')

    expect(sectorFillIndex).toBeGreaterThan(-1)
    expect(groupColorIndex).toBeGreaterThan(-1)
    expect(groupColorIndex).toBeGreaterThan(sectorFillIndex)
    expect(sectorIndex).toBeGreaterThan(groupColorIndex)
    expect(routeIndex).toBeGreaterThan(sectorIndex)
    expect(baseLinkIndex).toBeGreaterThan(sectorIndex)
    expect(routeIndex).toBeGreaterThan(baseLinkIndex)
    expect(iconLinkIndex).toBeGreaterThan(routeIndex)
    expect(overlayIndex).toBeGreaterThan(iconLinkIndex)
  })

  it('splits sector fill from sector border so borders stay above fills', () => {
    const fillLayer = readRepoFile('src/components/map/layers/MapSectorFillLayer.vue')
    const sectorLayer = readRepoFile('src/components/map/layers/MapSectorLayer.vue')
    const fillIndex = fillLayer.indexOf('class="sector-polygon-fill"')
    const strokeIndex = sectorLayer.indexOf('class="sector-polygon"')

    expect(fillIndex).toBeGreaterThan(-1)
    expect(strokeIndex).toBeGreaterThan(-1)
    expect(fillLayer).toContain('stroke="none"')
    expect(sectorLayer).toContain('fill="none"')
  })

  it('only suppresses faction fill for grouped sectors while sector group coloring is visible', () => {
    const canvas = readRepoFile('src/components/map/MapSvgCanvas.vue')

    expect(canvas).toContain('if (props.showSectorGroupColors && sectorGroupColorMapComputed.value[sectorId]) return 0')
  })
})
