import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { child, children, descendants, attr, num, tags, position, quaternion, add, readMapXml, type MapNode } from './xml';
import { axial, clusterId, sectorId, regionSector, zonePath, template } from './sector';
import { roundEven, hypot2 } from './calculator';
export const OWNER_COLORS: Record<string, string> = {
    teladi: '#c6c000', argon: '#0077cc', antigone: '#00e5ff', boron: '#63b3ff', terran: '#2f7fd3', pioneers: '#7ec8ff', split: '#c00000', freesplit: '#b26b00', holyorder: '#b000b8', paranid: '#d100d1', hatikvah: '#7a4ea3', kaori: '#8a6ad9', loanshark: '#c58f00', riptide: '#c58f00', xenon: '#9a0000', neutral: '#4b5563', ownerless: '#4b5563', scaleplate: '#4b5563', scavenger: '#4b5563'
};
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const typePriority: Record<string, number> = {
    shipyard: 10, equipmentdock: 9, refinery: 8, factory: 7, tradingstation: 6, miningstation: 5, researchstation: 4, militaryoutpost: 3, piratebase: 2
};
const shcon = /^tzoneCluster_(\d+)_Sector(\d+)SHCon(\d+)_GateZone_macro$/i;
const sectorRE = /^Cluster_(\d+)_Sector(\d+)_macro$/i;
function connections(n: MapNode, ref?: string): MapNode[] { return children(child(n, 'connections'), 'connection').filter(c => ref === undefined || attr(c, 'ref') === ref); }
function geometry(root: MapNode, zone: boolean): Record<string, any> {
    const result: Record<string, any> = {};
    for (const n of children(root, 'macro').filter(n => attr(n, 'class') === 'highway')) {
        const name = attr(n, 'name');
        if (!name)
            continue;
        const b = children(child(child(n, 'properties'), 'boundaries'), 'boundary').find(n => attr(n, 'class') === 'splinetube'), row: any = {
            entry_pos: position(connections(n, 'entrypoint')[0]), exit_pos: position(connections(n, 'exitpoint')[0]), spline: children(b, 'splineposition').map(n => ({
                x: num(attr(n, 'x')), z: num(attr(n, 'z')), tx: num(attr(n, 'tx')), tz: num(attr(n, 'tz'))
            }))
        };
        if (zone)
            row.radius = num(attr(child(b, 'size'), 'r'));
        result[name] = row;
    }
    return result;
}
export function clusterDlcTags(mapDir: string, order: string[]): Record<string, string> {
    const result: Record<string, string> = {}, base = join(mapDir, 'clusters', 'base.xml');
    if (!existsSync(base))
        return result;
    const root = readMapXml(base);
    for (const [path, tag] of [[base, 'base'], ...order.map(id => [join(mapDir, 'clusters', `${id.replace(/^ego_/, '')}.xml`), id.replace(/^ego_/, '')])]) {
        if (!existsSync(path!))
            continue;
        const n = readMapXml(path!);
        if (n.tag !== root.tag)
            continue;
        for (const m of children(n, 'macro')) {
            const name = attr(m, 'name');
            if (attr(m, 'class') === 'cluster' && name && !(name in result))
                result[name] = tag!;
        }
    }
    return result;
}
export function generateMap(input: {
    roots: Record<string, MapNode>;
    mapDir: string;
    dlcOrder: string[];
    registry: {
        getName: (id: string, language?: string) => string;
        collect: (id: string) => unknown;
    };
    factions: any[];
}): any {
    const { roots, registry } = input, names: Record<string, string> = {}, sectorAreas: Record<string, any> = {}, clusterAreas: Record<string, any> = {};
    for (const d of children(roots.mapdefaults, 'dataset')) {
        const macro = attr(d, 'macro').trim().toLowerCase();
        if (!macro)
            continue;
        const props = child(d, 'properties'), name = attr(child(props, 'identification'), 'name');
        if (name) {
            names[macro] = name;
        }
        const a = child(props, 'area');
        if (a) {
            const area = {
                sunlight: num(attr(a, 'sunlight')), economy: num(attr(a, 'economy')), security: num(attr(a, 'security')), tags: tags(attr(a, 'tags'))
            };
            if (sectorRE.test(macro))
                sectorAreas[macro] = area;
            else if (/^Cluster_\d+_macro$/i.test(macro))
                clusterAreas[macro] = area;
        }
    }
    for (const name of Object.values(names)) registry.collect(name);
    const dlc = clusterDlcTags(input.mapDir, input.dlcOrder), clusters: Record<string, any> = {}, sectors: Record<string, any> = {}, zones: Record<string, any> = {}, gates: Record<string, any> = {}, links: Record<string, any> = {}, highways: Record<string, any> = {}, offsets: Record<string, any> = {}, zoneOffsets: Record<string, any> = {}, regionLinks: Record<string, any[]> = {};
    const makeCluster = (id: string, pos: any) => ({
        id, nameId: names[id.toLowerCase()] ?? '', name: registry.getName(names[id.toLowerCase()] ?? '', 'en'), dlc_tag: dlc[id] ?? 'base', owner: 'neutral', owner_color: OWNER_COLORS.neutral, raw_pos: pos, normalized: axial(pos), sector_ids: [], sector_link_ids: []
    });
    for (const m of children(roots.galaxy, 'macro').filter(n => attr(n, 'class') === 'galaxy'))
        for (const c of connections(m, 'clusters')) {
            const id = attr(child(c, 'macro'), 'ref');
            if (id)
                clusters[id] = makeCluster(id, position(c));
        }
    const zoneGeometry = geometry(roots.zonehighways!, true);
    for (const m of children(roots.clusters, 'macro').filter(n => attr(n, 'class') === 'cluster')) {
        const id = attr(m, 'name');
        if (!id)
            continue;
        if (!clusters[id])
            clusters[id] = makeCluster(id, {
                x: 0, z: 0
            });
        offsets[id] = {};
        for (const c of connections(m, 'sectors')) {
            const sid = attr(child(c, 'macro'), 'ref');
            if (!sid)
                continue;
            offsets[id][sid] = position(c);
            if (!clusters[id].sector_ids.includes(sid))
                clusters[id].sector_ids.push(sid);
        }
        for (const c of connections(m, 'regions')) {
            const macro = child(c, 'macro');
            let sid = regionSector(attr(c, 'name').trim());
            const ref = attr(child(child(macro, 'properties'), 'region'), 'ref');
            if (sid === null || !clusters[id].sector_ids.includes(sid)) {
                const fromRef = regionSector(ref, true);
                if (fromRef && clusters[id].sector_ids.includes(fromRef))
                    sid = fromRef;
            }
            if (sid === null || !macro)
                continue;
            const name = attr(macro, 'name').trim();
            if (!name)
                continue;
            (regionLinks[sid] ??= []).push({
                name, region_ref: ref, cluster_id: id, sector_id: sid, offset: position(c, true), rotation: quaternion(c)
            });
        }
        for (const c of connections(m, 'sechighways')) {
            const macro = child(c, 'macro'), hid = attr(macro, 'ref');
            if (!hid || !macro)
                continue;
            const endpoints = [...new Set(connections(macro).map(n => attr(child(n, 'macro'), 'ref')).filter(Boolean))];
            let pair: string[] | null = null;
            for (let i = 0; i < endpoints.length; i++) {
                const a = endpoints[i]!.match(shcon);
                if (!a)
                    continue;
                for (const right of endpoints.slice(i + 1)) {
                    const b = right.match(shcon);
                    if (b && sectorId(a[1]!, a[2]!) !== sectorId(b[1]!, b[2]!)) {
                        pair = [endpoints[i]!, right];
                        break;
                    }
                }
                if (pair)
                    break;
            }
            if (!pair)
                continue;
            links[hid] = {
                id: hid, cluster_id: id, zone_a_id: pair[0]!.toLowerCase(), zone_b_id: pair[1]!.toLowerCase()
            };
            if (!clusters[id].sector_link_ids.includes(hid))
                clusters[id].sector_link_ids.push(hid);
        }
    }
    for (const m of children(roots.sectors, 'macro').filter(n => attr(n, 'class') === 'sector')) {
        const id = attr(m, 'name');
        if (!id)
            continue;
        const match = id.match(sectorRE), cid = match ? clusterId(match[1]!) : null, local = offsets[cid ?? '']?.[id] ?? {
            x: 0, z: 0
        }, world = clusters[cid ?? '']?.raw_pos ?? {
            x: 0, z: 0
        };
        let area: any;
        if (id.toLowerCase() in sectorAreas)
            area = sectorAreas[id.toLowerCase()];
        else if (cid && cid.toLowerCase() in clusterAreas)
            area = clusterAreas[cid.toLowerCase()];
        else
            area = {
                sunlight: 0, economy: 0, security: 0, tags: []
            };
        sectors[id] = {
            id, cluster_id: cid, nameId: names[id.toLowerCase()] ?? '', name: registry.getName(names[id.toLowerCase()] ?? '', 'en'), area, raw_local_pos: local, raw_world_pos: add(world, local), zones: {}, cluster_gates: {}, highways: {}, stations: [], has_khaak_hive: false, khaak_hive_sources: []
        };
        zoneOffsets[id] = {};
        for (const c of connections(m, 'zones')) {
            const zid = attr(child(c, 'macro'), 'ref');
            if (zid) {
                zoneOffsets[id][zid] = position(c, true);
                sectors[id].zones[zid.toLowerCase()] = {
                    id: zid.toLowerCase()
                };
            }
        }
        for (const c of connections(m, 'zonehighways')) {
            const macro = child(c, 'macro'), hid = attr(macro, 'ref');
            if (!hid)
                continue;
            const g = zoneGeometry[hid] ?? {
                entry_pos: {
                    x: 0, z: 0
                }, exit_pos: {
                    x: 0, z: 0
                }, spline: [], radius: 0
            }, name = attr(c, 'name') || hid, offset = position(c), entry = child(macro ? connections(macro, 'entrypoint')[0] : undefined, 'macro'), exit = child(macro ? connections(macro, 'exitpoint')[0] : undefined, 'macro'), from = zonePath(attr(entry, 'path')), to = zonePath(attr(exit, 'path'));
            highways[`${id}:${name}`] = {
                sector_id: id, name, macro: hid, entry: add(offset, g.entry_pos), exit: add(offset, g.exit_pos), spline: g.spline.map((p: any) => add(offset, p)), from_zone_id: from ? from.toLowerCase() : null, to_zone_id: to ? to.toLowerCase() : null
            };
        }
    }
    for (const m of children(roots.zones, 'macro').filter(n => attr(n, 'class') === 'zone')) {
        const zid = attr(m, 'name');
        if (!zid)
            continue;
        const sid = Object.keys(zoneOffsets).find(id => zid in zoneOffsets[id]);
        if (!sid)
            continue;
        const key = zid.toLowerCase(), pos = zoneOffsets[sid][zid];
        zones[key] = {
            sector_id: sid, raw_local_pos: pos, kind: shcon.test(zid) ? 'shcon' : 'zone'
        };
        for (const c of connections(m)) {
            const name = attr(c, 'name') || attr(c, 'ref'), match = name.match(/^connection_ClusterGate(\d+)To(\d+)[a-z]?$/i);
            if (match)
                gates[`${key}:${name}`] = {
                    id: name, sector_id: sid, cluster_id: sectors[sid].cluster_id, target_cluster_id: clusterId(match[2]!), raw_local_pos: add(pos, position(c)), zone_id: key
                };
        }
    }
    const centers: Record<string, any> = {}, clusterSectors: Record<string, string[]> = {};
    for (const [id, s] of Object.entries(sectors))
        if (s.cluster_id)
            (clusterSectors[s.cluster_id] ??= []).push(id);
    for (const ids of Object.values(clusterSectors)) {
        const choice = template(Object.fromEntries(ids.map(id => [id, sectors[id].raw_local_pos])));
        for (const id of ids) {
            const zonePoints = Object.values(zones).filter(z => z.sector_id === id).map(z => z.raw_local_pos), points = [...Object.values(gates).filter(g => g.sector_id === id).map(g => g.raw_local_pos), ...zonePoints];
            const center = zonePoints.length ? {
                x: roundEven((Math.min(...zonePoints.map(p => p.x)) + Math.max(...zonePoints.map(p => p.x))) / 2 / 64000) * 64000, y: (Math.min(...zonePoints.map(p => num(p.y))) + Math.max(...zonePoints.map(p => num(p.y)))) / 2, z: roundEven((Math.min(...zonePoints.map(p => p.z)) + Math.max(...zonePoints.map(p => p.z))) / 2 / 64000) * 64000
            } : {
                x: 0, y: 0, z: 0
            };
            centers[id] = center;
            const maxExtent = points.length ? Math.max(...points.map(p => hypot2(p.x - center.x, p.z - center.z))) : 1, slot = choice.mapping[id] ?? 'single';
            sectors[id].raw_center_pos = center;
            sectors[id].normalized = {
                template_kind: choice.kind, slot, sector_radius_ratio: choice.radius, center_offset_ratio: choice.slots[slot] ?? {
                    x: 0, y: 0
                }, scale_per_radius: (Math.sqrt(3) / 2 * 0.8) / Math.max(1, maxExtent), scale_basis: {
                    hex_inner_ratio: Math.sqrt(3) / 2, extent_ratio: 0.8, max_extent: maxExtent
                }
            };
        }
    }
    const project = (sid: string, p: any, three = false): any => {
        const c = centers[sid], scale = sectors[sid].normalized.scale_per_radius;
        const row: any = {
            x: p.x, z: p.z, sx: (p.x - c.x) * scale, sy: -(p.z - c.z) * scale
        };
        if (three)
            row.y = num(p.y);
        return row;
    };
    for (const [key, z] of Object.entries(zones)) {
        z.raw_local_pos = project(z.sector_id, z.raw_local_pos, true);
        Object.assign(sectors[z.sector_id].zones[key], {
            kind: z.kind, raw_sector_pos: z.raw_local_pos
        });
    }
    for (const g of Object.values(gates)) {
        g.raw_local_pos = project(g.sector_id, g.raw_local_pos);
        sectors[g.sector_id].cluster_gates[g.id.toLowerCase()] = {
            id: g.id.toLowerCase(), target_cluster_id: g.target_cluster_id.toLowerCase(), raw_local_pos: g.raw_local_pos, zone_id: g.zone_id
        };
    }
    for (const h of Object.values(highways)) {
        sectors[h.sector_id].highways[h.name.toLowerCase()] = {
            macro: h.macro.toLowerCase(), entry: project(h.sector_id, h.entry), exit: project(h.sector_id, h.exit), spline: h.spline.map((p: any) => project(h.sector_id, p)), from_zone_id: h.from_zone_id, to_zone_id: h.to_zone_id
        };
    }
    const lowerSectors = Object.fromEntries(Object.keys(sectors).map(id => [id.toLowerCase(), id])), lowerZones = Object.fromEntries(Object.keys(zones).map(id => [id.toLowerCase(), id]));
    if (roots.god)
        for (const n of descendants(roots.god, 'station').filter(n => 'id' in n.attrs)) {
            const loc = child(n, 'location'), cls = attr(loc, 'class').trim().toLowerCase(), macro = attr(loc, 'macro').trim().toLowerCase();
            let sid: string | undefined, zid: string | null = null;
            if (cls === 'sector')
                sid = lowerSectors[macro];
            else if (cls === 'zone') {
                zid = lowerZones[macro] ?? null;
                if (zid)
                    sid = zones[zid].sector_id;
            }
            if (!sid || !sectors[sid])
                continue;
            const p = child(n, 'position'), base = {
                x: num(attr(p ?? n, 'x')), z: num(attr(p ?? n, 'z'))
            }, pos = zid ? add(zones[zid].raw_local_pos, base) : base;
            sectors[sid].stations.push({
                owner: attr(n, 'owner').trim(), race: attr(n, 'race').trim(), type: attr(n, 'type').trim(), tags: tags(attr(child(child(n, 'station'), 'select'), 'tags')), raw_sector_pos: project(sid, pos), zone_id: zid
            });
        }
    const factionMap = Object.fromEntries(input.factions.map(f => [f.id, f])), ownerColor = (owner: string) => {
        const f = factionMap[owner];
        if (f && f.color)
            return f.color;
        return OWNER_COLORS[owner] ?? '#4b5563';
    }, ties: any[] = [];
    for (const [id, s] of Object.entries(sectors)) {
        const candidates = s.stations.filter((st: any) => st.owner && st.owner !== 'player' && st.type !== 'piratebase' && (!(st.owner in factionMap) || factionMap[st.owner].claimspace)).map((st: any) => ({
            st, score: [typePriority[st.type] ?? 0, st.tags.filter((t: string) => ['shipyard', 'equipmentdock', 'refinery', 'factory'].includes(t)).length]
        }));
        candidates.sort((a: any, b: any) => b.score[0] - a.score[0] || b.score[1] - a.score[1]);
        s.owner = candidates.length ? candidates[0].st.owner : 'ownerless';
        s.owner_color = ownerColor(s.owner);
        if (candidates.length) {
            const best = candidates[0], top = candidates.filter((c: any) => c.score[0] === best.score[0] && c.score[1] === best.score[1]);
            if (top.length > 1)
                ties.push({
                    sector_id: id, score: {
                        type_priority: best.score[0], tag_priority: best.score[1]
                    }, candidates: top.map((c: any) => ({
                        owner: c.st.owner, type: c.st.type, tags: c.st.tags
                    })), chosen: {
                        owner: best.st.owner, type: best.st.type, tags: best.st.tags
                    }
                });
        }
    }
    for (const [id, c] of Object.entries(clusters)) {
        const owners = new Set(c.sector_ids.filter((sid: string) => sid in sectors).map((sid: string) => sectors[sid].owner));
        c.owner = owners.size === 1 && !owners.has('ownerless') ? [...owners][0] : 'ownerless';
        c.owner_color = ownerColor(c.owner);
        c.sectors = Object.keys(sectors).filter(sid => sectors[sid].cluster_id === id).map(sid => sid.toLowerCase()).sort(compare);
        c.sector_links = {};
        delete c.sector_ids;
        delete c.sector_link_ids;
    }
    const groups: Record<string, string[]> = {};
    for (const [id, l] of Object.entries(links)) {
        l.sector_a_id = zones[l.zone_a_id]?.sector_id ?? null;
        l.sector_b_id = zones[l.zone_b_id]?.sector_id ?? null;
        if (l.sector_a_id && l.sector_b_id) {
            const key = JSON.stringify([l.cluster_id, ...[l.sector_a_id, l.sector_b_id].sort(compare)]);
            (groups[key] ??= []).push(id);
        }
    }
    for (const ids of Object.values(groups))
        ids.sort(compare).forEach((id, i) => links[id].render = {
            lane_index: i, lane_count: ids.length
        });
    for (const l of Object.values(links))
        clusters[l.cluster_id].sector_links[l.id.toLowerCase()] = {
            id: l.id.toLowerCase(), sector_a_id: l.sector_a_id?.toLowerCase() ?? null, sector_b_id: l.sector_b_id?.toLowerCase() ?? null, from_zone_id: l.zone_a_id, to_zone_id: l.zone_b_id, render: l.render ?? {}
        };
    if (roots.khaak_activity) {
        const excluded = new Set(descendants(roots.khaak_activity, 'patch').flatMap(n => descendants(n, 'find_sector')));
        for (const n of descendants(roots.khaak_activity, 'find_sector')) {
            if (excluded.has(n))
                continue;
            const macro = attr(n, 'macro').trim();
            if (macro.startsWith('macro.')) {
                const sid = lowerSectors[macro.slice(6).toLowerCase()];
                if (sid)
                    sectors[sid].has_khaak_hive = true;
            }
        }
    }
    const adj: Record<string, Set<string>> = {};
    for (const g of Object.values(gates)) {
        (adj[g.cluster_id] ??= new Set()).add(g.target_cluster_id);
        (adj[g.target_cluster_id] ??= new Set()).add(g.cluster_id);
    }
    for (const [hiveId, hive] of Object.entries(sectors)) {
        if (!hive.has_khaak_hive)
            continue;
        const visited = new Map<string, number>([[hive.cluster_id, 0]]), queue = [hive.cluster_id];
        while (queue.length) {
            const cid = queue.shift()!, distance = visited.get(cid)!;
            if (distance >= 3)
                continue;
            for (const neighbor of adj[cid] ?? []) {
                if (!visited.has(neighbor)) {
                    visited.set(neighbor, distance + 1);
                    queue.push(neighbor);
                }
            }
        }
        for (const [id, s] of Object.entries(sectors))
            if (id !== hiveId && visited.has(s.cluster_id))
                s.khaak_hive_sources.push(hiveId.toLowerCase());
    }
    const payloadClusters: Record<string, any> = {}, payloadSectors: Record<string, any> = {};
    for (const [id, c] of Object.entries(clusters)) {
        c.id = id.toLowerCase();
        payloadClusters[id.toLowerCase()] = c;
    }
    for (const [id, s] of Object.entries(sectors)) {
        if (!s.cluster_id || !clusters[s.cluster_id])
            continue;
        s.id = id.toLowerCase();
        s.cluster_id = s.cluster_id.toLowerCase();
        s.khaak_hive_sources.sort(compare);
        payloadSectors[id.toLowerCase()] = s;
    }
    const nameIds = [...new Set([...Object.values(clusters), ...Object.values(sectors)].map(n => n.nameId).filter(Boolean))].sort(compare);
    return {
        payload: {
            clusters: payloadClusters, sectors: payloadSectors
        }, regionLinks, rawSectors: sectors, name_ids: nameIds, owner_resolution_ties: ties, stats: {
            clusters: Object.keys(clusters).length, sectors: Object.keys(sectors).length, zones: Object.keys(zones).length, cluster_links: Object.keys(gates).length, sector_links: Object.keys(links).length, highways: Object.keys(highways).length, stations: Object.values(sectors).reduce((sum, s) => sum + s.stations.length, 0)
        }, missing_name_ids: {
            clusters: Object.keys(clusters).filter(id => !clusters[id].nameId).sort(compare), sectors: Object.keys(sectors).filter(id => !sectors[id].nameId).sort(compare)
        }
    };
}
