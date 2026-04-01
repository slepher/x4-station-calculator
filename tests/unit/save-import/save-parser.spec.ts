import { describe, expect, it, vi } from 'vitest'
import { createSaveParserRuntime } from '../../../src/workers/saveParser.worker'
import { readFile } from 'node:fs/promises'
import { streamCompressedXmlToRustParser } from '../../../src/workers/saveParserRust.worker'

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

  it('streams gzip chunks directly into rust parser without aggregating decompressed output', async () => {
    const pushedChunks: string[] = []
    const parser = {
      push_chunk: vi.fn((chunk: Uint8Array) => {
        pushedChunks.push(new TextDecoder().decode(chunk))
      }),
      pump: vi.fn(() => false),
      progress_json: vi.fn(() => JSON.stringify({
        phase: 'parsing',
        percent: 50,
        tagCount: 1,
        sectorCount: 0,
        done: false,
        inputComplete: false,
        error: null,
        inputBytesTotal: 10,
        parsedBytesTotal: 5,
        bufferedBytes: 0,
        expectedTotalBytes: 12
      })),
      finish_input: vi.fn()
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<save'))
        controller.enqueue(new TextEncoder().encode('game/>'))
        controller.close()
      }
    })
    const onProgress = vi.fn()
    const onError = vi.fn()

    await streamCompressedXmlToRustParser({
      parser,
      stream,
      maxEventsPerPump: 10,
      onProgress,
      onError
    })

    expect(parser.push_chunk).toHaveBeenCalledTimes(2)
    expect(pushedChunks).toEqual(['<save', 'game/>'])
    expect(parser.finish_input).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalled()
  })
})
