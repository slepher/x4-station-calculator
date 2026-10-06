import { num } from './xml';
export { roundHalfEven as roundEven } from '../shared-ts/math';
import { roundHalfEven as roundEven } from '../shared-ts/math';
export { roundHalfEven as roundDecimal } from '../shared-ts/math';
import { roundHalfEven as roundDecimal } from '../shared-ts/math';
export function significant(v: number): number {
    if (v === 0)
        return 0;
    const d = Math.floor(Math.log10(Math.abs(v))) + 1;
    return roundDecimal(v, d > 5 ? 0 : 5 - d);
}
export function yieldRound(v: number): number { return v >= 100000 ? roundEven(v) : roundDecimal(v, Math.trunc(v) > 0 ? 5 - String(Math.trunc(v)).length : 5); }
export const gas = (ware: string): boolean => ['helium', 'hydrogen', 'methane', 'bogas'].includes(ware);
const point = (p: any): any => ({
    x: num(p.x), y: num(p.y), z: num(p.z)
});
const distance = (a: any, b: any): number => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
export function sampleSpline(spline: any[], samples = 16): any[] {
    if (spline.length < 2)
        return [...spline];
    const result: any[] = [];
    for (let i = 0; i < spline.length - 1; i++) {
        const l = spline[i], r = spline[i + 1], p0 = point(l), p3 = point(r), out = num(l.outlength), inn = num(r.inlength);
        if (i === 0)
            result.push(p0);
        if ((out <= 0 && inn <= 0) || (!['tx', 'ty', 'tz'].some(k => k in l) && !['tx', 'ty', 'tz'].some(k => k in r))) {
            result.push(p3);
            continue;
        }
        const p1: any = {}, p2: any = {};
        for (const k of ['x', 'y', 'z']) {
            p1[k] = p0[k] + num(l['t' + k]) * out;
            p2[k] = p3[k] - num(r['t' + k]) * inn;
        }
        for (let step = 1; step <= samples; step++) {
            const t = step / samples, o = 1 - t, o2 = o * o, o3 = o2 * o, t2 = t * t, t3 = t2 * t;
            const p: any = {};
            for (const k of ['x', 'y', 'z'])
                p[k] = o3 * p0[k] + 3 * o2 * t * p1[k] + 3 * o * t2 * p2[k] + t3 * p3[k];
            result.push(p);
        }
    }
    return result;
}
export function splineLength(spline: any[]): number {
    let total = 0;
    for (let i = 0; i < spline.length - 1; i++) {
        const points = sampleSpline([spline[i], spline[i + 1]], 32);
        for (let j = 1; j < points.length; j++)
            total += distance(points[j - 1], points[j]);
    }
    return total;
}
export function volume(b: any): number {
    if (!b)
        return 1;
    const r = num(b.size?.r);
    if (b.class === 'sphere')
        return (4 / 3) * Math.PI * r ** 3;
    if (b.class === 'cylinder')
        return Math.PI * r ** 2 * num(b.size?.linear);
    if (b.class === 'splinetube')
        return Math.PI * r ** 2 * splineLength(b.spline ?? []);
    return 1;
}
export function solidVolume(b: any): [
    number,
    number
] {
    const r = num(b.size?.r), c = Math.min(r, 256000);
    if (b.class === 'sphere')
        return [volume(b), Math.PI * c ** 2 * 192000];
    if (b.class === 'cylinder')
        return [volume(b), Math.PI * c ** 2 * Math.min(num(b.size?.linear), 192000)];
    if (b.class === 'splinetube')
        return [volume(b), Math.PI * c ** 2 * Math.min(splineLength(b.spline ?? []), 1000000)];
    return [1, 1];
}
function pointSegment(p: number[], a: number[], b: number[]): number { const ab = b.map((v, i) => v - a[i]!), ap = p.map((v, i) => v - a[i]!), length = ab.reduce((s, v) => s + v * v, 0); const t = length <= 1e-9 ? 0 : Math.max(0, Math.min(1, ap.reduce((s, v, i) => s + v * ab[i]!, 0) / length)); return p.reduce((s, v, i) => s + (v - (a[i]! + t * ab[i]!)) ** 2, 0); }
function segmentRect(a: number[], b: number[], lo: number[], hi: number[]): number {
    const inside = (p: number[]) => p.every((v, i) => v >= lo[i]! && v <= hi[i]!);
    if (inside(a) || inside(b))
        return 0;
    const corners = [[lo[0]!, lo[1]!], [lo[0]!, hi[1]!], [hi[0]!, lo[1]!], [hi[0]!, hi[1]!]];
    const orient = (p: number[], q: number[], r: number[]) => (q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!);
    const on = (p: number[], q: number[], r: number[]) => r.every((v, i) => v >= Math.min(p[i]!, q[i]!) - 1e-9 && v <= Math.max(p[i]!, q[i]!) + 1e-9);
    for (const [c, d] of [[corners[0]!, corners[2]!], [corners[2]!, corners[3]!], [corners[3]!, corners[1]!], [corners[1]!, corners[0]!]]) {
        const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
        if ((o1 * o2 < 0 && o3 * o4 < 0) || (Math.abs(o1) <= 1e-9 && on(a, b, c)) || (Math.abs(o2) <= 1e-9 && on(a, b, d)) || (Math.abs(o3) <= 1e-9 && on(c, d, a)) || (Math.abs(o4) <= 1e-9 && on(c, d, b)))
            return 0;
    }
    const rectDist = (p: number[]) => p.reduce((s, v, i) => s + (v < lo[i]! ? lo[i]! - v : v > hi[i]! ? v - hi[i]! : 0) ** 2, 0);
    return Math.min(rectDist(a), rectDist(b), ...corners.map(p => pointSegment(p, a, b)));
}
export function blockCounts(pos: any, b: any): [
    number,
    number
] {
    const r = num(b.size?.r), linear = num(b.size?.linear), half = 32000, step = 64000, p = point(pos), keys = ['x', 'y', 'z'];
    let min: number[], max: number[];
    let sampled: any[] = [];
    if (b.class === 'sphere') {
        min = keys.map(k => p[k] - r - half);
        max = keys.map(k => p[k] + r + half);
    }
    else if (b.class === 'cylinder') {
        min = [p.x - r - half, p.y - half, p.z - r - half];
        max = [p.x + r + half, p.y + linear + half, p.z + r + half];
    }
    else if (b.class === 'box') {
        min = keys.map(k => p[k] - num(b.size?.[k]) / 2 - half);
        max = keys.map(k => p[k] + num(b.size?.[k]) / 2 + half);
    }
    else if (b.class === 'splinetube' && (b.spline ?? []).length >= 2) {
        sampled = sampleSpline(b.spline);
        b._sampled_spline = sampled;
        b._sampled_spline_segments = sampled.slice(1).map((q: any, i: number) => { const a = sampled[i]; return {
            ax: a.x, ay: a.y, az: a.z, bx: q.x, by: q.y, bz: q.z, min_x: Math.min(a.x, q.x) - r, max_x: Math.max(a.x, q.x) + r, min_y: Math.min(a.y, q.y) - r, max_y: Math.max(a.y, q.y) + r, min_z: Math.min(a.z, q.z) - r, max_z: Math.max(a.z, q.z) + r
        }; });
        min = [Math.min(...b.spline.map((q: any) => num(q.x))) - r - half, p.y - r - half, Math.min(...b.spline.map((q: any) => num(q.z))) - r - half];
        max = [Math.max(...b.spline.map((q: any) => num(q.x))) + r + half, p.y + r + half, Math.max(...b.spline.map((q: any) => num(q.z))) + r + half];
    }
    else
        return [1, 0];
    const low = min.map((v, i) => Math.max(Math.floor(v / step) * step, i === 1 ? -256000 : -960000)), high = max.map((v, i) => Math.min(Math.ceil(v / step) * step, i === 1 ? 256000 : 1024000));
    let total = 0, effective = 0;
    for (let x = low[0]!; x <= high[0]!; x += step)
        for (let y = low[1]!; y <= high[1]!; y += step)
            for (let z = low[2]!; z <= high[2]!; z += step) {
                const center = [x, y, z], lo = center.map(v => v - half), hi = center.map(v => v + half);
                let hit = false;
                if (b.class === 'sphere')
                    hit = keys.reduce((s, k, i) => s + (p[k] - Math.min(Math.max(p[k], lo[i]!), hi[i]!)) ** 2, 0) <= r * r;
                if (b.class === 'cylinder')
                    hit = hi[1]! >= p.y && lo[1]! <= p.y + linear && (p.x - Math.min(Math.max(p.x, lo[0]!), hi[0]!)) ** 2 + (p.z - Math.min(Math.max(p.z, lo[2]!), hi[2]!)) ** 2 <= r * r;
                if (b.class === 'box')
                    hit = keys.every((k, i) => hi[i]! >= p[k] - num(b.size?.[k]) / 2 && lo[i]! <= p[k] + num(b.size?.[k]) / 2);
                if (b.class === 'splinetube' && r > 0) {
                    const segments = sampled.slice(1).map((q, i) => [sampled[i], q]);
                    const broad = (r + Math.sqrt(3) * half) ** 2;
                    if (Math.min(...segments.map(([a, c]) => pointSegment(center, keys.map(k => a[k]), keys.map(k => c[k])))) <= broad)
                        hit = segments.some(([a, c]) => {
                            if (keys.some((k, i) => Math.max(a[k], c[k]) + r < lo[i]! || Math.min(a[k], c[k]) - r > hi[i]!))
                                return false;
                            const gap = Math.max(0, lo[1]! - Math.max(a.y, c.y), Math.min(a.y, c.y) - hi[1]!);
                            return segmentRect([a.x, a.z], [c.x, c.z], [lo[0]!, lo[2]!], [hi[0]!, hi[2]!]) + gap * gap <= r * r;
                        });
                }
                if (hit) {
                    total++;
                    if (Math.abs(x) <= 256000 && Math.abs(z) <= 256000 && Math.abs(y) <= 64000)
                        effective++;
                }
            }
    return [Math.max(1, total), effective];
}
// Python hypot rounds the exact sum of squares; JS hypot and sqrt(x*x+y*y)
// differ by one ULP for real map coordinates. Compare adjacent midpoints exactly.
export function hypot2(x: number, y: number): number {
    const view = new DataView(new ArrayBuffer(8));
    const dyadic = (v: number): [
        bigint,
        number
    ] => { view.setFloat64(0, Math.abs(v)); const bits = view.getBigUint64(0), exp = Number((bits >> 52n) & 2047n); return [(bits & ((1n << 52n) - 1n)) + (exp === 0 ? 0n : 1n << 52n), exp === 0 ? -1074 : exp - 1075]; };
    const [xn, xe] = dyadic(x), [yn, ye] = dyadic(y), exponent = Math.min(2 * xe, 2 * ye), sum = (xn * xn << BigInt(2 * xe - exponent)) + (yn * yn << BigInt(2 * ye - exponent));
    let h = Math.sqrt(x * x + y * y);
    if (h === 0 || !Number.isFinite(h))
        return h;
    const compareMidpoint = (a: number, b: number): number => { const [an, ae] = dyadic(a), [bn, be] = dyadic(b), e = Math.min(ae, be), mid = (an << BigInt(ae - e)) + (bn << BigInt(be - e)), squared = mid * mid, midExponent = 2 * (e - 1), common = Math.min(exponent, midExponent), difference = (sum << BigInt(exponent - common)) - (squared << BigInt(midExponent - common)); return difference < 0 ? -1 : difference > 0 ? 1 : 0; };
    for (let i = 0; i < 3; i++) {
        view.setFloat64(0, h);
        const bits = view.getBigUint64(0);
        view.setBigUint64(0, bits - 1n);
        const lower = view.getFloat64(0);
        view.setBigUint64(0, bits + 1n);
        const upper = view.getFloat64(0), lo = compareMidpoint(lower, h), hi = compareMidpoint(h, upper), odd = bits % 2n !== 0n;
        if (lo < 0 || (lo === 0 && odd)) {
            h = lower;
            continue;
        }
        if (hi > 0 || (hi === 0 && odd)) {
            h = upper;
            continue;
        }
        break;
    }
    return h;
}
