import { describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareDirectories, compareJson } from '../../../scripts/processor/compare'
import { loadProcessorConfig, parseProcessorArgs, resolveContext } from '../../../scripts/processor/shared-ts/config'
import { processPipeline } from '../../../scripts/processor/pipeline'
import { processorTargets, targetFiles } from '../../../scripts/processor/targets'

const baseline = process.env.PROCESSOR_BASELINE_ROOT
const config = loadProcessorConfig()
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
describe('one processor real-input exact parity', () => {
  for (const version of config.versions) it.skipIf(baseline === undefined)(`${version.version}: all, every target and multiple targets preserve exact data and ownership`, async () => {
    const root = mkdtempSync(join(tmpdir(), `pipeline-parity-${version.version}-`))
    try {
      const context = (target: string) => {
        const output = join(root, target)
        const result = resolveContext(config, version, parseProcessorArgs([target, '--output-dir', output]))
        result.blocksCache = join(root, target, 'cache.json')
        if (version.version === '8.0') {
          const cache = join(baseline!, 'cache/8.json')
          if (!existsSync(cache)) throw new Error(`Missing identical baseline cache: ${cache}`)
          mkdirSync(output, { recursive: true }); cpSync(cache, result.blocksCache)
        }
        return result
      }
      const all = context('all')
      await processPipeline(all, () => {})
      if (existsSync(all.blocksCache)) rmSync(all.blocksCache)
      expect(compareDirectories(join(baseline!, version.folder_name), all.outputRoot)).toEqual([])
      for (const target of [...processorTargets, 'ships,equipments', 'maps,map-resources', 'wares,research,blueprints']) {
        const current = context(target), data = join(current.outputRoot, 'data')
        mkdirSync(data, { recursive: true }); const sentinel = join(data, '__unselected__.json')
        writeFileSync(sentinel, '{ "preserve": "exact bytes" }\n')
        const before = readFileSync(sentinel)
        const result = await processPipeline(current, () => {})
        const names = target.split(',').flatMap(name => targetFiles[name as typeof processorTargets[number]])
        if (target.split(',').includes('map-resources')) names.push(...(version.version === '8.0' ? ['regions', 'regionyields'] : ['regionyield_definitions']))
        for (const name of names) expect(compareJson(read(join(all.outputRoot, 'data', `${name}.json`)), read(join(data, `${name}.json`))), `${target}/${name}`).toEqual([])
        expect(readFileSync(sentinel)).toEqual(before)
        expect(readdirSync(data).sort()).toEqual([...new Set([...names.map(name => `${name}.json`), 'languages.json', '__unselected__.json'])].sort())
        if (target === 'languages') expect(compareDirectories(join(all.outputRoot, 'locales'), join(current.outputRoot, 'locales'))).toEqual([])
        expect(new Set(result.files).size).toBe(result.files.length)
      }
    } finally { rmSync(root, { recursive: true, force: true }) }
  }, 240000)
})
