import { readFileSync } from 'node:fs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
export interface MapNode {
    tag: string;
    attrs: Record<string, string>;
    children: MapNode[];
}
const parser = new XMLParser({
    ignoreAttributes: false, preserveOrder: true, attributeNamePrefix: '', parseTagValue: false, parseAttributeValue: false, trimValues: false
});
export function parseMapXml(text: string): MapNode {
    const valid = XMLValidator.validate(text);
    if (valid !== true)
        throw new Error(`Invalid map XML: ${valid.err.msg}`);
    const convert = (rows: any[]): MapNode[] => rows.flatMap(row => Object.keys(row).filter(k => k !== ':@' && !k.startsWith('#') && !k.startsWith('?')).map(tag => ({
        tag, attrs: row[':@'] ?? {}, children: convert(row[tag])
    })));
    const roots = convert(parser.parse(text));
    if (roots.length !== 1)
        throw new Error('Map XML requires one root');
    return roots[0]!;
}
export function readMapXml(path: string): MapNode { return parseMapXml(readFileSync(path, 'utf8')); }
export function children(n: MapNode | undefined, tag: string): MapNode[] { return n ? n.children.filter(c => c.tag === tag) : []; }
export function child(n: MapNode | undefined, tag: string): MapNode | undefined { return children(n, tag)[0]; }
export function descendants(n: MapNode, tag: string): MapNode[] { return n.children.flatMap(c => [...(c.tag === tag ? [c] : []), ...descendants(c, tag)]); }
export function attr(n: MapNode | undefined, key: string, defaultValue = ''): string { return n?.attrs[key] === undefined ? defaultValue : n.attrs[key]!; }
export function num(value: any, defaultValue = 0): number {
    if (value === undefined || value === null || value === '')
        return defaultValue;
    const n = Number(value);
    return Number.isNaN(n) ? defaultValue : n;
}
export function coerce(value: string): string | number { const raw = value.trim(); return raw && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ? Number(raw) : raw; }
export function attrs(n: MapNode): Record<string, any> { return Object.fromEntries(Object.entries(n.attrs).map(([k, v]) => [k, coerce(v)])); }
export function tags(value: string): string[] { return value.trim().replace(/^\[(.*)\]$/, '$1').split(/\s+/).filter(Boolean); }
export function position(n: MapNode | undefined, three = false): any { const p = child(child(n, 'offset'), 'position'); return Object.fromEntries((three ? ['x', 'y', 'z'] : ['x', 'z']).map(k => [k, num(attr(p, k))])); }
export function quaternion(n: MapNode): any { const q = child(child(n, 'offset'), 'quaternion'); return q ? {
    qx: num(attr(q, 'qx')), qy: num(attr(q, 'qy')), qz: num(attr(q, 'qz')), qw: num(attr(q, 'qw'), 1)
} : null; }
export function add(a: any, b: any): any { return {
    x: a.x + b.x, z: a.z + b.z
}; }
export function rgb(n: MapNode, prefix = ''): string { return '#' + ['r', 'g', 'b'].map(k => Math.trunc(num(attr(n, prefix + k))).toString(16).padStart(2, '0').toUpperCase()).join(''); }
