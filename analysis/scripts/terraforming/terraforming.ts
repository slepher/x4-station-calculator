/**
 * Terraforming task list CLI.
 *
 * Usage:
 *   npx vite-node analysis/scripts/terraforming/terraforming.ts --planet=ScalePlateGreen
 *   npx vite-node analysis/scripts/terraforming/terraforming.ts --planet=ScalePlateGreen --temperature=4 --oxygen=9 --completed=pwr_antimatter,wat_import
 *   npx vite-node analysis/scripts/terraforming/terraforming.ts --planet=ScalePlateGreen --version=9.0-Empire-beta
 */

import getopts from 'getopts'
import {
  resolveAvailableTasks,
  printTaskTree,
  printObjectives,
  resolveTerraformingText,
  resolveWithReplaces,
} from '@/store/logic/terraformingTaskResolver'
import type { TerraformingState, TerraformingData } from '@/store/logic/terraformingTaskResolver'
import { loadGameDataFiles } from '@/store/logic/useGameData'

const STAT_KEYS = [
  'temperature', 'oxygen', 'methane', 'carbondioxide',
  'airpressure', 'humidity', 'seismicactivity',
  'toxicity', 'radioactivity', 'population', 'salinity',
] as const

interface CliArgs {
  planet: string
  version: string
  completed: string[]
  stats: Partial<Record<string, number>>
  json: boolean
  help: boolean
}

function normalizeVersion(raw: unknown, defaultVersion: string): string {
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
  if (Array.isArray(raw)) {
    const last = raw.at(-1)
    if (typeof last === 'string' && last.trim() !== '') return last.trim()
  }
  return defaultVersion
}

function parseCompleted(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (Array.isArray(raw)) {
    const last = raw.at(-1)
    if (typeof last === 'string') {
      return last.split(',').map(s => s.trim()).filter(Boolean)
    }
  }
  return []
}

function parseStatArgs(parsed: getopts.ParsedOptions): Partial<Record<string, number>> {
  const stats: Partial<Record<string, number>> = {}
  for (const key of STAT_KEYS) {
    let val = parsed[key]
    if (val === undefined || val === null) continue
    if (Array.isArray(val)) val = val.at(-1)
    if (val === undefined || val === null || val === '') continue
    const n = Number(val)
    if (Number.isFinite(n)) stats[key] = n
  }
  return stats
}

function loadDefaultVersion(): string {
  try {
    const versionsModule = import.meta.glob('/src/assets/versions.json', { eager: true })
    const key = Object.keys(versionsModule)[0]
    if (!key) return '8.0-Diplomacy'
    const v = (versionsModule[key] as { default: any }).default
    if (v?.current_version) {
      const ver = v.versions?.find((vi: any) => vi.version === v.current_version && !vi.beta)
      if (ver?.folder_name) return ver.folder_name
    }
    return '8.0-Diplomacy'
  } catch {
    return '8.0-Diplomacy'
  }
}

function renderHelp(): string {
  return `Usage: npx vite-node analysis/scripts/terraforming/terraforming.ts [options]

Options:
  --planet=<id>        星球 ID，必选 (e.g. ScalePlateGreen, BlackHoleSun)
  --version=<folder>   数据版本目录，默认 versions.json 中指定的稳定版
  --temperature=<n>    覆盖温度值
  --oxygen=<n>         覆盖氧气值
  --methane=<n>        覆盖甲烷值
  --carbondioxide=<n>  覆盖二氧化碳值
  --airpressure=<n>    覆盖气压值
  --humidity=<n>       覆盖湿度值
  --seismicactivity=<n>覆盖地震活动值
  --toxicity=<n>       覆盖毒性值
  --radioactivity=<n>  覆盖辐射值
  --population=<n>     覆盖人口值
  --salinity=<n>       覆盖盐度值
  --completed=<ids>    已完成的项目 ID，逗号分隔
  --list-planets       列出所有可选星球
  --lang=<code>        界面语言，默认 zh-CN
  --json               JSON 格式输出
  --help, -h           显示帮助

Examples:
  npx vite-node analysis/scripts/terraforming/terraforming.ts --planet=ScalePlateGreen
  npx vite-node analysis/scripts/terraforming/terraforming.ts --planet=ScalePlateGreen --temperature=4 --oxygen=9
  npx vite-node analysis/scripts/terraforming/terraforming.ts --planet=BlackHoleSun --completed=pwr_wind,ind_refineries_clean --json`
}

export interface ParsedArgs {
  planet: string
  version: string
  lang: string
  completed: string[]
  statOverrides: Partial<Record<string, number>>
  json: boolean
  listPlanets: boolean
  help: boolean
}

