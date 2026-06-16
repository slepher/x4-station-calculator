import { differenceCiede2000, parse as parseColor } from 'culori'
import type { GroupDraftInfo } from './autoGroup'

const deltaE = differenceCiede2000()

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

function maximin(candidates: string[], avoidColors: string[]): string {
  if (candidates.length === 0) return generateRandomColor()
  let best = candidates[0]!
  let bestMinDist = -Infinity
  for (const candidate of candidates) {
    const pc = parseColor(candidate)
    if (!pc) continue
    const dists = avoidColors.length === 0
      ? [Infinity]
      : avoidColors.map((c) => {
          const pc2 = parseColor(c)
          return pc2 ? deltaE(pc, pc2) : Infinity
        })
    const minDist = Math.min(...dists)
    if (minDist > bestMinDist) {
      bestMinDist = minDist
      best = candidate
    }
  }
  return best
}

export function pickHubColor(
  group: GroupDraftInfo,
  allGroups: GroupDraftInfo[],
  fixedColors: string[],
  ctx: HubColorContext
): string {
  const selfFactionColors = getSelfFactionColors(group, ctx)

  // Stage 1: avoid self faction colors with gradual threshold relaxation
  let candidates: string[] = []
  const thresholds = [20, 15, 10, 5, 0]
  for (const threshold of thresholds) {
    candidates = HUB_COLORFUL.filter((paletteColor) =>
      selfFactionColors.every((fc) => colorDeltaE(paletteColor, fc) >= threshold)
    )
    if (candidates.length >= 5 || threshold === 0) break
  }

  if (candidates.length === 0) {
    return generateRandomColor()
  }

  // Stage 2: avoid 5-hop hub context with gradual threshold relaxation
  const fiveHopAvoid = get5HopContextColors(group, allGroups, ctx)
  const allAvoid = [...new Set([...fixedColors, ...fiveHopAvoid])]
  const stage2Thresholds = [20, 15, 10, 5]
  for (const threshold of stage2Thresholds) {
    const valid = candidates.filter((candidate) =>
      allAvoid.every((ac) => colorDeltaE(candidate, ac) >= threshold)
    )
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
  // Stage 0: sequential keep decision
  // fixedColors holds colors that have been confirmed as "keep"
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
      if (colorDeltaE(group.color, fc) <= 5) { conflicts = true; break }
    }
    if (conflicts) { reassign[i] = true; continue }

    // Check conflict with 5-hop hubs' already-fixed colors
    for (let j = 0; j < i; j++) {
      if (reassign[j]) continue
      const other = groups[j]!
      if (!other.color) continue
      if (!isWithin5Hop(group, other, ctx)) continue
      if (colorDeltaE(group.color, other.color) <= 5) { conflicts = true; break }
    }
    if (conflicts) { reassign[i] = true; continue }

    fixedColors.push(group.color)
  }

  // Phase 1: reassign colors to groups that need it
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

  // New hub with no color → assign
  if (!group.color) {
    group.color = pickHubColor(group, allGroups, otherFixedColors, ctx)
    return
  }

  // Check self faction color conflict
  const selfFactionColors = getSelfFactionColors(group, ctx)
  for (const fc of selfFactionColors) {
    if (colorDeltaE(group.color, fc) <= 5) {
      group.color = pickHubColor(group, allGroups, otherFixedColors, ctx)
      return
    }
  }

  // Check 5-hop hub color conflict (against other hubs' fixed colors)
  for (const other of allGroups) {
    if (other.id === group.id) continue
    if (!other.color) continue
    if (!isWithin5Hop(group, other, ctx)) continue
    if (colorDeltaE(group.color, other.color) <= 5) {
      group.color = pickHubColor(group, allGroups, otherFixedColors, ctx)
      return
    }
  }

  // No conflict → keep current color
}
