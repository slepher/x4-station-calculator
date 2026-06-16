import { differenceCiede2000, parse as parseColor, converter } from 'culori'
import type { GroupDraftInfo } from './autoGroup'

const deltaE = differenceCiede2000()
const toOklch = converter('oklch')

export const HUB_PALETTE: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF', '#FFFFFF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF', '#000000',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E', 'transparent',
]

export const HUB_COLORFUL: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E',
]

export interface HubColorContext {
  getFactionColor: (sectorMacro: string) => string | undefined
  getDistance: (from: string, to: string) => number | null
  maxHop: number
}

// ══════════════════════════════════════════════════════
// Thresholds
// ══════════════════════════════════════════════════════

type DistinctLevel = 'excellent' | 'good' | 'acceptable' | 'similar' | 'conflict'

const COLOR_THRESHOLDS = {
  excellent: { deltaE: 25, hue: 30 },
  good: { deltaE: 20, hue: 24 },
  acceptable: { deltaE: 15, hue: 18 },
  conflict: { deltaE: 10, hue: 10 },
  minChromaForHue: 0.05,
} as const

function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff)
}

function getOklchHue(color: string): number | undefined {
  const p = parseColor(color)
  if (!p) return undefined
  const oklch = toOklch(p) as { h?: number } | undefined
  return oklch?.h
}

function getOklchChroma(color: string): number | undefined {
  const p = parseColor(color)
  if (!p) return undefined
  const oklch = toOklch(p) as { c?: number } | undefined
  return oklch?.c
}

function computeHueDist(a: string, b: string): number | undefined {
  const ha = getOklchHue(a)
  const hb = getOklchHue(b)
  if (ha === undefined || hb === undefined) return undefined
  return hueDistance(ha, hb)
}

function shouldUseHue(a: string, b: string): boolean {
  const ca = getOklchChroma(a)
  const cb = getOklchChroma(b)
  return (ca ?? 0) >= COLOR_THRESHOLDS.minChromaForHue
    && (cb ?? 0) >= COLOR_THRESHOLDS.minChromaForHue
}

function classifyColorDistance(de: number, hueDist: number, useHue: boolean): DistinctLevel {
  const h = useHue ? hueDist : Infinity

  if (de < COLOR_THRESHOLDS.conflict.deltaE || h < COLOR_THRESHOLDS.conflict.hue) return 'conflict'
  if (de < COLOR_THRESHOLDS.acceptable.deltaE || h < COLOR_THRESHOLDS.acceptable.hue) return 'similar'
  if (de >= COLOR_THRESHOLDS.excellent.deltaE && h >= COLOR_THRESHOLDS.excellent.hue) return 'excellent'
  if (de >= COLOR_THRESHOLDS.good.deltaE && h >= COLOR_THRESHOLDS.good.hue) return 'good'
  return 'acceptable'
}

function colorIsConflict(candidate: string, target: string): boolean {
  const de = colorDeltaE(candidate, target)
  const useHue = shouldUseHue(candidate, target)
  const hd = useHue ? (computeHueDist(candidate, target) ?? 0) : Infinity
  return classifyColorDistance(de, hd, useHue) === 'conflict'
}

// ══════════════════════════════════════════════════════
// Utilities
// ══════════════════════════════════════════════════════

function colorDeltaE(a: string, b: string): number {
  const pa = parseColor(a)
  const pb = parseColor(b)
  if (!pa || !pb) return Infinity
  return deltaE(pa, pb)
}

function getSelfFactionColors(group: GroupDraftInfo, ctx: HubColorContext): string[] {
  const colors: string[] = []
  if (group.sectorMacro) {
    const c = ctx.getFactionColor(group.sectorMacro)
    if (c) colors.push(c)
  }
  for (const sectorMacro of group.coverageSectorMacros) {
    const c = ctx.getFactionColor(sectorMacro)
    if (c) colors.push(c)
  }
  return colors
}

function isWithin5Hop(group: GroupDraftInfo, other: GroupDraftInfo, ctx: HubColorContext): boolean {
  if (!group.sectorMacro || !other.sectorMacro) return false
  const dist = ctx.getDistance(group.sectorMacro, other.sectorMacro)
  return dist !== null && dist <= ctx.maxHop
}

function get5HopContextColors(
  group: GroupDraftInfo,
  allGroups: GroupDraftInfo[],
  ctx: HubColorContext
): string[] {
  const colors: string[] = []
  for (const other of allGroups) {
    if (other.id === group.id) continue
    if (!isWithin5Hop(group, other, ctx)) continue
    if (other.color) colors.push(other.color)
    if (other.sectorMacro) {
      const fc = ctx.getFactionColor(other.sectorMacro)
      if (fc) colors.push(fc)
    }
  }
  return [...new Set(colors)]
}

// ══════════════════════════════════════════════════════
// Candidate filtering
// ══════════════════════════════════════════════════════

function passesThreshold(
  candidate: string,
  targets: string[],
  level: { deltaE: number; hue: number }
): boolean {
  return targets.every((t) => {
    const de = colorDeltaE(candidate, t)
    if (de < level.deltaE) return false
    const useHue = shouldUseHue(candidate, t)
    if (useHue) {
      const hd = computeHueDist(candidate, t) ?? 0
      if (hd < level.hue) return false
    }
    return true
  })
}

