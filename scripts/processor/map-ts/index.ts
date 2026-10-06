import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { I18nRegistry } from '../shared-ts/i18n';
import { writeJson } from '../shared-ts/io';
import { readMapXml, children, child, attr, rgb, tags, type MapNode } from './xml';
import { generateMap } from './generator';
import { modernDefinitions, legacyYields, legacyRegions, areaForRegion } from './definitions';
export interface MapContext {
    config: Record<string, any>;
    rawPath: string;
    outputRoot: string;
    paths?: Record<string, string>;
    i18n?: I18nRegistry;
    factions?: any[];
}
export function buildMap(context: MapContext): any {
    const { config, rawPath } = context, paths = context.paths ?? {};
    const input = (key: string, defaultPath: string): string => key in paths ? paths[key]! : defaultPath;
    const mapDir = input('map-dir', join(rawPath, 'maps', 'xu_ep2_universe'));
    const roots: Record<string, MapNode> = {};
    for (const name of ['galaxy', 'clusters', 'sectors', 'zones', 'zonehighways', 'sechighways'])
        roots[name] = readMapXml(input(`${name}-xml`, join(mapDir, name, 'final.xml')));
    const resourceModel = Number(String(config.version ?? '').match(/^\d+/)?.[0] ?? 0) >= 9 ? 'resourceareas' : 'regions';
    for (const name of ['mapdefaults', 'regionyields', ...(resourceModel === 'regions' ? ['region_definitions', 'regionobjectgroups'] : [])]) {
        const key = name.replaceAll('_', '-') + '-xml';
        roots[name] = readMapXml(input(key, join(rawPath, 'libraries', name, 'final.xml')));
    }
    for (const name of ['god', 'khaak_activity']) {
        const key = name.replaceAll('_', '-') + '-xml', path = input(key, name === 'god' ? join(rawPath, 'libraries', name, 'final.xml') : join(rawPath, 'md', name, 'final.xml'));
        if (existsSync(path))
            roots[name] = readMapXml(path);
        else if (key in paths)
            throw new Error(`Missing map input ${key}: ${path}`);
    }
    let registry = context.i18n;
    if (registry === undefined) {
        registry = new I18nRegistry();
        registry.configure(rawPath, {
            '044': {
                iso: 'en', name: 'English'
            }
        });
    }
    let factions = context.factions;
    if (factions === undefined) {
        const colorsPath = input('colors-xml', join(rawPath, 'libraries', 'colors', 'final.xml')), factionsPath = input('factions-xml', join(rawPath, 'libraries', 'factions', 'final.xml'));
        const colors: Record<string, string> = {};
        if (existsSync(colorsPath)) {
            const root = readMapXml(colorsPath);
            for (const n of children(child(root, 'colors'), 'color')) {
                const id = attr(n, 'id').trim();
                if (id)
                    colors[id] = rgb(n);
            }
            for (const n of children(child(root, 'mappings'), 'mapping')) {
                const id = attr(n, 'id').trim(), ref = attr(n, 'ref').trim();
                if (id && ref && ref in colors)
                    colors[id] = colors[ref]!;
            }
        }
        else if ('colors-xml' in paths)
            throw new Error(`Missing map input colors-xml: ${colorsPath}`);
        factions = [];
        if (existsSync(factionsPath))
            for (const n of children(readMapXml(factionsPath), 'faction')) {
                const id = attr(n, 'id').trim();
                if (!id)
                    continue;
                const nameId = attr(n, 'name').trim(), ts = tags(attr(n, 'tags')), colorName = attr(child(n, 'color'), 'ref');
                factions.push({
                    id, name: nameId ? registry.getName(nameId, 'en') : '', nameId, tags: ts, color_name: colorName, color: colors[colorName] ?? '#4b5563', claimspace: ts.includes('claimspace')
                });
            }
        else if ('factions-xml' in paths)
            throw new Error(`Missing map input factions-xml: ${factionsPath}`);
        factions.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    }
    const result = generateMap({
        roots, mapDir, dlcOrder: config.dlc_order ?? [], registry, factions
    }), outputs: Record<string, any> = {
        maps: result.payload
    };
    if (context.factions === undefined)
        outputs.factions = factions;
    if (resourceModel === 'resourceareas')
        outputs.regionyield_definitions = Object.values(modernDefinitions(roots.regionyields!));
    else {
        const yields = legacyYields(roots.regionyields!), regions = legacyRegions(roots.region_definitions!, roots.regionobjectgroups!, yields), byId = Object.fromEntries(regions.map(r => [r.id, r])), groups: any[] = [];
        for (const [sid, links] of Object.entries(result.regionLinks) as [
            string,
            any[]
        ][]) {
            const sector = result.rawSectors[sid];
            if (!sector)
                continue;
            const areas = new Map<string, any>();
            for (const link of links) {
                const template = byId[link.region_ref];
                if (!template || !template.resources.length)
                    continue;
                const pos = {
                    x: link.offset.x - sector.raw_local_pos.x, y: link.offset.y - (sector.raw_local_pos.y ?? 0), z: link.offset.z - sector.raw_local_pos.z
                }, key = JSON.stringify([link.region_ref, pos.x, pos.y, pos.z]);
                const prior = areas.get(key);
                if (prior) {
                    prior.amount++;
                    continue;
                }
                if (!template.boundary)
                    continue;
                areas.set(key, areaForRegion(template, link, sector));
            }
            if (areas.size)
                groups.push({
                    cluster_id: links[0]!.cluster_id, sector_id: sid, areas: [...areas.values()]
                });
        }
        groups.sort((a, b) => a.cluster_id < b.cluster_id ? -1 : a.cluster_id > b.cluster_id ? 1 : a.sector_id < b.sector_id ? -1 : a.sector_id > b.sector_id ? 1 : 0);
        outputs.regionyields = yields;
        outputs.regions = regions;
        outputs.resourceareas = groups;
    }
    return { data: outputs, resource_model: resourceModel, factions_count: factions.length, name_ids: new Set(result.name_ids), stats: result.stats, missing_name_ids: result.missing_name_ids, owner_resolution_ties: result.owner_resolution_ties,
        ...(resourceModel === 'regions' ? { regions_count: outputs.regions.length, regionyields_count: outputs.regionyields.length } : {}) };
}
export function processMap(context: MapContext): any {
    const result = buildMap(context), paths = context.paths ?? {}, written: string[] = [];
    const input = (key: string, defaultPath: string): string => key in paths ? paths[key]! : defaultPath;
    for (const [name, data] of Object.entries(result.data)) {
        const key = name === 'maps' ? 'output' : name.replaceAll('_', '-') + '-output', path = input(key, join(context.outputRoot, 'data', `${name}.json`));
        writeJson(path, data);
        written.push(path);
    }
    return { ...result, outputs: written, files_written: written.length };
}
export { modernDefinitions, sectorResourceareas, legacyYields, legacyRegions } from './definitions';
