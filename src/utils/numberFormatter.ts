/**
 * 格式化数字显示
 *
 * 规则：
 * - < 1：保留 2 位有效数字（如 0.000045）
 * - ≥ 1 且 < 10：保留 2 位小数（如 9.87）
 * - ≥ 10 且 < 1000：显示整数（如 123）
 * - ≥ 1000：显示带单位的格式（K/M/B/T/P），保留 2 位小数（如 12.34K）
 */
export function formatNumber(value: number): string {
  if (value < 0) {
    return `-${formatNumber(Math.abs(value))}`
  }

  if (value < 1) {
    // 2 位有效数字
    return value.toPrecision(2)
  }

  if (value < 10) {
    // 2 位小数
    return value.toFixed(2)
  }

  if (value < 1000) {
    // 整数
    return Math.round(value).toString()
  }

  // 大数值，使用单位后缀
  const units = [
    { threshold: 1e15, suffix: 'P' },  // Quadrillion
    { threshold: 1e12, suffix: 'T' },  // Trillion
    { threshold: 1e9, suffix: 'B' },   // Billion
    { threshold: 1e6, suffix: 'M' },   // Million
    { threshold: 1e3, suffix: 'K' }    // Thousand
  ]

  for (const unit of units) {
    if (value >= unit.threshold) {
      const divided = value / unit.threshold
      return `${divided.toFixed(2)}${unit.suffix}`
    }
  }

  // Should not reach here, but fallback
  return value.toFixed(2)
}
