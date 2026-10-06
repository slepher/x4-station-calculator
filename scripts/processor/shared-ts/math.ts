export function roundHalfEven(value: number, digits = 0): number {
  if (!Number.isFinite(value) || value === 0) return value
  if (!Number.isInteger(digits)) throw new Error('Rounding digits must be an integer')
  if (digits > 323) return value
  if (digits < -308) return 0
  const buffer = new DataView(new ArrayBuffer(8))
  buffer.setFloat64(0, Math.abs(value))
  const bits = buffer.getBigUint64(0)
  const exponent = Number((bits >> 52n) & 2047n)
  let numerator = bits & ((1n << 52n) - 1n)
  let power = -1074
  if (exponent !== 0) { numerator += 1n << 52n; power = exponent - 1075 }
  let denominator = 1n
  if (power >= 0) numerator <<= BigInt(power)
  else denominator <<= BigInt(-power)
  if (digits >= 0) numerator *= 10n ** BigInt(digits)
  else denominator *= 10n ** BigInt(-digits)
  let rounded = numerator / denominator
  const remainder = numerator % denominator
  if (remainder * 2n > denominator || (remainder * 2n === denominator && rounded % 2n !== 0n)) rounded++
  const result = Number(`${rounded}e${-digits}`)
  return value < 0 ? -result : result
}
