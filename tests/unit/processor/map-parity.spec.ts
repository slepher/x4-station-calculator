import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { writeJson } from '../../../scripts/processor/shared-ts/io';
import { processMap } from '../../../scripts/processor/map-ts';
const config = JSON.parse(readFileSync('x4-station-calculator.config.json', 'utf8'));
function differences(a: any, b: any, path = '$'): string[] {
    if (typeof a !== typeof b || a === null || b === null)
        return a === b ? [] : [`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`];
    if (typeof a !== 'object')
        return a === b ? [] : [`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`];
    if (Array.isArray(a) !== Array.isArray(b))
        return [`${path}: array mismatch`];
    const result: string[] = [];
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(key in a) || !(key in b))
            result.push(`${path}.${key}: missing key`);
        else
            result.push(...differences(a[key], b[key], `${path}.${key}`));
    }
    return result;
}
describe('map full Python baseline equivalence', () => {
    for (const version of config.versions)
        it.skipIf(!existsSync(`/tmp/x4-migrate/python/${version.version}/map/data`))(`${version.version} preserves every output field and array order`, () => {
            const started = performance.now();
            const root = mkdtempSync(join(tmpdir(), `x4-map-${version.version}-`)), summary = processMap({
                config: {
                    ...config, ...version
                }, rawPath: resolve('x4raw_assets', version.folder_name), outputRoot: root
            }), expectedDir = `/tmp/x4-migrate/python/${version.version}/map/data`, actualDir = join(root, 'data');
            expect(readdirSync(actualDir).sort()).toEqual(readdirSync(expectedDir).sort());
            const all: string[] = [];
            for (const file of readdirSync(expectedDir)) {
                const diff = differences(JSON.parse(readFileSync(join(expectedDir, file), 'utf8')), JSON.parse(readFileSync(join(actualDir, file), 'utf8')));
                if (diff.length)
                    console.error(file, diff.length, diff.slice(0, 20));
                all.push(...diff.map(d => file + ': ' + d));
            }
            writeJson(`/tmp/x4-migrate/map-ts/parity-${version.version}.json`, {
                version: version.version, expectedDir, actualDir, files: readdirSync(expectedDir).sort(), differences: all, elapsedMs: performance.now() - started
            });
            expect(all.slice(0, 20)).toEqual([]);
            expect(summary.outputs.length).toBe(readdirSync(expectedDir).length);
        }, 120000);
});