export function parseArgs(argv: string[]): ParsedArgs {
  const opts = {
    alias: { help: 'h' },
    boolean: ['help', 'json', 'list-planets'],
    string: ['planet', 'version', 'lang', 'completed', ...STAT_KEYS],
    default: { help: false, json: false, 'list-planets': false, lang: 'zh-CN' },
    unknown: () => true,
  } as const

  const parsed = getopts(argv, opts)
  const defaultVersion = loadDefaultVersion()

  return {
    planet: typeof parsed.planet === 'string' ? parsed.planet : '',
    version: normalizeVersion(parsed.version, defaultVersion),
    lang: typeof parsed.lang === 'string' ? parsed.lang : 'zh-CN',
    completed: parseCompleted(parsed.completed),
    statOverrides: parseStatArgs(parsed),
    json: Boolean(parsed.json),
    listPlanets: Boolean(parsed['list-planets']),
    help: Boolean(parsed.help),
  }
}

export async function run(args: ParsedArgs): Promise<string> {
  const gameData = await loadGameDataFiles(args.version)
  const data = gameData.terraforming
  const i18nMap = loadLocale(data, args.version, args.lang)

  const cluster = data.clusters.find(c => c.id === args.planet)
  if (!cluster) {
    const available = data.clusters.map(c => c.id).join(', ')
    throw new Error(`Planet "${args.planet}" not found. Available: ${available}`)
  }

  const currentStats: Record<string, number> = { ...cluster.initialStats }
  for (const [key, val] of Object.entries(args.statOverrides)) {
    if (val !== undefined) currentStats[key] = val
  }

  const state: TerraformingState = {
    stats: currentStats,
    completedProjects: new Set(args.completed),
  }

  const tree = resolveAvailableTasks(cluster, state, data)

  const lines: string[] = []
  lines.push(printObjectives(cluster, data, i18nMap))
  lines.push('')
  lines.push(printTaskTree(tree, i18nMap))
  return lines.join('\n')
}

function loadLocale(
  data: TerraformingData,
  version: string,
  lang: string,
): Record<string, string> {
  const localePath = `/src/assets/x4_game_data/${version}/locales/${lang}.json`
  const modules = import.meta.glob('/src/assets/x4_game_data/*/locales/*.json', { eager: true })
  const key = Object.keys(modules).find(k => k.includes(version) && k.includes(lang + '.json'))
  if (!key) return {}
  return (modules[key] as { default: Record<string, string> }).default
}

// CLI entry
const argv = process.argv.slice(2)
const args = parseArgs(argv)

if (args.help) {
  console.log(renderHelp())
  process.exit(0)
}

if (args.listPlanets) {
  try {
    const gameData = await loadGameDataFiles(args.version)
    const data = gameData.terraforming
    console.log(`Available planets (version: ${args.version}):`)
    for (const c of data.clusters) {
      const name = c.id
      const stats = Object.entries(c.initialStats)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
      console.log(`  ${name}`)
      if (stats) console.log(`    initial: ${stats}`)
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }
  process.exit(0)
}

if (!args.planet) {
  console.log(renderHelp())
  process.exit(1)
}

try {
  const output = await run(args)
  if (args.json) {
    const gameDataJ = await loadGameDataFiles(args.version)
    const data = gameDataJ.terraforming
    const cluster = data.clusters.find(c => c.id === args.planet)
    if (!cluster) throw new Error(`Planet "${args.planet}" not found`)

    const currentStats: Record<string, number> = { ...cluster.initialStats }
    for (const [key, val] of Object.entries(args.statOverrides)) {
      if (val !== undefined) currentStats[key] = val
    }
    const state: TerraformingState = {
      stats: currentStats,
      completedProjects: new Set(args.completed),
    }
    const tree = resolveAvailableTasks(cluster, state, data)
    console.log(JSON.stringify({
      planet: args.planet,
      version: args.version,
      currentStats,
      completedProjects: [...state.completedProjects],
      objectives: (cluster as any).objectives || [],
      available: tree.roots.map(n => n.id),
      blocked: tree.blocked.map(n => ({
        id: n.id,
        name: n.name,
        blockedReason: n.blockedReason,
      })),
    }, null, 2))
  } else {
    const gameDataE = await loadGameDataFiles(args.version)
    const data = gameDataE.terraforming
    const cluster = data.clusters.find(c => c.id === args.planet)!
    const currentStats: Record<string, number> = { ...cluster.initialStats }
    for (const [key, val] of Object.entries(args.statOverrides)) {
      if (val !== undefined) currentStats[key] = val
    }
    console.log(`Planet: ${args.planet} (version: ${args.version})`)
    console.log(`Current stats: ${JSON.stringify(currentStats)}`)
    console.log('')
    console.log(output)
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
