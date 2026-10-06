export const GAS_WARES = new Set(['hydrogen', 'helium', 'methane', 'argon', 'coolant'])
export const isGasWare = (ware: string) => GAS_WARES.has(ware.toLowerCase())
export function asNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || typeof value === 'object') return defaultValue
  if (typeof value === 'string' && value.trim() === '') return defaultValue
  const number = Number(value)
  return Number.isNaN(number) ? defaultValue : number
}
function splineLength(spline: Record<string, any>[]): number {
  let length = 0
  for (let i = 0; i < spline.length - 1; i++) {
    const a = spline[i]!, b = spline[i + 1]!
    const dx = asNumber(b.x) - asNumber(a.x), dy = asNumber(b.y) - asNumber(a.y), dz = asNumber(b.z) - asNumber(a.z)
    length += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return length
}
export function calculateSolidVolumeTruncated(boundary: Record<string, any>): [number, number] {
  const size = boundary.size === undefined ? {} : boundary.size, radius = asNumber(size.r), cap = Math.min(radius, 1024000)
  switch (boundary.class) {
    case 'sphere': return [(4 / 3) * Math.PI * radius ** 3, (4 / 3) * Math.PI * cap ** 3]
    case 'cylinder': {
      const linear = asNumber(size.linear)
      return [Math.PI * radius ** 2 * (linear * 2), Math.PI * cap ** 2 * Math.min(linear * 2, 2048000)]
    }
    case 'splinetube': {
      const length = splineLength(boundary.spline === undefined ? [] : boundary.spline)
      return [Math.PI * radius ** 2 * length, Math.PI * cap ** 2 * Math.min(length, 2048000)]
    }
    case 'box': {
      const x = asNumber(size.x) / 2, y = asNumber(size.y) / 2, z = asNumber(size.z) / 2
      return [(x * 2) * (y * 2) * (z * 2), (Math.min(x, 1024000) * 2) * (Math.min(y, 1024000) * 2) * (Math.min(z, 1024000) * 2)]
    }
    default: return [1, 1]
  }
}
export const calculateSolidVolumeKm3 = (boundary: Record<string, any>) => calculateSolidVolumeTruncated(boundary)[1] / 1e9
export function calculateGasVolumeKm3(_position: Record<string, any>, boundary: Record<string, any>): [number, number] {
  const size = boundary.size === undefined ? {} : boundary.size, radius = asNumber(size.r), volume = 64 ** 3
  switch (boundary.class) {
    case 'sphere': {
      const blocks = Math.ceil(radius / 32000), effective = Math.min(blocks, 16)
      return [(2 * blocks + 1) ** 3 * volume, (2 * effective + 1) ** 3 * volume]
    }
    case 'cylinder': {
      const r = Math.ceil(radius / 64000) * 2 + 1, h = Math.ceil(asNumber(size.linear) / 64000)
      return [r * r * h * volume, Math.min(r, 33) * Math.min(r, 33) * Math.min(h, 33) * volume]
    }
    case 'splinetube': {
      const r = Math.ceil(radius / 64000) * 2 + 1, length = Math.max(1, Math.trunc(splineLength(boundary.spline === undefined ? [] : boundary.spline) / 64000))
      return [r * r * length * volume, Math.min(r, 33) * Math.min(r, 33) * Math.min(length, 32) * volume]
    }
    case 'box': {
      const x = Math.ceil(asNumber(size.x) / 64000), y = Math.ceil(asNumber(size.y) / 64000), z = Math.ceil(asNumber(size.z) / 64000)
      return [x * y * z * volume, Math.min(x, 32) * Math.min(y, 32) * Math.min(z, 32) * volume]
    }
    default: return [1, 1]
  }
}
export function calculateGasBlockCount(position: Record<string, any>, boundary: Record<string, any>): [number, number] {
  if (!['sphere', 'cylinder', 'splinetube', 'box'].includes(boundary.class)) return [1, 0]
  const [total, effective] = calculateGasVolumeKm3(position, boundary)
  return [Math.max(1, total / 64 ** 3), Math.max(0, effective / 64 ** 3)]
}
export function estimateSolidYield(boundary: Record<string, any>, factor: number, density: number, delay: number): [number, number] {
  const reserve = calculateSolidVolumeKm3(boundary) * factor * density
  return [reserve, delay > 0 ? reserve * 60 / delay : 0]
}
export function estimateGasYield(position: Record<string, any>, boundary: Record<string, any>, factor: number, density: number, delay: number): [number, number] {
  const reserve = calculateGasVolumeKm3(position, boundary)[1] * factor * density / 64 ** 3
  return [reserve, delay > 0 ? reserve * 60 / delay : 0]
}
