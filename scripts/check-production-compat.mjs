import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const targets = [
  'src/store/useBlueprintProductionStore.ts',
  'src/store/useLiveProductionStore.ts',
  'src/components/empire/presenters/useProductionSidebarPresenter.ts',
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
  { pattern: /\bgetActiveTransitSectorId\(/g, message: 'Do not use getActiveTransitSectorId(); read store.session.activeTransitSectorId directly.' },
  { pattern: /\bupdateTransitHubSettings\(/g, message: 'Do not use updateTransitHubSettings(); transit settings must flow through unified updateSetting/updateX actions.' },
  { pattern: /\bgetTabs\b/g, message: 'Do not keep or consume getTabs; assemble tab props from formal state.' },
  { pattern: /\bgetActiveTabId\b/g, message: 'Do not keep or consume getActiveTabId; derive active tab from session state.' },
  { pattern: /\bgetExpandedSectorId\b/g, message: 'Do not keep or consume getExpandedSectorId; use expandedSectorId directly.' },
  { pattern: /\bgetTitleModel\b/g, message: 'Do not keep or consume getTitleModel; assemble title model in presenter.' },
  { pattern: /\bgetToolbarStation\b/g, message: 'Do not keep or consume getToolbarStation; map station data from stationState.' },
  { pattern: /\bgetToolbarRaces\b/g, message: 'Do not keep or consume getToolbarRaces; use presenter-side option tables.' },
  { pattern: /\bgetToolbarStationTypes\b/g, message: 'Do not keep or consume getToolbarStationTypes; use presenter-side option tables.' },
  { pattern: /\bgetAvailableMinerals\b/g, message: 'Do not keep or consume getAvailableMinerals; use presenter-side option tables.' },
  { pattern: /\bgetSingleBerthThroughput\b/g, message: 'Do not keep or consume getSingleBerthThroughput; derive from formal settings.' },
  { pattern: /\bgetEnforceDlcActivation\b/g, message: 'Do not keep or consume getEnforceDlcActivation; read the formal state field directly.' },
  { pattern: /\bgetWareflowViewMode\b/g, message: 'Do not keep or consume getWareflowViewMode; read session.wareflowViewMode directly.' },
  { pattern: /\bgetEmpireGaps\b/g, message: 'Do not keep or consume getEmpireGaps; read stationState.empireGaps directly.' },
  { pattern: /\bgetCurrentEfficiency\b/g, message: 'Do not keep or consume getCurrentEfficiency; read stationState.currentEfficiency directly.' },
  { pattern: /\bgetActualWorkforce\b/g, message: 'Do not keep or consume getActualWorkforce; read stationState.actualWorkforce directly.' },
  { pattern: /\bgetBuildPriceMultiplier\b/g, message: 'Do not keep or consume getBuildPriceMultiplier; read stationState.buildPriceMultiplier directly.' }
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
