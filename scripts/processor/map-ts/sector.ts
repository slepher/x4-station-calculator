import { roundEven, hypot2 } from './calculator';
export const sectorId = (c: string | number, s: string | number): string => `Cluster_${String(Number(c)).padStart(2, '0')}_Sector${String(Number(s)).padStart(3, '0')}_macro`;
export const clusterId = (c: string | number): string => `Cluster_${String(Number(c)).padStart(2, '0')}_macro`;
export function regionSector(name: string, ref = false): string | null {
    const patterns = ref ? [/region_cluster_(\d+)_sector_(\d+)/i, /region\d+_cluster_(\d+)_sector_(\d+)/i] : [/C(\d+)S(\d+)_/i, /Cluster(\d+)_Sector(\d+)_/i];
    for (const re of patterns) {
        const m = name.match(re);
        if (m)
            return sectorId(m[1]!, m[2]!);
    }
    return null;
}
export function zonePath(path: string): string | null { const m = path.match(/^Zone(\d+)_Cluster_(\d+)_Sector(\d+)_macro$/i); return m ? `Zone${String(Number(m[1])).padStart(3, '0')}_${sectorId(m[2]!, m[3]!)}` : null; }
const unit = (x: number, y: number): number[] => { const l = hypot2(x, y); return l <= 1e-6 ? [0, 0] : [x / l, y / l]; };
function permutations(values: string[]): string[][] {
    if (!values.length)
        return [[]];
    return values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map(p => [v, ...p]));
}
export function template(positions: Record<string, any>): any {
    const names = Object.keys(positions), count = names.length, s = Math.sqrt(3) / 4;
    if (count === 1)
        return {
            kind: 'single', mapping: {
                [names[0]!]: 'single'
            }, slots: {
                single: {
                    x: 0, y: 0
                }
            }, radius: 1
        };
    if (count !== 2 && count !== 3)
        return {
            kind: `multi_${count}`, mapping: {}, slots: {}, radius: count <= 1 ? 1 : 0.36
        };
    const avgX = Object.values(positions).reduce((sum, p) => sum + p.x, 0) / count, avgZ = Object.values(positions).reduce((sum, p) => sum + p.z, 0) / count, vectors = Object.fromEntries(names.map(n => [n, unit(positions[n].x - avgX, -(positions[n].z - avgZ))]));
    const variants = count === 2 ? [{
            upper: {
                x: -0.25, y: -s
            }, lower: {
                x: 0.25, y: s
            }
        }, {
            upper: {
                x: 0.25, y: -s
            }, lower: {
                x: -0.25, y: s
            }
        }] : [{
            left: {
                x: -0.5, y: 0
            }, center: {
                x: 0.25, y: s
            }, upper_right: {
                x: 0.25, y: -s
            }
        }, {
            upper_left: {
                x: -0.25, y: -s
            }, lower_left: {
                x: -0.25, y: s
            }, right: {
                x: 0.5, y: 0
            }
        }];
    let best: any = null;
    for (let variant = 0; variant < variants.length; variant++) {
        const slots: any = variants[variant], slotNames = Object.keys(slots);
        let bestAssignment: any = null;
        for (const perm of permutations(names)) {
            let score = 0;
            const mapping: any = {};
            for (let i = 0; i < slotNames.length; i++) {
                const slot = slotNames[i]!, name = perm[i]!, v = vectors[name]!, sv = unit(slots[slot].x, slots[slot].y);
                score += (v[0]! - sv[0]!) ** 2 + (v[1]! - sv[1]!) ** 2;
                mapping[name] = slot;
            }
            if (bestAssignment === null || score < bestAssignment.score)
                bestAssignment = {
                    score, mapping
                };
        }
        let score = 0;
        for (const [name, slot] of Object.entries(bestAssignment.mapping)) {
            const v = vectors[name]!, p = slots[slot as string], sv = unit(p.x, p.y);
            score += (v[0]! - sv[0]!) ** 2 + (v[1]! - sv[1]!) ** 2;
        }
        if (count === 2 && Math.max(...names.map(n => positions[n].x - avgX)) - Math.min(...names.map(n => positions[n].x - avgX)) <= 1e-6)
            score += variant === 1 ? 0 : 1e-3;
        if (best === null || score < best.score)
            best = {
                score, kind: `${count === 2 ? 'dual' : 'triple'}_${variant === 1 ? 'b' : 'a'}`, mapping: bestAssignment.mapping, slots, radius: 0.5
            };
    }
    return best;
}
export function axial(pos: any): any { const q = roundEven(pos.x / 15000000), r = roundEven((pos.z - 8660000 * q) / 17320000); return {
    axial: {
        q, r
    }, pixel_basis: {
        x: 1.5 * q, y: Math.sqrt(3) * (r + q / 2)
    }
}; }