function filterCandidates(targets: string[]): string[] {
  const filterLevels = [
    COLOR_THRESHOLDS.good,
    COLOR_THRESHOLDS.acceptable,
    COLOR_THRESHOLDS.conflict,
  ]

  for (const level of filterLevels) {
    const candidates = HUB_COLORFUL.filter((c) => passesThreshold(c, targets, level))
    if (candidates.length >= 5) return candidates
  }
  return HUB_COLORFUL.filter((c) => passesThreshold(c, targets, COLOR_THRESHOLDS.conflict))
}

// ══════════════════════════════════════════════════════
// Scoring
// ══════════════════════════════════════════════════════

function colorScore(candidate: string, targets: string[]): number {
  if (targets.length === 0) return Infinity
  let minScore = Infinity
  for (const t of targets) {
    const de = colorDeltaE(candidate, t)
    const useHue = shouldUseHue(candidate, t)
    const hd = useHue ? (computeHueDist(candidate, t) ?? 0) : 0
    const s = de + hd * 0.8
    if (s < minScore) minScore = s
  }
  return minScore
}

function maximin(candidates: string[], avoidColors: string[]): string {
  if (candidates.length === 0) return generateRandomColor()
  let best = candidates[0]!
  let bestScore = -Infinity
  for (const candidate of candidates) {
    const score = colorScore(candidate, avoidColors)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

// ══════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════

export function pickHubColor(
  group: GroupDraftInfo,
  allGroups: GroupDraftInfo[],
  fixedColors: string[],
  ctx: HubColorContext
): string {
  const selfFactionColors = getSelfFactionColors(group, ctx)

  // Stage 1: avoid self faction colors
  if (selfFactionColors.length === 0) {
    // No faction colors to avoid, use all colorful candidates
    const candidates = [...HUB_COLORFUL]
    if (candidates.length === 0) return generateRandomColor()
    const fiveHopAvoid = get5HopContextColors(group, allGroups, ctx)
    const allAvoid = [...new Set([...fixedColors, ...fiveHopAvoid])]
    return maximin(candidates, allAvoid)
  }

  const candidates = filterCandidates(selfFactionColors)

  if (candidates.length === 0) {
    return generateRandomColor()
  }

  // Stage 2: avoid 5-hop hub context
  const fiveHopAvoid = get5HopContextColors(group, allGroups, ctx)
  const allAvoid = [...new Set([...fixedColors, ...fiveHopAvoid])]

  // Try levels from excellent down to conflict
  const stage2Levels = [
    COLOR_THRESHOLDS.good,
    COLOR_THRESHOLDS.acceptable,
    COLOR_THRESHOLDS.conflict,
  ]
  for (const level of stage2Levels) {
    const valid = candidates.filter((c) => passesThreshold(c, allAvoid, level))
    if (valid.length > 0) {
      return maximin(valid, allAvoid)
    }
  }

  return maximin(candidates, allAvoid)
}

function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360)
  const saturation = Math.floor(Math.random() * 30 + 50)
  const lightness = Math.floor(Math.random() * 30 + 35)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function stabilizeHubColors(
  groups: GroupDraftInfo[],
  ctx: HubColorContext
): void {
  const fixedColors: string[] = []
  const reassign: boolean[] = new Array(groups.length).fill(false)

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!
    if (!group.color) {
      reassign[i] = true
      continue
    }

    // Check self faction color conflict
    const selfFactionColors = getSelfFactionColors(group, ctx)
    let conflicts = false
    for (const fc of selfFactionColors) {
      if (colorIsConflict(group.color, fc)) { conflicts = true; break }
    }
    if (conflicts) { reassign[i] = true; continue }

    // Check conflict with 5-hop hubs' already-fixed colors
    for (let j = 0; j < i; j++) {
      if (reassign[j]) continue
      const other = groups[j]!
      if (!other.color) continue
      if (!isWithin5Hop(group, other, ctx)) continue
      if (colorIsConflict(group.color, other.color)) { conflicts = true; break }
    }
    if (conflicts) { reassign[i] = true; continue }

    fixedColors.push(group.color)
  }

  for (let i = 0; i < groups.length; i++) {
    if (!reassign[i]) continue
    const group = groups[i]!
    group.color = pickHubColor(group, groups, fixedColors, ctx)
    fixedColors.push(group.color)
  }
}

export function stabilizeEditedHubColor(
  group: GroupDraftInfo,
  allGroups: GroupDraftInfo[],
  ctx: HubColorContext
): void {
  const otherFixedColors = allGroups
    .filter((g) => g.id !== group.id)
    .map((g) => g.color)
    .filter(Boolean) as string[]

  if (!group.color) {
    group.color = pickHubColor(group, allGroups, otherFixedColors, ctx)
    return
  }

  const selfFactionColors = getSelfFactionColors(group, ctx)
  for (const fc of selfFactionColors) {
    if (colorIsConflict(group.color, fc)) {
      group.color = pickHubColor(group, allGroups, otherFixedColors, ctx)
      return
    }
  }

  for (const other of allGroups) {
    if (other.id === group.id) continue
    if (!other.color) continue
    if (!isWithin5Hop(group, other, ctx)) continue
    if (colorIsConflict(group.color, other.color)) {
      group.color = pickHubColor(group, allGroups, otherFixedColors, ctx)
      return
    }
  }
}
