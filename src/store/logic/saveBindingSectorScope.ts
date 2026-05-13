import type { BindingSectorGroup } from '@/types/x4'

export interface BindingSectorScope {
  anchorSectorMacro: string | null
  coverageSectorMacros: string[]
  sectorMacros: string[]
}

function normalizeSectorMacro(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

export function resolveBindingSectorScope(
  group: Pick<BindingSectorGroup, 'sectorMacro' | 'coverageSectorMacros'> | null | undefined
): BindingSectorScope {
  const anchorSectorMacro = normalizeSectorMacro(group?.sectorMacro)
  const sectorMacros = new Set<string>()
  if (anchorSectorMacro) sectorMacros.add(anchorSectorMacro)

  const coverageSectorMacros: string[] = []
  ;(group?.coverageSectorMacros || []).forEach((entry) => {
    const ref = normalizeSectorMacro(entry.ref)
    if (!ref) return
    coverageSectorMacros.push(ref)
    sectorMacros.add(ref)
  })

  return {
    anchorSectorMacro,
    coverageSectorMacros,
    sectorMacros: Array.from(sectorMacros)
  }
}

export function isSectorMacroInBindingScope(
  group: Pick<BindingSectorGroup, 'sectorMacro' | 'coverageSectorMacros'> | null | undefined,
  sectorMacro: string | null | undefined
): boolean {
  const normalizedSectorMacro = normalizeSectorMacro(sectorMacro)
  if (!normalizedSectorMacro) return false
  return resolveBindingSectorScope(group).sectorMacros.includes(normalizedSectorMacro)
}
