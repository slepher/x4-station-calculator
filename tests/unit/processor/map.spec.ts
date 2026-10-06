import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { processMap } from '../../../scripts/processor/map-ts';
import { I18nRegistry } from '../../../scripts/processor/shared-ts/i18n';
import { parseMapXml, children } from '../../../scripts/processor/map-ts/xml';
import { modernDefinitions, sectorResourceareas, legacyRegions, legacyYields, piecewise } from '../../../scripts/processor/map-ts/definitions';
import { blockCounts, roundEven, roundDecimal, hypot2, sampleSpline, splineLength, solidVolume } from '../../../scripts/processor/map-ts/calculator';
import { regionSector, template, zonePath } from '../../../scripts/processor/map-ts/sector';
const sid = 'Cluster_01_Sector001_macro';
function write(path: string, text: string): void { mkdirSync(dirname(path), {
    recursive: true
}); writeFileSync(path, text); }
function fixture(): any {
    const root = mkdtempSync(join(tmpdir(), 'x4-map-unit-')), rawPath = join(root, 'raw'), outputRoot = join(root, 'output'), mapDir = join(rawPath, 'maps', 'xu_ep2_universe');
    for (const name of ['galaxy', 'clusters', 'sectors', 'zones', 'zonehighways', 'sechighways'])
        write(join(mapDir, name, 'final.xml'), '<macros/>');
    write(join(mapDir, 'galaxy', 'final.xml'), '<macros><macro class="galaxy"><connections><connection ref="clusters"><macro ref="Cluster_01_macro"/><offset><position x="15000000" z="8660000"/></offset></connection></connections></macro></macros>');
    write(join(mapDir, 'clusters', 'final.xml'), `<macros><macro class="cluster" name="Cluster_01_macro"><connections><connection ref="sectors"><macro ref="${sid}"/><offset><position x="1000" z="2000"/></offset></connection></connections></macro></macros>`);
    write(join(mapDir, 'sectors', 'final.xml'), `<macros><macro class="sector" name="${sid}"><connections><connection ref="zones"><macro ref="Zone001_Cluster_01_Sector001_macro"/><offset><position x="32000" y="123" z="-32000"/></offset></connection></connections></macro></macros>`);
    write(join(mapDir, 'zones', 'final.xml'), '<macros><macro class="zone" name="Zone001_Cluster_01_Sector001_macro"><connections><connection name="connection_ClusterGate001To002"/></connections></macro></macros>');
    write(join(rawPath, 'libraries', 'mapdefaults', 'final.xml'), `<mapdefaults><dataset macro="Cluster_01_macro"><properties><identification name="{1,1}"/><area sunlight="0.5" tags="[cluster]"/></properties></dataset><dataset macro="${sid}"><properties><identification name="{1,2}"/></properties></dataset></mapdefaults>`);
    write(join(rawPath, 'libraries', 'regionyields', 'final.xml'), '<regionyields/>');
    write(join(rawPath, 'libraries', 'region_definitions', 'final.xml'), '<regions/>');
    write(join(rawPath, 'libraries', 'regionobjectgroups', 'final.xml'), '<groups/>');
    write(join(rawPath, 'libraries', 'factions', 'final.xml'), '<factions><faction id="argon" name="{1,3}" tags="[claimspace]"><color ref="mapped"/></faction></factions>');
    write(join(rawPath, 'libraries', 'colors', 'final.xml'), '<root><colors><color id="source" r="1" g="2" b="255"/></colors><mappings><mapping id="mapped" ref="source"/></mappings></root>');
    write(join(rawPath, 'libraries', 'god', 'final.xml'), `<god><stations><station id="one" owner="argon" type="factory"><location class="sector" macro="${sid}"/></station><station id="two" owner="teladi" type="shipyard"><location class="zone" macro="zone001_cluster_01_sector001_macro"/><station><select tags="[factory shipyard]"/></station></station><station id="three" owner="player" type="shipyard"><location class="sector" macro="${sid}"/></station></stations></god>`);
    write(join(rawPath, 'md', 'khaak_activity', 'final.xml'), `<md><find_sector macro="macro.${sid}"/><patch><find_sector macro="macro.Cluster_02_Sector001_macro"/></patch></md>`);
    write(join(rawPath, 't', '0001-L044.xml'), '<language><page id="1"><t id="1">Cluster English</t><t id="2">Sector English</t><t id="3">Argon</t></page></language>');
    return {
        root, rawPath, outputRoot, mapDir, config: {
            version: '9.0', dlc_order: []
        }
    };
}
function json(path: string): any { return JSON.parse(readFileSync(path, 'utf8')); }
describe('map processor contracts', () => {
    it('runs independently, preserves ownership and zone/gate coordinates, and isolates versions', () => {
        const f = fixture(), a = processMap(f), maps = json(join(f.outputRoot, 'data/maps.json')), sector = maps.sectors[sid.toLowerCase()];
        expect(a.resource_model).toBe('resourceareas');
        expect(a.files_written).toBe(3);
        expect(sector.name).toBe('Sector English');
        expect(sector.owner).toBe('teladi');
        expect(sector.raw_center_pos).toEqual({
            x: 0, y: 123, z: 0
        });
        expect(sector.area).toEqual({
            sunlight: 0.5, economy: 0, security: 0, tags: ['cluster']
        });
        expect(sector.cluster_gates.connection_clustergate001to002).toMatchObject({
            target_cluster_id: 'cluster_02_macro', raw_local_pos: {
                x: 32000, z: -32000
            }
        });
        expect(sector.stations.map((s: any) => s.owner)).toEqual(['argon', 'teladi', 'player']);
        expect(sector.has_khaak_hive).toBe(true);
        expect(sector).not.toHaveProperty('resources');
        expect(sector).not.toHaveProperty('resourceareas');
        expect(json(join(f.outputRoot, 'data/factions.json'))[0]).toMatchObject({
            name: 'Argon', color: '#0102FF', claimspace: true
        });
        const second = fixture();
        write(join(second.rawPath, 't', '0001-L044.xml'), '<language><page id="1"><t id="2">Other Version</t></page></language>');
        processMap(second);
        expect(json(join(second.outputRoot, 'data/maps.json')).sectors[sid.toLowerCase()].name).toBe('Other Version');
    });
    it('uses shared registry and factions without reconfiguration or factions output', () => {
        const f = fixture(), registry = new I18nRegistry();
        registry.configure(f.rawPath, {
            '044': {
                iso: 'en'
            }
        });
        const configure = vi.spyOn(registry, 'configure');
        const getName = vi.spyOn(registry, 'getName');
        processMap({
            ...f, i18n: registry, factions: [{
                    id: 'teladi', color: '#123456', claimspace: false
                }, {
                    id: 'argon', color: '#abcdef', claimspace: true
                }]
        });
        expect(configure).not.toHaveBeenCalled();
        expect(getName).toHaveBeenCalledWith('{1,2}', 'en');
        expect(registry.exportCollected('en')).toHaveProperty('{1,2}');
        const maps = json(join(f.outputRoot, 'data/maps.json'));
        expect(maps.sectors[sid.toLowerCase()].owner).toBe('argon');
        expect(maps.sectors[sid.toLowerCase()].owner_color).toBe('#abcdef');
        expect(existsSync(join(f.outputRoot, 'data/factions.json'))).toBe(false);
    });
    it('collects final mapdefault names after duplicate resolution in a shared registry', () => {
        const f = fixture(), registry = new I18nRegistry();
        registry.configure(f.rawPath, { '044': { iso: 'en' } });
        const defaults = join(f.rawPath, 'libraries', 'mapdefaults', 'final.xml');
        write(defaults, readFileSync(defaults, 'utf8').replace('</mapdefaults>',
            '<dataset macro="Cluster_99_Sector001_macro"><properties><identification name="{20003,7840001}"/></properties></dataset>' +
            '<dataset macro="cluster_99_sector001_macro"><properties><identification name="{20003,7840002}"/></properties></dataset>' +
            '<dataset macro="Cluster_98_Sector001_macro"><properties><identification name="{20003,7840003}"/></properties></dataset></mapdefaults>'));
        const locale = join(f.rawPath, 't', '0001-L044.xml');
        write(locale, readFileSync(locale, 'utf8').replace('</language>',
            '<page id="20003"><t id="7840001">Overwritten name</t><t id="7840002">Final alias</t><t id="7840003">Nonmaterialized alias</t></page></language>'));
        registry.collect('{1,3}');
        processMap({ ...f, i18n: registry, factions: [] });
        const exported = registry.exportCollected('en');
        expect(exported).toHaveProperty('{1,1}', 'Cluster English');
        expect(exported).toHaveProperty('{1,2}', 'Sector English');
        expect(exported).toHaveProperty('{1,3}', 'Argon');
        expect(exported).not.toHaveProperty('{20003,7840001}');
        expect(exported).toHaveProperty('{20003,7840002}', 'Final alias');
        expect(exported).toHaveProperty('{20003,7840003}', 'Nonmaterialized alias');
    });
    it('honors map directory, XML inputs and individual output paths', () => {
        const f = fixture(), defaults = join(f.root, 'override.xml'), out = join(f.root, 'custom/map.json'), mapDir = join(f.root, 'alternate-map');
        for (const name of ['galaxy', 'clusters', 'sectors', 'zones', 'zonehighways', 'sechighways'])
            write(join(mapDir, name, 'final.xml'), readFileSync(join(f.mapDir, name, 'final.xml'), 'utf8'));
        write(defaults, `<mapdefaults><dataset macro="${sid}"><properties><area sunlight="77"/></properties></dataset></mapdefaults>`);
        const paths = {
            'map-dir': mapDir, 'mapdefaults-xml': defaults, output: out, 'factions-output': join(f.root, 'custom/factions.json'), 'regionyield-definitions-output': join(f.root, 'custom/definitions.json')
        };
        const result = processMap({
            ...f, paths
        });
        expect(result.outputs).toEqual([out, paths['factions-output'], paths['regionyield-definitions-output']]);
        expect(json(out).sectors[sid.toLowerCase()].area.sunlight).toBe(77);
        expect(existsSync(join(f.outputRoot, 'data/maps.json'))).toBe(false);
    });
    it('routes legacy output overrides and fails missing explicit input before writing', () => {
        const f = fixture(), paths = {
            'regions-output': join(f.root, 'regions.json'), 'regionyields-output': join(f.root, 'yields.json')
        };
        const result = processMap({
            ...f, config: {
                version: '8.0'
            }, paths
        });
        expect(result.files_written).toBe(5);
        expect(json(paths['regions-output'])).toEqual([]);
        expect(json(paths['regionyields-output'])).toEqual([]);
        const other = fixture();
        expect(() => processMap({
            ...other, paths: {
                'god-xml': join(other.root, 'missing.xml')
            }
        })).toThrow(/Missing map input god-xml/);
        expect(existsSync(other.outputRoot)).toBe(false);
        expect(() => processMap({
            ...other, paths: {
                'mapdefaults-xml': join(other.root, 'missing.xml')
            }
        })).toThrow();
        expect(existsSync(other.outputRoot)).toBe(false);
    });
});
describe('map definition conversion', () => {
    it('expands modern definitions in yield/ware/boundary/gather order and keeps gas factors', () => {
        const root = parseMapXml('<regionyields><boundaries><boundary id="sphere_small"><size r="100"/></boundary><boundary id="sphere_large"><size r="200"/></boundary></boundaries><gatherspeeds><gatherspeed id="fast" factor="2" rating="5"/></gatherspeeds><yields><yield id="low" scaneffect="effect"><ware id="ore" yield="10" respawndelay="3"/><ware id="hydrogen" yield="20" respawndelay="0"/></yield></yields></regionyields>'), rows = Object.values(modernDefinitions(root));
        expect(rows.map(r => r.id)).toEqual(['sphere_small_ore_low_fast', 'sphere_large_ore_low_fast', 'sphere_small_hydrogen_low_fast', 'sphere_large_hydrogen_low_fast']);
        expect(rows[0]).toMatchObject({
            objectyieldfactor: 2, sustainableYieldPerHour: 200, scaneffect: 'effect'
        });
        expect(rows[2]).toMatchObject({
            gatherspeedfactor: 2, sustainableYieldPerHour: 0
        });
    });
    it('supports direct definitions and sector amount truncation without conflating absent factors', () => {
        const rows = modernDefinitions(parseMapXml('<regionyields><definitions><definition id="sphere_tiny_ore_low" ware="ore" yield="5" respawndelay="0" objectyieldfactor="0"><boundary class="sphere"><size r="42"/></boundary></definition></definitions></regionyields>'));
        expect(rows.sphere_tiny_ore_low).toMatchObject({
            radius: 42, size: 'tiny', objectyieldfactor: 0
        });
        expect(rows.sphere_tiny_ore_low).not.toHaveProperty('gatherspeedfactor');
        const areas = sectorResourceareas(parseMapXml(`<root><dataset macro="${sid}"><properties><resourceareas><resourcearea ref="a" amount="2.9"/><resourcearea ref="b" amount="0"/><resourcearea ref="c" amount="0.5"/></resourceareas></properties></dataset></root>`));
        expect(areas[sid.toLowerCase()]).toEqual([{
                ref: 'a', amount: 2
            }, {
                ref: 'b', amount: 1
            }, {
                ref: 'c', amount: 0
            }]);
    });
    it('preserves mixed field order, nebula attribute types and named legacy yield selection', () => {
        const yields = legacyYields(parseMapXml('<regionyields><resource ware="ore"><yield name="low" resourcedensity="1" replenishtime="60"/><yield name="high" resourcedensity="2" replenishtime="30"/></resource></regionyields>'));
        const rows = legacyRegions(parseMapXml('<regions><region name="region"><boundary class="sphere"><size r="1000"/></boundary><resources><resource ware="ore" yield="high"/></resources><fields><nebula backgroundfog="true" localred="12" localdensity="0.2" custom="001"/><asteroid groupref="oregroup" seed="001"/><debris ref="oregroup"/></fields></region></regions>'), parseMapXml('<groups><group name="oregroup" resource="ore" yield="7" yieldvariation="0.1"/></groups>'), yields);
        expect(rows[0].resources).toEqual([{
                ware: 'ore', resourcedensity: 2, delay: 30, gatherfactor: 1, yield_name: 'high'
            }]);
        expect(rows[0].fields.map((f: any) => f.tag)).toEqual(['nebula', 'asteroid', 'debris']);
        expect(rows[0].fields[0]).toMatchObject({
            backgroundfog: true, localred: 12, localdensity: 0.2, custom: '001'
        });
        expect(rows[0].fields[1]).toMatchObject({
            seed: '001', resource: 'ore', yield: 7
        });
        expect(children(parseMapXml('<r><n id="001"/><n id="002"/></r>'), 'n').map(n => n.attrs.id)).toEqual(['001', '002']);
    });
});
describe('map numeric and sector rules', () => {
    it('retains Python rounding and exact hypot regressions', () => { expect([roundEven(-2.5), roundEven(-1.5), roundEven(2.5), roundEven(3.5)]).toEqual([-2, -2, 2, 4]); expect(roundDecimal(2.675, 2)).toBe(2.67); expect(hypot2(3, 4)).toBe(5);
        expect(hypot2(-245970.703125, -143710.9375)).toBe(284876.14914719656);
        expect(hypot2(-133525.1234130859, -144153.6435546875)).toBe(196492.31927119117); expect(piecewise([{
            position: 0, value: 1
        }, {
            position: 1, value: 0
        }], true)).toBe(1 / 3); });
    it('preserves inclusive block boundaries, cylinder direction, clipping and unknown shape behavior', () => {
        expect(blockCounts({
            x: 0, y: 0, z: 0
        }, {
            class: 'box', size: {
                x: 64000, y: 64000, z: 64000
            }
        })).toEqual([27, 27]);
        expect(blockCounts({
            x: 0, y: 0, z: 0
        }, {
            class: 'sphere', size: {
                r: 1
            }
        })).toEqual([1, 1]);
        expect(blockCounts({
            x: 0, y: 0, z: 0
        }, {
            class: 'cylinder', size: {
                r: 1, linear: 64000
            }
        })).toEqual([2, 2]);
        expect(blockCounts({
            x: 2000000, y: 0, z: 0
        }, {
            class: 'sphere', size: {
                r: 1
            }
        })).toEqual([1, 0]);
        expect(blockCounts({
            x: 0, y: 0, z: 0
        }, {
            class: 'unknown', size: {}
        })).toEqual([1, 0]);
        expect(solidVolume({
            class: 'box', size: {
                x: 10, y: 10, z: 10
            }
        })).toEqual([1, 1]);
    });
    it('samples curved splines rather than using their control polygon', () => { const spline = [{
            x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1, outlength: 100
        }, {
            x: 100, y: 0, z: 0, tx: 0, ty: 0, tz: -1, inlength: 100
        }]; expect(sampleSpline(spline)).toHaveLength(17); expect(splineLength(spline)).toBeGreaterThan(100); });
    it('keeps region reference conventions and dual-template vertical tie breaking', () => { expect(regionSector('C2S3_region')).toBe('Cluster_02_Sector003_macro'); expect(regionSector('region7_cluster_2_sector_3', true)).toBe('Cluster_02_Sector003_macro'); expect(zonePath('Zone2_Cluster_1_Sector3_macro')).toBe('Zone002_Cluster_01_Sector003_macro'); expect(template({
        a: {
            x: 0, z: -1
        }, b: {
            x: 0, z: 1
        }
    }).kind).toBe('dual_b'); });
});
