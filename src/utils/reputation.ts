/**
 * X4 reputation mapping between internal raw values (-1.0 ~ 1.0) and display values (-30 ~ 30).
 *
 * Two-zone formula (matches game engine behavior):
 *   Neutral zone (|raw| <= 0.0032, display -5 ~ 5):
 *     display = raw / 0.00064  (linear, each 0.00064 step = 1 display point)
 *   Outside neutral zone (|raw| > 0.0032):
 *     display = sign(raw) * ceil(10 * log10(|raw| * 1000))
 */

const NEUTRAL_THRESHOLD = 0.0032
const LINEAR_FACTOR = 0.00064

export function rawToDisplayRelation(raw: number): number {
  if (raw === 0) return 0
  const abs = Math.abs(raw)
  if (abs <= NEUTRAL_THRESHOLD) {
    return Math.round(raw / LINEAR_FACTOR)
  }
  const sign = raw > 0 ? 1 : -1
  return sign * Math.floor(10 * Math.log10(abs * 1000))
}

export function rawToDisplayRelationOrNull(raw: number | undefined): number | null {
  if (raw == null || raw === 0) return null
  return rawToDisplayRelation(raw)
}

export function formatDisplayRelation(raw: number | undefined): string {
  if (raw == null) return ''
  if (raw === 0) return '0'
  const val = rawToDisplayRelation(raw)
  const prefix = val > 0 ? '+' : ''
  return prefix + String(val)
}
