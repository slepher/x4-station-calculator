import { child, children, descendants, attr, attrs, num, rgb, type MapNode } from './xml';
import { roundEven, roundDecimal, significant, yieldRound, gas, splineLength, volume, solidVolume, blockCounts } from './calculator';
export function modernDefinitions(root: MapNode): Record<string, any> {
    const result: Record<string, any> = {}, boundaries = children(child(root, 'boundaries'), 'boundary'), speeds = children(child(root, 'gatherspeeds'), 'gatherspeed');
    const finish = (row: any, n: MapNode) => {
        const effect = attr(n, 'scaneffect').trim(), intensity = num(attr(n, 'scaneffectintensity')), color = attr(n, 'scaneffectcolor').trim();
        if (effect)
            row.scaneffect = effect;
        if (intensity > 0)
            row.scaneffectintensity = intensity;
        if (color)
            row.scaneffectcolor = color;
        result[row.id] = row;
    };
    for (const y of children(child(root, 'yields'), 'yield'))
        for (const w of children(y, 'ware'))
            for (const b of boundaries)
                for (const s of speeds) {
                    const bid = attr(b, 'id').trim(), id = attr(y, 'id').trim(), ware = attr(w, 'id').trim(), sid = attr(s, 'id').trim(), sizeNode = child(b, 'size');
                    if (!bid.startsWith('sphere_') || !sizeNode || !id || !ware || !sid)
                        continue;
                    const amount = num(attr(w, 'yield')), delay = num(attr(w, 'respawndelay'));
                    const row: any = {
                        id: `${bid}_${ware}_${id}_${sid}`, ware, tag: attr(y, 'tag', id).trim(), size: bid.split('_').slice(1).join('_').toLowerCase(), radius: num(attr(sizeNode, 'r')), yield: amount, respawnDelay: delay, rating: num(attr(s, 'rating')), sustainableYieldPerHour: delay > 0 ? amount / delay * 60 : 0
                    };
                    row[['hydrogen', 'helium', 'methane'].includes(ware) ? 'gatherspeedfactor' : 'objectyieldfactor'] = num(attr(s, 'factor'));
                    finish(row, y);
                }
    if (Object.keys(result).length)
        return result;
    for (const n of children(child(root, 'definitions'), 'definition')) {
        const id = attr(n, 'id').trim();
        if (!id)
            continue;
        const amount = num(attr(n, 'yield')), delay = num(attr(n, 'respawndelay')), b = children(n, 'boundary').find(n => attr(n, 'class') === 'sphere');
        const row: any = {
            id, ware: attr(n, 'ware').trim(), tag: attr(n, 'tag').trim(), size: ['tiny', 'small', 'medium', 'large'].find(s => id.includes(`_${s}_`)) ?? '', radius: num(attr(child(b, 'size'), 'r')), yield: amount, respawnDelay: delay, rating: num(attr(n, 'rating')), sustainableYieldPerHour: delay > 0 ? amount / delay * 60 : 0
        };
        for (const k of ['objectyieldfactor', 'gatherspeedfactor'])
            if (k in n.attrs)
                row[k] = num(n.attrs[k]);
        finish(row, n);
    }
    return result;
}
export function sectorResourceareas(root: MapNode): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    for (const d of children(root, 'dataset')) {
        const id = attr(d, 'macro').trim().toLowerCase();
        if (!/^cluster_\d+_sector\d+_macro$/i.test(id))
            continue;
        const areas = children(child(child(d, 'properties'), 'resourceareas'), 'resourcearea').filter(a => attr(a, 'ref').trim()).map(a => { const amount = num(attr(a, 'amount')); return {
            ref: attr(a, 'ref').trim(), amount: amount > 0 ? Math.trunc(amount) : 1
        }; });
        if (areas.length)
            result[id] = areas;
    }
    return result;
}
export function legacyYields(root: MapNode): any[] { return children(root, 'resource').filter(n => attr(n, 'ware').trim()).map(n => ({
    ware: attr(n, 'ware').trim(), color: rgb(n, 'effect_'), yields: children(n, 'yield').filter(n => 'name' in n.attrs).map(attrs)
})).sort((a, b) => a.ware < b.ware ? -1 : a.ware > b.ware ? 1 : 0); }
export function piecewise(steps: any[], weighted = false): number {
    if (!steps.length)
        return 1;
    const points = steps.map(p => ({
        position: Math.min(1, Math.max(0, p.position)), value: p.value
    })).sort((a, b) => a.position - b.position);
    if (points[0]!.position > 0)
        points.unshift({
            position: 0, value: points[0]!.value
        });
    if (points.at(-1)!.position < 1)
        points.push({
            position: 1, value: points.at(-1)!.value
        });
    let total = 0, weight = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!, b = points[i]!, width = b.position - a.position;
        if (width <= 0)
            continue;
        if (!weighted) {
            total += (a.value + b.value) * width * 0.5;
            weight += width;
        }
        else {
            const mid = (a.position + b.position) * 0.5, ymid = a.value + (b.value - a.value) * ((mid - a.position) / width);
            total += (a.value * a.position + 4 * ymid * mid + b.value * b.position) * width / 6;
            weight += (a.position + 4 * mid + b.position) * width / 6;
        }
    }
    return weight <= 0 ? 1 : total / weight;
}
export function boundary(n: MapNode | undefined): any {
    if (n?.tag === 'boundaries')
        n = children(n, 'boundary').find(n => 'class' in n.attrs);
    if (!n)
        return null;
    const b: any = {
        class: attr(n, 'class').trim()
    }, size = child(n, 'size'), spline = children(n, 'splineposition').map(attrs);
    if (size)
        b.size = attrs(size);
    if (spline.length) {
        b.spline = spline;
        if (b.class === 'splinetube') {
            if (!b.size)
                b.size = {};
            b.size.linear = splineLength(spline);
        }
    }
    return b;
}
export function falloff(n: MapNode | undefined): any {
    if (!n)
        return null;
    const curve = (key: string) => children(child(n, key), 'step').map(n => ({
        position: num(attr(n, 'position')), value: num(attr(n, 'value'))
    })).sort((a, b) => a.position - b.position);
    const lateral = curve('lateral'), radial = curve('radial'), l = piecewise(lateral), r = piecewise(radial), r2 = piecewise(radial, true);
    return {
        lateral, radial, lateral_factor: l, radial_factor: r, radial_factor_2: r2, effective_factor: l * r, effective_factor_2: l * r2
    };
}
export function legacyRegions(root: MapNode, groupsRoot: MapNode, yields: any[]): any[] {
    const infos: Record<string, any[]> = {};
    for (const r of yields)
        infos[r.ware] = r.yields;
    const groups: Record<string, any> = {};
    for (const g of descendants(groupsRoot, 'group'))
        groups[attr(g, 'name')] = g;
    const rows: any[] = [];
    for (const n of children(root, 'region')) {
        const id = attr(n, 'name').trim();
        if (!id)
            continue;
        const b = boundary(child(n, 'boundary') ?? child(n, 'boundaries')), f = falloff(child(n, 'falloff')), vol = roundEven(volume(b) / 1e9);
        if (b?.class === 'splinetube' && b.size && 'linear' in b.size)
            b.size.linear = roundEven(b.size.linear);
        const resources: any[] = [];
        for (const r of children(child(n, 'resources'), 'resource')) {
            const ware = attr(r, 'ware').trim(), name = attr(r, 'yield').trim(), entries = infos[ware];
            if (!ware || !name || !entries?.length)
                continue;
            let info = entries[0];
            if (name && entries.some(e => e.name === name))
                info = entries.find(e => e.name === name);
            const density = num(info.resourcedensity);
            if (density > 0)
                resources.push({
                    ware, resourcedensity: density, delay: num(info.replenishtime, 60), gatherfactor: gas(ware) ? num(info.gatherspeedfactor, 1) : 1, yield_name: name
                });
        }
        if (!resources.length)
            continue;
        const fields: any[] = [];
        for (const field of child(n, 'fields')?.children ?? []) {
            if (!['asteroid', 'debris', 'nebula'].includes(field.tag))
                continue;
            const out: any = {
                tag: field.tag
            };
            if (field.tag === 'nebula') {
                for (const [k, v] of Object.entries(field.attrs))
                    out[k] = ['localred', 'localgreen', 'localblue', 'uniformred', 'uniformgreen', 'uniformblue'].includes(k) ? Math.trunc(num(v)) : ['localdensity', 'uniformdensity'].includes(k) ? num(v) : k === 'backgroundfog' ? v.toLowerCase() === 'true' : v;
            }
            else {
                let groupref = attr(field, 'groupref');
                if (!groupref)
                    groupref = attr(field, 'ref', field.tag);
                Object.assign(out, {
                    groupref, densityfactor: num(attr(field, 'densityfactor'), 1), noisescale: num(attr(field, 'noisescale'), 15000), seed: attr(field, 'seed'), minnoisevalue: num(attr(field, 'minnoisevalue')), maxnoisevalue: num(attr(field, 'maxnoisevalue'), 1)
                });
                const g = groups[groupref];
                if (g)
                    Object.assign(out, {
                        resource: attr(g, 'resource'), yield: num(attr(g, 'yield'), 1), yieldvariation: num(attr(g, 'yieldvariation'))
                    });
            }
            fields.push(out);
        }
        rows.push({
            id, boundary: b, falloff: f, volume_km3: vol, resources, density: num(attr(n, 'density'), 1), fields
        });
    }
    return rows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export function areaForRegion(template: any, link: any, sector: any): any {
    const offset = link.offset, pos = {
        x: offset.x - sector.raw_local_pos.x, y: offset.y - num(sector.raw_local_pos.y), z: offset.z - sector.raw_local_pos.z
    }, f = template.falloff, l = num(f?.lateral_factor, 1), r = num(f?.radial_factor, 1), r2 = num(f?.radial_factor_2, r), factor = l * r, b = template.boundary, [total, blocks] = blockCounts(pos, {
        ...b
    }), [tv, ev] = solidVolume(b);
    const area: any = {
        ref: template.id, amount: 1, position: pos, cluster_position: {
            ...offset
        }, lateral_factor: roundDecimal(l, 4), radial_factor: roundDecimal(r, 4), falloff_factor: roundDecimal(factor, 4), radial_factor_2: roundDecimal(r2, 4), effective_factor_2: roundDecimal(num(f?.effective_factor_2, l * r2), 4), boundary: {
            class: b.class
        }, total_volume_km3: template.volume_km3, total_blocks: total, blocks
    };
    if (link.rotation !== null)
        area.rotation = link.rotation;
    if (b.size)
        area.boundary.size = b.size;
    if (template.resources.some((r: any) => !gas(r.ware)))
        area.volume_km3 = roundEven(ev / 1e9);
    area.resources = template.resources.filter((res: any) => res.ware && res.resourcedensity > 0).map((res: any) => {
        const isGas = gas(res.ware);
        if (isGas)
            blockCounts(pos, b);
        const totalBase = isGas ? total : tv / 1e9, base = isGas ? blocks : ev / 1e9, totalYield = totalBase * factor * res.resourcedensity, effectiveYield = base * factor * res.resourcedensity, totalRespawn = res.delay > 0 ? totalYield * 60 / res.delay : 0, respawn = res.delay > 0 ? effectiveYield * 60 / res.delay : 0, vol = isGas ? blocks * 64000 ** 3 / 1e9 : ev / 1e9;
        return {
            ware: res.ware, resourcedensity: res.resourcedensity, yield_name: res.yield_name, total_yield: yieldRound(totalYield), total_respawn: yieldRound(totalRespawn), yield: yieldRound(effectiveYield), respawn: yieldRound(respawn), delay: res.delay, gatherfactor: res.gatherfactor, density: significant(vol > 0 ? effectiveYield / vol : 0), respawn_density: significant(vol > 0 ? respawn / vol : 0)
        };
    });
    return area;
}
