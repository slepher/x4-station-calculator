import { describe, expect, it } from 'vitest'
import { createSaveParserRuntime } from '../../../src/workers/saveParser.worker'
import { postProcessRustSaveArchive } from '../../../src/workers/saveParser.post'
import { readFile } from 'node:fs/promises'
import zlib from 'node:zlib'

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
    expect(archive.meta.parser_version).toBe('v2')
    expect(archive.isCompatible).toBe(true)
    expect(archive.isValid).toBe(true)
    expect(archive.sectors.cluster_01_sector001_macro?.name).toBe('cluster_01_sector001_macro')
    expect(archive.sectors.cluster_01_sector001_macro?.is_known).toBe(true)
    expect(archive.sectors.cluster_01_sector001_macro?.npcStations).toHaveLength(1)
    expect(archive.sectors.cluster_01_sector001_macro?.npcStations[0]).toMatchObject({
      code: 'station-1',
      owner: 'argon',
      relative_position: { x: 5, y: 6, z: 7 }
    })
  })
})

describe('save parser (Rust WASM streaming)', () => {
  it('parses xml with pump loop into archive data', async () => {
    const initWasm = (await import('../../../src/wasm/save_parser.js')).default
    const { SaveParser } = await import('../../../src/wasm/save_parser.js')
    
    const wasmPath = new URL('../../../src/wasm/save_parser_bg.wasm', import.meta.url)
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
    
    const data = new TextEncoder().encode(xml)
    parser.push_chunk(data)
    parser.finish_input()
    
    while (true) {
      const hasMore = parser.pump(1000)
      if (!hasMore) break
    }
    
    const progress = JSON.parse(parser.progress_json())
    expect(progress.phase).toBe('done')
    
    const result = parser.finish('test.xml')
    const archive = JSON.parse(result)
    
    expect(archive.meta.guid).toBe('GUID-2')
    expect(archive.meta.playerName).toBe('testplayer')
    expect(archive.meta.version).toBe('800')
    expect(archive.meta.filename).toBe('test')
    expect(archive.meta.parser_version).toBe('v2')
    expect(archive.isCompatible).toBe(true)
    expect(archive.sectors.test_sector_macro?.playerStations).toHaveLength(1)
    expect(archive.sectors.test_sector_macro?.playerStations[0]?.code).toBe('TEST-001')
    expect(archive.sectors.test_sector_macro?.playerStations[0]?.owner).toBe('player')
    expect(archive.sectors.test_sector_macro?.playerStations[0]?.relative_position).toEqual({ x: 100, y: 200, z: 300 })
  })

  it('parses gzip bytes directly in rust wasm parser', async () => {
    const initWasm = (await import('../../../src/wasm/save_parser.js')).default
    const { SaveParser } = await import('../../../src/wasm/save_parser.js')

    const wasmPath = new URL('../../../src/wasm/save_parser_bg.wasm', import.meta.url)
    const wasmBinary = await readFile(wasmPath)
    await initWasm({ module_or_path: wasmBinary })

    const xml = `<savegame><info>
      <game guid="GUID-3" seed="300" time="789.1" version="800" />
      <player name="gzip-player" />
      </info>
      <component class="sector" macro="gzip_sector_macro" known="1">
      <component class="station" macro="gzip_station_macro" code="GZIP-001" owner="player">
      <offset><position x="7" y="8" z="9" /></offset>
      </component>
      </component>
      </savegame>`

    const parser = new SaveParser()
    const gzipped = zlib.gzipSync(Buffer.from(xml))
    parser.set_expected_total_bytes(Buffer.byteLength(xml))

    for (const chunk of [gzipped.subarray(0, 13), gzipped.subarray(13)]) {
      parser.push_chunk(new Uint8Array(chunk))
      while (parser.pump(1000)) {}
    }

    parser.finish_input()
    while (parser.pump(1000)) {}

    const archive = JSON.parse(parser.finish('gzip.xml.gz'))
    expect(archive.meta.playerName).toBe('gzip-player')
    expect(archive.sectors.gzip_sector_macro?.playerStations[0]?.code).toBe('GZIP-001')
    expect(archive.sectors.gzip_sector_macro?.playerStations[0]?.owner).toBe('player')
    expect(archive.sectors.gzip_sector_macro?.playerStations[0]?.relative_position).toEqual({ x: 7, y: 8, z: 9 })
  })
})

