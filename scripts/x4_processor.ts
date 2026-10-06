import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { loadProcessorConfig, parseProcessorArgs, resolveContext, selectVersions,
  mapStrings, resourceStrings, type ProcessorArgs, type ProcessorConfig,
  type ProcessorContext } from './processor/shared-ts/config'
import { parseTargets, planProcessor, processorTargets } from './processor/targets'
import { processPipeline } from './processor/pipeline'

export type ProcessorRunner = (context: ProcessorContext) => unknown | Promise<unknown>

export function processorHelp(task?: string): string {
  const plan = task === undefined ? undefined : planProcessor(parseTargets(task))
  const lines = [
    'Usage: npm run process -- <all|target[,target...]> [options]',
    `目标: ${processorTargets.join(', ')}`,
    '旧名称: data → all（现在包含地图资源计算）；map → maps；resources → map-resources。',
    '示例: all；ships,equipments；map-resources --sector <id>；all --all-versions',
    '--help  --version <v> | --all-versions  --beta | --stable',
    '默认版本/flavor 来自 x4-station-calculator.config.json。',
    '--output-dir <root>  输出根目录，保留 data/、locales/；全版本追加 folder_name。',
    '单文件输出覆盖仅影响所属目标；全版本按配置顺序执行，失败时停止。'
  ]
  if (plan === undefined || plan.stages.includes('maps')) lines.push(`maps: ${mapStrings.map(key => `--${key} <path>`).join(' ')}`)
  if (plan === undefined || plan.stages.includes('map-resources')) lines.push(
    `map-resources: ${resourceStrings.map(key => `--${key} <value>`).join(' ')}`,
    '--sector 仅允许唯一目标 map-resources。',
    '--force-recalc-per-block  强制逐格重算（仅 regions/8.0）',
    '--blocks-cache 与 --save-sample-dir 仅适用 regions/8.0。',
    '默认缓存: analysis/resources/<folder_name>/resourcearea_blocks.json；不自动复用旧无版本缓存。',
    '默认存档目录 save_sample_data 缺失时不使用存档；显式目录缺失则报错。',
    '自动输入使用本轮地图；显式输入缺失或无效报错。'
  )
  return lines.join('\n')
}

export async function runProcessor(args: ProcessorArgs, config: ProcessorConfig,
  runner: ProcessorRunner = context => processPipeline(context, log), log: (message: string) => void = console.log): Promise<void> {
  if (args.task === undefined) throw new Error('缺少目标')
  const versions = selectVersions(config, args)
  const contexts = versions.map(version => resolveContext(config, version, args))
  for (const context of contexts) {
    const label = context.targets!.join(',')
    log(`[${label}] ${context.config.version} (${context.config.beta ? 'beta' : 'stable'}) 开始`)
    const started = performance.now()
    let result: unknown
    try { result = await runner(context) }
    catch (error) { throw new Error(`[${context.config.version}] ${error instanceof Error ? error.message : String(error)}`, { cause: error }) }
    if (result !== undefined && result !== null && typeof result === 'object') {
      const summary = result as { files?: string[] }
      if (summary.files !== undefined && summary.files.length > 0) log(`[${label}] 输出 ${summary.files.length} 个文件:\n${summary.files.join('\n')}`)
    }
    log(`[${label}] ${context.config.version} 完成: ${context.outputRoot}`)
    log(`[${label}] 耗时 ${((performance.now() - started) / 1000).toFixed(3)} 秒；进程峰值 RSS ${process.resourceUsage().maxRSS} KiB`)
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseProcessorArgs(argv)
  if (args.help) { console.log(processorHelp(args.targets?.join(','))); return }
  await runProcessor(args, loadProcessorConfig())
}

export async function cli(argv = process.argv.slice(2)): Promise<void> {
  try { await main(argv) }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void cli()
}
