import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { loadProcessorConfig, parseProcessorArgs, resolveContext, selectVersions,
  mapStrings, resourceStrings, type ProcessorArgs, type ProcessorConfig,
  type ProcessorContext, type ProcessorTask } from './processor/shared-ts/config'
import { processMap } from './processor/map-ts/index'
import { processResources } from './processor/resources-ts/index'
import { processData } from './processor/data-ts/index'

export type ProcessorRunner = (context: ProcessorContext) => unknown | Promise<unknown>

export function processorHelp(task?: ProcessorTask): string {
  const lines = [
    'Usage: npm run process -- <data|map|resources> [options]',
    'data: 基础数据及地图；map: 独立地图；resources: 独立资源计算',
    '--help  --version <v> | --all-versions  --beta | --stable',
    '默认版本/flavor 来自 x4-station-calculator.config.json。',
    '--output-dir <root>  输出根目录，保留 data/、locales/；全版本追加 folder_name。',
    '单文件输出覆盖优先；全版本按配置顺序执行，失败时停止。'
  ]
  if (task === undefined || task === 'map') lines.push(`map: ${mapStrings.map(key => `--${key} <path>`).join(' ')}`)
  if (task === undefined || task === 'resources') lines.push(
    `resources: ${resourceStrings.map(key => `--${key} <value>`).join(' ')}`,
    '--force-recalc-per-block  强制逐格重算（仅 regions/8.0）',
    '--blocks-cache 与 --save-sample-dir 仅适用 regions/8.0。',
    '默认缓存: analysis/resources/<folder_name>/resourcearea_blocks.json；不自动复用旧无版本缓存。',
    '默认存档目录 save_sample_data 缺失时不使用存档；显式目录缺失则报错。',
    '未指定输出目录时资源输出到 maps-json 所在目录；资源任务不修改 maps.json。'
  )
  return lines.join('\n')
}

export async function runProcessor(args: ProcessorArgs, config: ProcessorConfig,
  runners: Partial<Record<ProcessorTask, ProcessorRunner>>, log: (message: string) => void = console.log): Promise<void> {
  if (args.task === undefined) throw new Error('缺少任务')
  const runner = runners[args.task]
  if (runner === undefined) throw new Error(`${args.task} 尚未完成 TypeScript 迁移`)
  const versions = selectVersions(config, args)
  for (const version of versions) {
    const context = resolveContext(config, version, args)
    log(`[${args.task}] ${version.version} (${version.beta ? 'beta' : 'stable'}) 开始`)
    const started = performance.now()
    const result = await runner(context)
    if (result !== undefined && result !== null && typeof result === 'object') {
      const summary = result as { outputs?: string[]; output_files?: string[]; files?: string[] }
      let outputs: string[] | undefined
      switch (args.task) {
        case 'map': outputs = summary.outputs; break
        case 'data': outputs = summary.files; break
        case 'resources': outputs = summary.output_files; break
      }
      if (outputs !== undefined && outputs.length > 0) log(`[${args.task}] 输出 ${outputs.length} 个文件:\n${outputs.join('\n')}`)
    }
    log(`[${args.task}] ${version.version} 完成: ${context.outputRoot}`)
    log(`[${args.task}] 耗时 ${((performance.now() - started) / 1000).toFixed(3)} 秒；进程峰值 RSS ${process.resourceUsage().maxRSS} KiB`)
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseProcessorArgs(argv)
  if (args.help) { console.log(processorHelp(args.task)); return }
  const config = loadProcessorConfig()
  const runners: Partial<Record<ProcessorTask, ProcessorRunner>> = {
    data: processData,
    map: context => {
      console.log('[map] 解析地图、名称、区域及资源定义')
      return processMap(context)
    },
    resources: context => {
      console.log('[resources] 资源模型、缓存、储量与刷新率')
      return processResources(context)
    }
  }
  await runProcessor(args, config, runners)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
}
