import { describe, expect, it } from 'vitest'
import { createSaveParserRuntime, parseSaveXmlChunks } from '@/workers/saveParser.worker'
import type { SaveParserConfig } from '@/types/saveArchive'

function createConfig(): SaveParserConfig {
  return {
    sectorNames: {
      cluster_01_sector001_macro: '{20004,10011}'
    },
    filename: 'save_005.xml.gz',
    shipNames: {},
    positions: {
      station_macro_test: { x: 100, y: 0, z: 50 }
    },
    strings: {
      '20004': {
        '10011': 'Grand Exchange I'
      }
    },
    currentVersion: '8.0'
  }
}

describe('save parser core', () => {
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

    const runtime = createSaveParserRuntime(createConfig())
    const archive = await parseSaveXmlChunks(runtime, xml)

    expect(archive.meta.guid).toBe('GUID-1')
    expect(archive.meta.playerName).toBe('slepher')
    expect(archive.meta.version).toBe('800')
    expect(archive.meta.filename).toBe('save_005')
    expect(archive.meta.parser_version).toBe('v1')
    expect(archive.isCompatible).toBe(true)
    expect(archive.sectors.cluster_01_sector001_macro?.name).toBe('Grand Exchange I')
    expect(archive.sectors.cluster_01_sector001_macro?.stations).toHaveLength(1)
    expect(archive.sectors.cluster_01_sector001_macro?.stations[0]).toMatchObject({
      code: 'station-1',
      owner: 'argon',
      x: 105,
      y: 6,
      z: 57
    })
  })
})