describe('save parser rust worker enrichment', () => {
  it('resolves zone-relative positions from zone dictionaries', () => {
    const archive = postProcessRustSaveArchive({
      meta: {
        guid: 'g',
        seed: 1,
        time: 2,
        playerName: 'p',
        version: '800',
        filename: 'f',
        parser_version: 'v2',
        source: 'original'
      },
      isCompatible: true,
      isValid: true,
      sectors: {
        cluster_01_sector001_macro: {
          name: 'cluster_01_sector001_macro',
          is_known: true,
          npcStations: [{
            code: 'NPC',
            macro: 'station_arg_factory_macro',
            owner: 'argon',
            x: 1,
            y: 2,
            z: 3,
            relative_position: { x: 10, y: 20, z: 30 },
            zone_id: 'zone_alpha'
          }]
        }
      }
    }, undefined, {
      clusters: {
        cluster_01: {
          id: 'cluster_01',
          nameId: '',
          name: 'Cluster 01',
          dlc_tag: 'base',
          owner: 'argon',
          owner_color: '#8899aa',
          sectors: {
            Cluster_01_Sector001_macro: {
              id: 'Cluster_01_Sector001_macro',
              cluster_id: 'cluster_01',
              nameId: '',
              name: 'Sector',
              owner: 'argon',
              owner_color: '#8899aa',
              zones: {
                Zone_Alpha: {
                  id: 'Zone_Alpha',
                  position: { x: 100, y: 200, z: 300 }
                }
              }
            }
          }
        }
      }
    })

    expect(archive.sectors.cluster_01_sector001_macro.npcStations?.[0]?.position).toEqual({
      x: 110,
      y: 220,
      z: 330
    })
    expect(archive.meta.post_processor_version).toBe('v2')
    expect(archive.isValid).toBe(true)
  })

  it('derives station flags in worker layer', () => {
    const archive = postProcessRustSaveArchive({
      meta: {
        guid: 'g',
        seed: 1,
        time: 2,
        playerName: 'p',
        version: '800',
        filename: 'f',
        parser_version: 'v2',
        source: 'original'
      },
      isCompatible: true,
      isValid: true,
      sectors: {
        sec: {
          name: 'sec',
          is_known: true,
          npcStations: [{
            code: 'NPC',
            macro: 'station_arg_factory_macro',
            owner: 'argon',
            x: 1,
            y: 2,
            z: 3,
            modules: [{ ref: 'buildmodule_arg_ships_m_macro', amount: 2 }]
          }],
          xenonStations: [{
            code: 'XEN',
            macro: 'station_gen_tradestation_macro',
            owner: 'xenon',
            x: 4,
            y: 5,
            z: 6,
            modules: [
              { ref: 'buildmodule_xen_ships_xl_macro', amount: 1 },
              { ref: 'buildmodule_xen_equip_macro', amount: 1 }
            ]
          }],
          khaakStations: [{
            code: 'KHA',
            macro: 'landmarks_kha_hive_macro',
            owner: 'khaak',
            x: 7,
            y: 8,
            z: 9,
            modules: [{ ref: 'module_khaak_special', amount: 1 }]
          }]
        }
      }
    })

    expect(archive.sectors.sec.npcStations?.[0]).toMatchObject({
      isWharf: true
    })
    expect(archive.sectors.sec.xenonStations?.[0]).toMatchObject({
      isShipyard: true,
      isEquipmentdock: true,
      isTradestation: true
    })
    expect(archive.sectors.sec.khaakStations?.[0]).toMatchObject({
      isHive: true
    })
    expect(archive.sectors.sec.khaakStations?.[0]?.isShipyard).toBeUndefined()
  })

  it('omits empty playerStations after post processing', () => {
    const archive = postProcessRustSaveArchive({
      meta: {
        guid: 'g',
        seed: 1,
        time: 2,
        playerName: 'p',
        version: '800',
        filename: 'f',
        parser_version: 'v2',
        source: 'original'
      },
      isCompatible: true,
      isValid: true,
      sectors: {
        sec: {
          name: 'sec',
          is_known: true,
          playerStations: [],
          npcStations: []
        }
      }
    })

    expect(archive.sectors.sec.playerStations).toBeUndefined()
    expect(archive.sectors.sec.npcStations).toBeUndefined()
  })
})
