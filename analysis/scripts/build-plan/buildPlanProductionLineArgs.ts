import getopts from 'getopts'

export interface BuildPlanProductionLineArgs {
  file?: string
  index: number
  noBuildMaterial: boolean
  json: boolean | 'compact'
  help: boolean
  module?: string
  ware?: string
  flow?: string
}

const OPTIONS = {
  alias: {
    help: 'h',
  },
  boolean: ['help', 'no-build-material'],
  string: ['file', 'module', 'ware', 'flow', 'json'],
  default: {
    index: 0,
    'no-build-material': false,
    help: false,
  },
  unknown: () => true,
} as const

function normalizeIndex(value: unknown): number {
  if (Array.isArray(value)) return normalizeIndex(value.at(-1))
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function normalizeJson(value: unknown, specified: boolean): boolean | 'compact' {
  if (!specified) return false
  if (Array.isArray(value)) return normalizeJson(value.at(-1), true)
  if (value === 'compact') return 'compact'
  if (value === '') return true
  return false
}

export function parseBuildPlanProductionLineArgs(
  argv: string[],
): BuildPlanProductionLineArgs {
  const parsed = getopts(argv, OPTIONS)
  const jsonSpecified = argv.some(arg => arg === '--json' || arg.startsWith('--json='))

  return {
    file: parsed.file,
    index: normalizeIndex(parsed.index),
    noBuildMaterial: Boolean(parsed['no-build-material']),
    json: normalizeJson(parsed.json, jsonSpecified),
    help: Boolean(parsed.help),
    module: parsed.module,
    ware: parsed.ware,
    flow: parsed.flow,
  }
}

export function renderBuildPlanProductionLineHelp(): string {
  return `Usage: npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts [options]

Options:
  --file <path>        Export JSON path
  --file=<path>        Export JSON path (same as above)
  --index <N>          Use the N-th build plan in the file
  --index=<N>          Use the N-th build plan in the file (same as above)
  --no-build-material  Disable build-material line planning
  --json               JSON output mode
  --json=compact       Compact JSON output (scheme groups only)
  --help, -h           Show this help

Legacy options (override --file):
  --module <spec>      Build-module goal (comma-separated)
  --module=<spec>      Build-module goal (same as above)
  --ware <spec>        Production-rate goal (comma-separated)
  --ware=<spec>        Production-rate goal (same as above)
  --flow <path>        Logic-flow fixture JSON path
  --flow=<path>        Logic-flow fixture JSON path (same as above)

Default:
  Reads build-plan[0] from tests/fixtures/export.json

Examples:
  npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts
  npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts --index 2
  npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts --index=2
  npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts --json`
}
