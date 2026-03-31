import { describe, expect, it } from 'vitest'
import { createSaveParserRuntime } from '@/workers/saveParserSimplified.worker'
import { readFile } from 'node:fs/promises'

describe('save parser core (simplified)', () => {
  it('parses streamed xml chunks into archive data', async () => {
    const xml = [
      '<savegame><info>',
      '<game guid="GUID-1" seed="42" time="123.5" version="800" />',
      '<player name="slepher" />',
      '</info>',
      '<component class="sector" macro="cluster_01_sector001_macro" known="1">',
      '<component class="station" macro="station_macro_test" code="station-1" owner="argon">',
      '<offset><position x="5" y="6" z="7" /></offset>',
      '</component>',
      '</component>',
      '</savegame>'
    ]

    const runtime = createSaveParserRuntime()
    for (const chunk of xml) {
      runtime.feed(chunk)
    }
    const archive = runtime.close('test_save.xml')

    expect(archive.meta.guid).toBe('GUID-1')
    expect(archive.meta.playerName).toBe('slepher')
    expect(archive.meta.version).toBe('800')
    expect(archive.meta.filename).toBe('test_save')
    expect(archive.meta.parser_version).toBe('v1')
    expect(archive.isCompatible).toBe(true)
    expect(archive.sectors.cluster_01_sector001_macro?.name).toBe('cluster_01_sector001_macro')
    expect(archive.sectors.cluster_01_sector001_macro?.is_known).toBe(true)
    expect(archive.sectors.cluster_01_sector001_macro?.stations).toHaveLength(1)
    expect(archive.sectors.cluster_01_sector001_macro?.stations[0]).toMatchObject({
      code: 'station-1',
      owner: 'argon',
      x: 5,
      y: 6,
      z: 7
    })
  })
})

describe('save parser (Rust WASM)', () => {
  it('parses xml into archive data', async () => {
    const initWasm = (await import('@/wasm/save_parser.js')).default
    const { SaveParser } = await import('@/wasm/save_parser.js')
    
    const wasmPath = new URL('../../src/wasm/save_parser_bg.wasm', import.meta.url)
    const wasmBinary = await readFile(wasmPath)
    await initWasm({ module_or_path: wasmBinary })
    
    const parser = new SaveParser()
    
    const xml = `<savegame><info>
      <game guid="GUID-2" seed="100" time="456.7" version="800" />
      <player name="testplayer" />
      </info>
      <component class="sector" macro="test_sector_macro" known="1">
      <component class="station" macro="test_station_macro" code="TEST-001" owner="player">
      <offset><position x="100" y="200" z="300" /></offset>
      </component>
      </component>
      </savegame>`
    
    parser.feed(new TextEncoder().encode(xml))
    const result = parser.finish('test.xml')
    const archive = JSON.parse(result)
    
    expect(archive.meta.guid).toBe('GUID-2')
    expect(archive.meta.playerName).toBe('testplayer')
    expect(archive.meta.version).toBe('800')
    expect(archive.meta.filename).toBe('test')
    expect(archive.meta.parser_version).toBe('v1')
    expect(archive.isCompatible).toBe(true)
    expect(archive.sectors.test_sector_macro?.stations).toHaveLength(1)
    expect(archive.sectors.test_sector_macro?.stations[0]).toMatchObject({
      code: 'TEST-001',
      owner: 'player',
      x: 100,
      y: 200,
      z: 300
    })
  })
})