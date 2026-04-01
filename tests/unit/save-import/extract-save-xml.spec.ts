import { describe, expect, it } from 'vitest'
import {
  createFilteredSaveXmlRuntime,
  extractFilteredSaveXmlFromString,
  extractQueryXmlFromString,
  parseQueryTag
} from '../../../scripts/extract_save'

describe('extract save xml filtering', () => {
  it('keeps valid subtrees, preserves ancestors to root, and excludes empty sectors', () => {
    const xml = [
      '<savegame>',
      '<info>',
      '<game guid="GUID-1" version="800"><ignored>meta</ignored></game>',
      '<player name="pilot"><stats><value foo="bar"/></stats></player>',
      '</info>',
      '<universe>',
      '<component class="cluster" macro="cluster_1">',
      '<component class="sector" macro="sector_valid">',
      '<component class="station" macro="station_alpha" code="ALPHA">',
      '<offset><position x="1" y="2" z="3" /></offset>',
      '<child attr="keep">text</child>',
      '</component>',
      '</component>',
      '<component class="sector" macro="sector_empty">',
      '<component class="zone" macro="zone_1" />',
      '</component>',
      '<component class="datavault" macro="vault_outside_sector" />',
      '</component>',
      '</universe>',
      '</savegame>'
    ].join('')

    const result = extractFilteredSaveXmlFromString(xml, null)

    expect(result.sectorCount).toBe(2)
    expect(result.xml).toContain('<savegame>')
    expect(result.xml).toContain('<info/>')
    expect(result.xml).toContain('<universe/>')
    expect(result.xml).toContain('<game guid="GUID-1" version="800"/>')
    expect(result.xml).toContain('<player name="pilot"/>')
    expect(result.xml).toContain('<component class="cluster" macro="cluster_1"/>')
    expect(result.xml).toContain('<component class="sector" macro="sector_valid"/>')
    expect(result.xml).toContain('<component class="station" macro="station_alpha" code="ALPHA">')
    expect(result.xml).toContain('<offset>')
    expect(result.xml).toContain('<position x="1" y="2" z="3"/>')
    expect(result.xml).toContain('<component class="datavault" macro="vault_outside_sector"/>')
    expect(result.xml).not.toContain('<ignored>')
    expect(result.xml).not.toContain('<stats>')
    expect(result.xml).not.toContain('<child attr="keep">text</child>')
    expect(result.xml).not.toContain('sector_empty')
    expect(result.xml).not.toContain('<component class="zone" macro="zone_1"')
  })

  it('supports chunked streaming output without building the full source xml string first', () => {
    const chunks = [
      '<savegame><info><game guid="GUID-1" version="800">',
      '<ignored>meta</ignored></game><player name="pilot"/></info>',
      '<universe><component class="sector" macro="sector_valid">',
      '<component class="station" macro="station_alpha" code="ALPHA">',
      '<offset><position x="1" y="2" z="3"/></offset>',
      '</component></component></universe></savegame>'
    ]

    const output: string[] = []
    const runtime = createFilteredSaveXmlRuntime({
      expectedVersion: null,
      write: (chunk) => output.push(chunk)
    })

    for (const chunk of chunks) {
      runtime.feed(chunk)
    }
    const result = runtime.close()

    expect(result.sectorCount).toBe(1)
    expect(output.join('')).toContain('<component class="sector" macro="sector_valid"/>')
    expect(output.join('')).toContain('<component class="station" macro="station_alpha" code="ALPHA">')
    expect(output.join('')).toContain('<offset>')
    expect(output.join('')).toContain('<position x="1" y="2" z="3"/>')
  })

  it('does not keep player-only station construction details for non-player owners', () => {
    const xml = [
      '<savegame><info><game guid="GUID-1" version="800"/><player name="pilot"/></info><universe><component class="sector" macro="sector_valid">',
      '<component class="station" macro="station_gen_factory_base_01_macro" code="LPR-776" owner="court">',
      '<listeners><listener event="killed"/></listeners>',
      '<events><event event="updatetradeoffers" time="1"/></events>',
      '<offset><position x="1" y="2" z="3"/><rotation yaw="77"/></offset>',
      '<render><parameter name="diffuse_map"/></render>',
      '<control><post id="manager"/></control>',
      '<construction><sequence>',
      '<entry id="[0x1]" index="1" macro="pier_macro">',
      '<predecessor index="0" connection="foo"/>',
      '<offset><position x="10" y="20" z="30"/></offset>',
      '<upgrades><groups>',
      '<shields macro="shield_macro" group="g1"/>',
      '<turrets macro="turret_macro" group="g2"/>',
      '</groups></upgrades>',
      '</entry>',
      '</sequence></construction>',
      '</component></component></universe></savegame>'
    ].join('')

    const result = extractFilteredSaveXmlFromString(xml, null)

    expect(result.xml).toContain('<offset>')
    expect(result.xml).toContain('<position x="1" y="2" z="3"/>')
    expect(result.xml).not.toContain('<construction>')
    expect(result.xml).not.toContain('<entry id="[0x1]" index="1" macro="pier_macro">')
    expect(result.xml).not.toContain('<shields macro="shield_macro" group="g1"/>')
    expect(result.xml).not.toContain('<turrets macro="turret_macro" group="g2"/>')
    expect(result.xml).not.toContain('<listeners>')
    expect(result.xml).not.toContain('<events>')
    expect(result.xml).not.toContain('<render>')
    expect(result.xml).not.toContain('<control>')
    expect(result.xml).not.toContain('<predecessor')
    expect(result.xml).not.toContain('<rotation')
    expect(result.xml).not.toContain('<entry id="[0x1]" index="1" macro="pier_macro"><predecessor')
    expect(result.xml).not.toContain('<offset><position x="10" y="20" z="30"/></offset>')
  })

  it('keeps module details only for player-owned stations because those enter json', () => {
    const xml = [
      '<savegame><info><game guid="GUID-1" version="800"/><player name="pilot"/></info><universe><component class="sector" macro="sector_valid">',
      '<component class="station" macro="station_player" code="P-1" owner="player">',
      '<offset><position x="1" y="2" z="3"/></offset>',
      '<construction><sequence>',
      '<entry id="[0x1]" index="1" macro="pier_macro">',
      '<predecessor index="0" connection="foo"/>',
      '<offset><position x="10" y="20" z="30"/></offset>',
      '<upgrades><groups>',
      '<shields macro="shield_macro" group="g1"/>',
      '<turrets macro="turret_macro" group="g2"/>',
      '</groups></upgrades>',
      '</entry>',
      '</sequence></construction>',
      '</component></component></universe></savegame>'
    ].join('')

    const result = extractFilteredSaveXmlFromString(xml, null)

    expect(result.xml).toContain('<construction>')
    expect(result.xml).toContain('<entry id="[0x1]" index="1" macro="pier_macro">')
    expect(result.xml).toContain('<shields macro="shield_macro" group="g1"/>')
    expect(result.xml).toContain('<turrets macro="turret_macro" group="g2"/>')
    expect(result.xml).not.toContain('<predecessor')
    expect(result.xml).not.toContain('<offset><position x="10" y="20" z="30"/></offset>')
  })

  it('does not leak child module component chains when only station position enters json', () => {
    const xml = [
      '<savegame><info><game guid="GUID-1" version="800"/><player name="pilot"/></info><universe>',
      '<component class="sector" macro="sector_valid">',
      '<component class="station" macro="station_alpha" code="ALPHA" owner="court">',
      '<offset><position x="1" y="2" z="3"/></offset>',
      '<connections><connection connection="modules">',
      '<component class="dockarea" macro="dock_macro" construction="[0x1]">',
      '<offset><position x="10" y="20" z="30"/></offset>',
      '</component>',
      '</connection></connections>',
      '</component></component></universe></savegame>'
    ].join('')

    const result = extractFilteredSaveXmlFromString(xml, null)

    expect(result.xml).toContain('<component class="station" macro="station_alpha" code="ALPHA" owner="court">')
    expect(result.xml).toContain('<offset>')
    expect(result.xml).toContain('<position x="1" y="2" z="3"/>')
    expect(result.xml).not.toContain('<connections>')
    expect(result.xml).not.toContain('<connection connection="modules">')
    expect(result.xml).not.toContain('<component class="dockarea"')
    expect(result.xml).not.toContain('<position x="10" y="20" z="30"/>')
  })

  it('writes pretty lowercase xml even when source tags are uppercase', () => {
    const xml = [
      '<SAVEGAME><INFO><GAME GUID="GUID-1" VERSION="800"/><PLAYER NAME="pilot"/></INFO>',
      '<UNIVERSE><COMPONENT CLASS="sector" MACRO="sector_valid">',
      '<COMPONENT CLASS="station" MACRO="station_alpha" CODE="ALPHA" OWNER="court">',
      '<OFFSET><POSITION X="1" Y="2" Z="3"/></OFFSET>',
      '</COMPONENT></COMPONENT></UNIVERSE></SAVEGAME>'
    ].join('')

    const result = extractFilteredSaveXmlFromString(xml, null)

    expect(result.xml).toContain('<savegame>')
    expect(result.xml).toContain('\n  <info/>')
    expect(result.xml).toContain('\n    <game guid="GUID-1" version="800"/>')
    expect(result.xml).toMatch(/\n\s+<component class="station" macro="station_alpha" code="ALPHA" owner="court">/)
    expect(result.xml).toMatch(/\n\s+<offset>/)
    expect(result.xml).toMatch(/\n\s+<position x="1" y="2" z="3"\/>/)
    expect(result.xml).not.toContain('<SAVEGAME>')
    expect(result.xml).not.toContain('<OFFSET>')
    expect(result.xml).not.toContain(' CLASS=')
  })

  it('parses query tags with tag name and attribute filters', () => {
    expect(parseQueryTag('<component class="station" id="[0x3139]">')).toEqual({
      name: 'component',
      attributes: {
        class: 'station',
        id: '[0x3139]'
      }
    })
  })

  it('extracts all matching tags with full subtree and ancestor chain as pretty xml', () => {
    const xml = [
      '<savegame><universe>',
      '<component class="sector" macro="sector_a">',
      '<component class="station" id="[0x1]" class2="noop"><offset><position x="1" y="2" z="3"/></offset></component>',
      '</component>',
      '<component class="sector" macro="sector_b">',
      '<component class="station" id="[0x1]"><offset><position x="4" y="5" z="6"/></offset><child foo="bar"/></component>',
      '</component>',
      '</universe></savegame>'
    ].join('')

    const result = extractQueryXmlFromString(xml, '<component class="station" id="[0x1]">')

    expect(result.matchCount).toBe(2)
    expect(result.xml).toContain('<query-results>')
    expect(result.xml).toContain('<match index="1">')
    expect(result.xml).toContain('<match index="2">')
    expect(result.xml).toContain('<savegame>')
    expect(result.xml).toContain('<universe>')
    expect(result.xml).toContain('<component class="sector" macro="sector_a">')
    expect(result.xml).toContain('<component class="sector" macro="sector_b">')
    expect(result.xml).toContain('<component class="station" id="[0x1]">')
    expect(result.xml).toContain('<offset>')
    expect(result.xml).toContain('<position x="4" y="5" z="6"/>')
    expect(result.xml).toContain('<child foo="bar"/>')
  })
})
