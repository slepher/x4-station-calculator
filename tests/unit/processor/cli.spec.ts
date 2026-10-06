import { describe, expect, it } from 'vitest'
import { parseProcessorArgs, resolveContext, selectVersions, type ProcessorConfig } from '../../../scripts/processor/shared-ts/config'
import { processorHelp, runProcessor } from '../../../scripts/x4_processor'

const config: ProcessorConfig = {
  versions: [{ version: '8.0', folder_name: '8', beta: false }, { version: '9.0', folder_name: '9', beta: false }, { version: '9.0', folder_name: '9-beta', beta: true }],
  current_version: '9.0', beta: false, raw_assets_dir: './raw', processed_assets_dir: './out', dlc_order: []
}

describe('processor CLI', () => {
  it('rejects unknown commands/options, missing values and conflicting flags', () => {
    for (const argv of [['nope'], ['map', '--bad'], ['map', '--version'], ['map', '--version', '--stable'],
      ['map', '--version', '8.0', '--all-versions'], ['map', '--beta', '--stable'], ['map', '--version='], ['data', '--sector', 'x']]) expect(() => parseProcessorArgs(argv)).toThrow()
    expect(parseProcessorArgs(['--help']).help).toBe(true)
    expect(processorHelp('resources')).toContain('默认缓存')
  })

  it('selects configured default, explicit flavor, rejects ambiguity and preserves all-version order', () => {
    expect(selectVersions(config, parseProcessorArgs(['resources']))[0]!.folder_name).toBe('9')
    expect(selectVersions(config, parseProcessorArgs(['map', '--beta']))[0]!.folder_name).toBe('9-beta')
    expect(() => selectVersions(config, parseProcessorArgs(['map', '--version', '9.0']))).toThrow('多个候选')
    expect(selectVersions(config, parseProcessorArgs(['map', '--version=8.0']))[0]!.folder_name).toBe('8')
    expect(() => selectVersions(config, parseProcessorArgs(['map', '--version', '7.0']))).toThrow('未找到')
    expect(selectVersions(config, parseProcessorArgs(['data', '--all-versions', '--stable'])).map(item => item.folder_name)).toEqual(['8', '9', '9-beta'])
  })

  it('resolves actual overrides and version cache paths without using the legacy cache', () => {
    const args = parseProcessorArgs(['map', '--version', '8.0', '--output-dir', '/tmp/isolated', '--output', '/tmp/custom-map.json', '--map-dir', '/tmp/raw-map'])
    const ctx = resolveContext(config, config.versions[0]!, args, '/project')
    expect(ctx.outputRoot).toBe('/tmp/isolated')
    expect(ctx.paths.output).toBe('/tmp/custom-map.json')
    expect(ctx.paths['map-dir']).toBe('/tmp/raw-map')
    expect(ctx.blocksCache).toBe('/project/analysis/resources/8/resourcearea_blocks.json')
    const resources = resolveContext(config, config.versions[0]!, parseProcessorArgs(['resources', '--maps-json', '/tmp/input/maps.json']), '/project')
    expect(resources.paths['resource-output-dir']).toBe('/tmp/input')
    const all = resolveContext(config, config.versions[0]!, parseProcessorArgs(['data', '--all-versions', '--output-dir', '/tmp/isolated']), '/project')
    expect(all.outputRoot).toBe('/tmp/isolated/8')
    expect(() => resolveContext(config, config.versions[1]!, parseProcessorArgs(['resources', '--force-recalc-per-block']), '/project')).toThrow('不适用')
    expect(() => resolveContext(config, config.versions[0]!, parseProcessorArgs(['resources', '--save-sample-dir', '/missing-processor-save']), '/project')).toThrow('不存在')
    expect(resources.saveSampleDir).toBeUndefined()
  })

  it('runs versions sequentially with independent state and stops before success on failure', async () => {
    const visited: string[] = []; const logs: string[] = []
    await expect(runProcessor(parseProcessorArgs(['data', '--all-versions']), config, { data: ctx => {
      expect(ctx.config.dlc_order).toEqual([])
      ctx.config.dlc_order.push('mutated')
      visited.push(ctx.config.folder_name)
      if (ctx.config.folder_name === '9') throw new Error('stage failed')
    } }, text => logs.push(text))).rejects.toThrow('stage failed')
    expect(visited).toEqual(['8', '9']); expect(config.dlc_order).toEqual([])
    expect(logs.filter(line => line.includes('完成'))).toHaveLength(1)
    await expect(runProcessor(parseProcessorArgs(['map']), config, {}, () => {})).rejects.toThrow('尚未完成')
  })
})
