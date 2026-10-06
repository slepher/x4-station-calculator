import { describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compareDirectories, compareJson } from '../../../scripts/processor/compare'
import { processResources, type ResourceContext } from '../../../scripts/processor/resources-ts'
describe('resources full Python cold baseline parity', () => {
  for (const [version, folder] of [['8.0', '8.0-Diplomacy'], ['9.0', '9.0-Empire']]) {
    const expected = `/tmp/x4-migrate/python/${version}/resources/cold`
    it.skipIf(!existsSync(join(expected, 'map_resources.json')))(`${version}: native calculation matches every field, float and tile exactly`, () => {
      const output = mkdtempSync(join(tmpdir(), `resources-${version}-`))
      try {
        cpSync(`/tmp/x4-migrate/python/${version}/map/data`, output, { recursive: true })
        const raw = resolve('x4raw_assets', folder!), maps = join(output, 'maps.json'), original = readFileSync(maps)
        const context: ResourceContext = { config: { version }, rawPath: raw, outputRoot: output, paths: { 'maps-json': maps, 'regions-json': join(output, 'regions.json'), 'resource-output-dir': output, 'regionyields-xml': join(raw, 'libraries/regionyields/final.xml'), 'mapdefaults-xml': join(raw, 'libraries/mapdefaults/final.xml') }, blocksCache: join(output, 'cache/resourcearea_blocks.json') }
        expect(processResources(context).status).toBe('success')
        expect(compareDirectories(expected, output).slice(0, 20)).toEqual([])
        expect(readFileSync(maps)).toEqual(original)
        if (version === '8.0') {
          const cache = readFileSync(context.blocksCache)
          expect(processResources(context).output_files).not.toContain(context.blocksCache)
          expect(compareDirectories(expected, output).slice(0, 20)).toEqual([])
          expect(readFileSync(context.blocksCache)).toEqual(cache)
        }
      } finally { rmSync(output, { recursive: true, force: true }) }
    }, 120000)
  }
})

describe('resources Python incremental matrix', () => {
  it.skipIf(!existsSync('/tmp/x4-migrate/python/9.0/resources/single/map_resources.json'))('9.0 single: target matches Python and every other sector is retained', () => {
    const output = mkdtempSync(join(tmpdir(), 'resources-9-single-'))
    try {
      const cold = '/tmp/x4-migrate/python/9.0/resources/cold', expected = '/tmp/x4-migrate/python/9.0/resources/single', sid = 'cluster_01_sector001_macro'
      cpSync(cold, output, { recursive: true })
      const raw = resolve('x4raw_assets/9.0-Empire'), maps = join(output, 'maps.json'), bytes = readFileSync(maps)
      processResources({ config: { version: '9.0' }, rawPath: raw, outputRoot: output, paths: { 'maps-json': maps, 'resource-output-dir': output, 'mapdefaults-xml': join(raw, 'libraries/mapdefaults/final.xml'), 'regionyields-xml': join(raw, 'libraries/regionyields/final.xml') }, blocksCache: join(output, 'unused'), sector: sid })
      const read = (root: string, file: string) => JSON.parse(readFileSync(join(root, file), 'utf8'))
      const actual = read(output, 'map_resources.json'), before = read(cold, 'map_resources.json'), python = read(expected, 'map_resources.json')
      expect(compareJson(python.sectors[sid], actual.sectors[sid])).toEqual([])
      for (const [id, sector] of Object.entries(before.sectors)) if (id !== sid) expect(compareJson(sector, actual.sectors[id])).toEqual([])
      const pythonAreas = read(expected, 'resourceareas.json').filter((row: any) => row.sector_id === sid)
      const actualAreas = read(output, 'resourceareas.json').filter((row: any) => row.sector_id === sid)
      expect(compareJson(pythonAreas, actualAreas)).toEqual([])
      expect(readFileSync(maps)).toEqual(bytes)
    } finally { rmSync(output, { recursive: true, force: true }) }
  })
  for (const scenario of ['warm', 'missing', 'single', 'forced', 'save']) {
    const expected = `/tmp/x4-migrate/python/8.0/resources/${scenario}`
    it.skipIf(!existsSync(`/tmp/x4-migrate/python/8.0/resources-${scenario}-run.json`))(`${scenario}: exact outputs and cache, except required non-target preservation`, () => {
      const output = mkdtempSync(join(tmpdir(), `resources-${scenario}-`))
      try {
        const cold = '/tmp/x4-migrate/python/8.0/resources/cold'
        cpSync(cold, output, { recursive: true })
        const cachePath = join(output, 'cache/resourcearea_blocks.json')
        if (scenario === 'missing') {
          const cache = JSON.parse(readFileSync(cachePath, 'utf8'))
          delete cache.cluster_01_sector001_macro
          writeFileSync(cachePath, JSON.stringify(cache))
        }
        const mapsPath = join(output, 'maps.json'), bytes = readFileSync(mapsPath)
        const context: ResourceContext = { config: { version: '8.0' }, rawPath: resolve('x4raw_assets/8.0-Diplomacy'), outputRoot: output, paths: { 'maps-json': mapsPath, 'regions-json': join(output, 'regions.json'), 'resource-output-dir': output }, blocksCache: cachePath, forceRecalcPerBlock: scenario === 'forced' }
        if (scenario === 'single') context.sector = 'cluster_01_sector001_macro'
        if (scenario === 'save') context.saveSampleDir = resolve('save_sample_data')
        expect(processResources(context).status).toBe('success')
        expect(readFileSync(mapsPath)).toEqual(bytes)
        if (scenario !== 'single') expect(compareDirectories(expected, output).slice(0, 20)).toEqual([])
        else {
          const read = (root: string, file: string) => JSON.parse(readFileSync(join(root, file), 'utf8'))
          for (const file of ['resourceareas.json', 'cache/resourcearea_blocks.json']) expect(compareJson(read(expected, file), read(output, file))).toEqual([])
          const actual = read(output, 'map_resources.json'), python = read(expected, 'map_resources.json'), before = read(cold, 'map_resources.json')
          expect(compareJson(python.sectors[context.sector!], actual.sectors[context.sector!])).toEqual([])
          for (const [sid, sector] of Object.entries(before.sectors)) if (sid !== context.sector) expect(compareJson(sector, actual.sectors[sid])).toEqual([])
        }
      } finally { rmSync(output, { recursive: true, force: true }) }
    }, 120000)
  }
})
