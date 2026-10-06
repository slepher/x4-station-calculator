import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { parseXml, nodes } from '../../../scripts/processor/shared-ts/xml'
import { roundHalfEven } from '../../../scripts/processor/shared-ts/math'
import { I18nRegistry } from '../../../scripts/processor/shared-ts/i18n'
import { writeJson } from '../../../scripts/processor/shared-ts/io'
import { compareDirectories, compareJson } from '../../../scripts/processor/compare'

const roots: string[] = []
function temporary(): string { const root = mkdtempSync(join(tmpdir(), 'processor-unit-')); roots.push(root); return root }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('processor shared behavior', () => {
  it('preserves string IDs, XML cardinality and order, and rejects malformed input', () => {
    const root = parseXml('<wares><ware id="007"/><ware id="008"/></wares>')
    expect(nodes(root.wares.ware).map(node => node['@_id'])).toEqual(['007', '008'])
    expect(nodes(parseXml('<wares><ware id="007"/></wares>').wares.ware)).toHaveLength(1)
    expect(nodes(undefined)).toEqual([])
    expect(() => parseXml('<wares>')).toThrow('Invalid XML')
  })

  it('matches Python binary64 half-even rounding rather than decimal multiplication', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, -2.5].map(value => roundHalfEven(value))).toEqual([0, 2, 2, -0, -2, -2])
    expect(roundHalfEven(2.675, 2)).toBe(2.67)
    expect(roundHalfEven(2.685, 2)).toBe(2.69)
    expect(roundHalfEven(150, -2)).toBe(200)
    expect(roundHalfEven(250, -2)).toBe(200)
    expect(Math.trunc(-1.9)).toBe(-1)
    expect(Math.fround(16777217)).toBe(16777216)
  })

  it('resolves nested references and mixed text, tracks missing and isolates versions', () => {
    const root = temporary(); mkdirSync(join(root, 't'))
    const language = '<language><page id="1"><t id="1">{1,2} (note)</t><t id="2">A<b>B</b>C</t><t id="3">{1,3}</t><t id="4">English｜中文</t></page></language>'
    writeFileSync(join(root, 't/0001-l044.xml'), language)
    writeFileSync(join(root, 't/0001-l086.xml'), language)
    const registry = new I18nRegistry(); registry.configure(root, { '044': { iso: 'en' }, '086': { iso: 'zh-CN' } })
    expect(registry.getName('{1,1}')).toBe('ABC')
    expect(registry.getName('{1,3}')).toBe('{1,3}')
    expect(registry.getName('{1,4}', 'zh-CN')).toBe('中文')
    expect(registry.getName('{1,99}')).toBe('{1,99}')
    expect(registry.missingKeys('en')).toEqual(new Set(['{1,99}']))
    expect(registry.exportCollected('en')['{1,1}']).toBe('ABC')
    registry.configure(temporary(), { '044': { iso: 'en' } })
    expect(registry.exportCollected('en')).toEqual({})
    expect(registry.getName('{1,1}')).toBe('{1,1}')
  })

  it('compares key order neutrally but reports missing/null/type/array changes and file sets', () => {
    expect(compareJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([])
    expect(compareJson({ a: null }, {})).toMatchObject([{ kind: 'missing-field', path: '$["a"]' }])
    expect(compareJson(1, '1')).toHaveLength(1)
    expect(compareJson([1, 2], [2, 1])).toHaveLength(2)
    expect(compareJson([1], [1, 2])).toMatchObject([{ kind: 'array-length' }])
    const left = temporary(); const right = temporary()
    writeJson(join(left, 'a.json'), { a: 1 }); writeJson(join(right, 'b.json'), { a: 1 })
    expect(compareDirectories(left, right).map(diff => diff.kind)).toEqual(['missing-file', 'extra-file'])
    writeJson(join(right, 'a.json'), { a: 1 }); writeFileSync(join(left, 'a.json'), '{"a":1}')
    rmSync(join(right, 'b.json'))
    expect(compareDirectories(left, right)).toEqual([])
  })

  it('keeps the previous JSON when serialization fails', () => {
    const path = join(temporary(), 'result.json'); writeJson(path, { previous: true })
    const previous = readFileSync(path, 'utf8')
    expect(() => writeJson(path, { invalid: 1n })).toThrow()
    expect(readFileSync(path, 'utf8')).toBe(previous)
  })
})
