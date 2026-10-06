import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { readJson } from './io'
import { parseTargets, planProcessor, type ProcessorSelection } from '../targets'

export type ProcessorTask = ProcessorSelection | 'data' | 'map' | 'resources'
export interface VersionItem { version: string; folder_name: string; beta?: boolean; [key: string]: any }
export interface ProcessorConfig {
  versions: VersionItem[]; current_version: string; beta: boolean
  raw_assets_dir: string; processed_assets_dir: string; dlc_order: string[]
  [key: string]: any
}
export interface ProcessorArgs {
  task?: ProcessorTask; targets?: ProcessorSelection[]; help: boolean; values: Record<string, string>; flags: Set<string>
}
export interface ProcessorContext {
  config: ProcessorConfig & VersionItem; rawPath: string; outputRoot: string
  paths: Record<string, string>; sector?: string; forceRecalcPerBlock: boolean
  saveSampleDir?: string; blocksCache: string
  targets?: ProcessorSelection[]; explicitInputs?: Set<string>
}

const commonStrings = ['version', 'output-dir']
const commonFlags = ['help', 'all-versions', 'beta', 'stable']
export const mapStrings = ['map-dir', 'mapdefaults-xml', 'god-xml', 'factions-xml', 'colors-xml',
  'region-definitions-xml', 'regionobjectgroups-xml', 'regionyields-xml',
  'factions-output', 'regions-output', 'regionyields-output', 'output']
export const resourceStrings = ['maps-json', 'regions-json', 'regionyields-xml', 'mapdefaults-xml',
  'sector', 'save-sample-dir', 'blocks-cache']

export function parseProcessorArgs(argv: string[]): ProcessorArgs {
  const args: ProcessorArgs = { help: false, values: {}, flags: new Set() }
  const tokens = [...argv]
  if (tokens[0] === '--') tokens.shift()
  if (tokens[0] !== undefined && !tokens[0].startsWith('-')) {
    const task = tokens.shift()!
    args.targets = parseTargets(task)
    args.task = args.targets[0]
  }
  const strings = new Set(commonStrings)
  const flags = new Set(commonFlags)
  const plan = args.targets === undefined ? undefined : planProcessor(args.targets)
  if (plan?.stages.includes('maps')) mapStrings.forEach(key => strings.add(key))
  if (plan?.stages.includes('map-resources')) {
    resourceStrings.forEach(key => strings.add(key))
    flags.add('force-recalc-per-block')
  }
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]!
    if (token === '-h') token = '--help'
    if (!token.startsWith('--')) throw new Error(`未知参数: ${token}`)
    const separator = token.indexOf('=')
    const key = token.slice(2, separator === -1 ? undefined : separator)
    if (args.flags.has(key) || Object.hasOwn(args.values, key)) throw new Error(`重复参数: --${key}`)
    if (flags.has(key)) {
      if (separator !== -1) throw new Error(`--${key} 不接受值`)
      args.flags.add(key)
    } else if (strings.has(key)) {
      let value: string | undefined
      if (separator !== -1) value = token.slice(separator + 1)
      else value = tokens[++i]
      if (value === undefined || value.trim() === '' || value.startsWith('-')) throw new Error(`--${key} 缺少值`)
      args.values[key] = value
    } else throw new Error(`未知参数: --${key}`)
  }
  if (args.values.version !== undefined && args.flags.has('all-versions')) throw new Error('--version 与 --all-versions 互斥')
  if (args.flags.has('beta') && args.flags.has('stable')) throw new Error('--beta 与 --stable 互斥')
  args.help = args.flags.has('help')
  if (args.task === undefined && !args.help) throw new Error('缺少目标: all | 单项 | 逗号分隔多项')
  if (args.values.sector !== undefined && (args.targets?.length !== 1 || args.targets[0] !== 'map-resources')) throw new Error('--sector 仅适用于唯一目标 map-resources')
  return args
}

export function loadProcessorConfig(path = 'x4-station-calculator.config.json'): ProcessorConfig {
  const config = readJson<ProcessorConfig>(path)
  if (config === null || typeof config !== 'object') throw new Error(`无效配置: ${path}`)
  if (!Array.isArray(config.versions) || config.versions.length === 0) throw new Error('配置缺少 versions')
  for (const item of config.versions) {
    if (item === null || typeof item !== 'object' || typeof item.version !== 'string' || typeof item.folder_name !== 'string' || !item.folder_name) throw new Error('无效版本配置')
    if (item.beta !== undefined && typeof item.beta !== 'boolean') throw new Error('版本 beta 必须为 boolean')
  }
  for (const key of ['current_version', 'raw_assets_dir', 'processed_assets_dir']) {
    if (typeof config[key] !== 'string' || !config[key]) throw new Error(`配置缺少 ${key}`)
  }
  if (typeof config.beta !== 'boolean' || !Array.isArray(config.dlc_order) || config.dlc_order.some(id => typeof id !== 'string')) throw new Error('无效 beta/dlc_order 配置')
  return config
}

