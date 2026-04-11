import type { SavedModule, X4Module } from '@/types/x4'
import {
  parseXmlBlueprint,
  isXmlFormat,
  parseGameComLink,
  resolveModuleId
} from './blueprintParser'
import { deepClone } from './stationComputeService'

export interface ImportResult {
  modules: SavedModule[]
  warnings: string[]
}

export interface ImportDeps {
  modulesMap: Record<string, X4Module>
  modulesByMacroId: Record<string, X4Module>
}

export function parseImportInput(
  input: string,
  deps: ImportDeps
): ImportResult {
  const raw = input.trim()
  if (!raw) {
    return { modules: [], warnings: ['Empty input'] }
  }

  const warnings: string[] = []
  let modules: SavedModule[] = []

  if (isXmlFormat(raw)) {
    const counts = parseXmlBlueprint(raw)
    const totalFound = Object.values(counts).reduce((sum, count) => sum + count, 0)
    if (totalFound > 0) {
      modules = resolveModulesFromCounts(counts, deps, warnings, 'XML')
    } else {
      warnings.push('No modules found in XML input')
    }
    return { modules, warnings }
  }

  const counts = parseGameComLink(raw)
  if (Object.keys(counts).length > 0) {
    modules = resolveModulesFromCounts(counts, deps, warnings, 'x4-game link')
    return { modules, warnings }
  }

  warnings.push('Unrecognized input format')
  return { modules, warnings }
}

function resolveModulesFromCounts(
  counts: Record<string, number>,
  deps: ImportDeps,
  warnings: string[],
  sourceName: string
): SavedModule[] {
  const modules: SavedModule[] = []

  Object.entries(counts).forEach(([id, count]) => {
    const resolvedId = resolveModuleId(id, deps.modulesMap, deps.modulesByMacroId)
    if (resolvedId) {
      modules.push({ id: resolvedId, count })
    } else {
      warnings.push(`[${sourceName}] Unresolved module id: ${id}`)
    }
  })

  return modules
}

export function mergeModules(
  existing: SavedModule[],
  newModules: SavedModule[]
): SavedModule[] {
  const result = deepClone(existing)
  const moduleMap = new Map<string, SavedModule>()
  result.forEach(m => moduleMap.set(m.id, m))

  newModules.forEach(newModule => {
    const existingModule = moduleMap.get(newModule.id)
    if (existingModule) {
      existingModule.count += newModule.count
    } else {
      result.push({ id: newModule.id, count: newModule.count })
    }
  })

  return result
}

export function replaceModules(
  newModules: SavedModule[]
): SavedModule[] {
  return deepClone(newModules)
}