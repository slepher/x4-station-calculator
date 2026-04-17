import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const targets = [
  'src/components/empire/presenters/useProductionTabbarPresenter.ts',
  'src/components/empire/presenters/useProductionToolbarPresenter.ts',
  'src/components/empire/presenters/useProductionPlanningPresenter.ts',
  'src/components/empire/presenters/useProductionWareflowPresenter.ts',
  'src/components/empire/presenters/useProductionDashboardPresenter.ts',
  'src/components/empire/BlueprintProductionWorkbenchView.vue',
  'src/components/empire/LiveProductionWorkbenchView.vue'
]

const forbiddenPatterns = [
  { pattern: /\.workbench\b/g, message: 'Do not consume a workbench compatibility layer from presenters/views.' },
  { pattern: /\bgetSessionState\(/g, message: 'Do not use getSessionState(); read store.session directly.' },
  { pattern: /\bgetContextState\(/g, message: 'Do not use getContextState(); read store.context directly.' },
  { pattern: /\bgetWorkbenchMode\(/g, message: 'Do not use getWorkbenchMode(); read store.session.workbenchMode directly.' },
  { pattern: /\bgetActiveStationId\(/g, message: 'Do not use getActiveStationId(); read store.session.activeStationId directly.' },
  { pattern: /\bgetActiveTransitSectorId\(/g, message: 'Do not use getActiveTransitSectorId(); read store.session.activeTransitSectorId directly.' }
]

const errors = []

for (const target of targets) {
  const content = readFileSync(resolve(root, target), 'utf8')
  for (const { pattern, message } of forbiddenPatterns) {
    const matches = content.match(pattern)
    if (matches?.length) {
      errors.push(`${target}: ${message} Found ${matches.length} match(es) for ${pattern}.`)
    }
  }
}

if (errors.length > 0) {
  console.error('Production compatibility-layer guard failed:\n')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}