export function selectVersions(config: ProcessorConfig, args: ProcessorArgs): VersionItem[] {
  if (config.versions.length === 0) throw new Error('配置缺少 versions')
  if (args.flags.has('all-versions')) return structuredClone(config.versions)
  let version = config.current_version
  if (args.values.version !== undefined) version = args.values.version
  let candidates = config.versions.filter(item => item.version === version)
  let flavor: boolean | undefined
  if (args.flags.has('beta')) flavor = true
  else if (args.flags.has('stable')) flavor = false
  else if (args.values.version === undefined) flavor = config.beta
  if (flavor !== undefined) candidates = candidates.filter(item => Boolean(item.beta) === flavor)
  if (candidates.length === 0) throw new Error(`未找到版本 ${version}，请检查 beta/stable 配置`)
  if (candidates.length > 1) throw new Error(`版本 ${version} 存在多个候选，请指定 --beta 或 --stable`)
  return structuredClone(candidates)
}

export function resolveContext(config: ProcessorConfig, version: VersionItem, args: ProcessorArgs, cwd = process.cwd()): ProcessorContext {
  const targets = args.targets === undefined ? parseTargets(args.task!) : args.targets
  const plan = planProcessor(targets)
  const resources = plan.stages.includes('map-resources')
  const effective = { ...structuredClone(config), ...structuredClone(version) }
  const rawPath = resolve(cwd, effective.raw_assets_dir, effective.folder_name)
  let outputRoot = resolve(cwd, effective.processed_assets_dir, effective.folder_name)
  if (args.values['output-dir'] !== undefined) {
    outputRoot = resolve(cwd, args.values['output-dir'])
    if (args.flags.has('all-versions')) outputRoot = join(outputRoot, effective.folder_name)
  }
  const paths: Record<string, string> = {
    'map-dir': join(rawPath, 'maps/xu_ep2_universe'),
    'maps-json': join(outputRoot, 'data/maps.json'), 'regions-json': join(outputRoot, 'data/regions.json'),
    output: join(outputRoot, 'data/maps.json'),
    'factions-output': join(outputRoot, 'data/factions.json'),
    'regions-output': join(outputRoot, 'data/regions.json'),
    'regionyields-output': join(outputRoot, 'data/regionyields.json')
  }
  for (const library of ['mapdefaults', 'god', 'factions', 'colors', 'regionobjectgroups', 'regionyields']) paths[`${library}-xml`] = join(rawPath, 'libraries', library, 'final.xml')
  paths['region-definitions-xml'] = join(rawPath, 'libraries/region_definitions/final.xml')
  for (const [key, value] of Object.entries(args.values)) {
    if (mapStrings.includes(key) || resourceStrings.includes(key)) {
      if (key !== 'sector' && key !== 'save-sample-dir' && key !== 'blocks-cache') paths[key] = resolve(cwd, value)
    }
  }
  if (targets.length === 1 && targets[0] === 'map-resources' && args.values['maps-json'] !== undefined && args.values['output-dir'] === undefined) {
    outputRoot = dirname(dirname(paths['maps-json']!))
    paths['resource-output-dir'] = dirname(paths['maps-json']!)
    for (const key of ['regions-output', 'regionyields-output']) {
      if (args.values[key] === undefined) paths[key] = join(paths['resource-output-dir']!, `${key.slice(0, -7)}.json`)
    }
  } else paths['resource-output-dir'] = join(outputRoot, 'data')
  let blocksCache = resolve(cwd, 'analysis/resources', effective.folder_name, 'resourcearea_blocks.json')
  if (args.values['blocks-cache'] !== undefined) blocksCache = resolve(cwd, args.values['blocks-cache'])
  const modern = Number.parseInt(effective.version, 10) >= 9
  if (resources && modern) {
    for (const key of ['blocks-cache', 'save-sample-dir']) if (args.values[key] !== undefined) throw new Error(`--${key} 不适用于 ${effective.version} resourceareas 模型`)
    if (args.flags.has('force-recalc-per-block')) throw new Error('--force-recalc-per-block 不适用于 resourceareas 模型')
  }
  let saveSampleDir: string | undefined
  if (resources && !modern) {
    if (args.values['save-sample-dir'] !== undefined) {
      saveSampleDir = resolve(cwd, args.values['save-sample-dir'])
      if (!existsSync(saveSampleDir)) throw new Error(`存档目录不存在: ${saveSampleDir}`)
    } else {
      const defaultDir = resolve(cwd, 'save_sample_data')
      if (existsSync(defaultDir)) saveSampleDir = defaultDir
    }
  }
  const explicitInputs = new Set(Object.keys(args.values).filter(key => key === 'map-dir' || key.endsWith('-xml') || key.endsWith('-json')))
  for (const key of explicitInputs) if (!existsSync(paths[key]!)) throw new Error(`输入不存在 --${key}: ${paths[key]}`)
  return { config: effective, rawPath, outputRoot, paths, blocksCache, saveSampleDir, targets, explicitInputs,
    sector: args.values.sector, forceRecalcPerBlock: args.flags.has('force-recalc-per-block') }
}
