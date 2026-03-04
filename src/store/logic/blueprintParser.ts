import type { X4Module } from '@/types/x4'

export interface ParsedXmlBlueprint {
  counts: Record<string, number>
  name: string
}

/**
 * 从 XML 内容中提取模块宏定义
 * @param xmlContent XML 字符串内容
 * @returns 模块ID和数量的映射
 */
export function parseXmlBlueprint(xmlContent: string): Record<string, number> {
  const counts: Record<string, number> = {}
  const matchMacro = /macro="([^"]+)"/g
  let match: RegExpExecArray | null

  while ((match = matchMacro.exec(xmlContent)) !== null) {
    const macro = match[1]
    if (!macro) continue

    // 过滤掉武器、盾牌等升级组件，只统计站台模块本身
    if (macro.includes('turret_') || macro.includes('shield_') || macro.includes('missile_')) {
      continue
    }

    counts[macro] = (counts[macro] || 0) + 1
  }

  return counts
}

/**
 * 从 XML 内容中提取模块与蓝图名称
 * 名称优先从顶层 plan/entry 标签读取
 */
export function parseXmlBlueprintMeta(xmlContent: string): ParsedXmlBlueprint {
  const counts = parseXmlBlueprint(xmlContent)

  const nameMatch =
    /<(?:plan|entry)\b[^>]*\bname="([^"]+)"/i.exec(xmlContent)
    || /<(?:blueprint)\b[^>]*\bname="([^"]+)"/i.exec(xmlContent)

  const name = (nameMatch?.[1] || '').trim()
  return { counts, name }
}

/**
 * 检查输入是否为 XML 格式
 * @param input 输入字符串
 * @returns 是否为 XML 格式
 */
export function isXmlFormat(input: string): boolean {
  return input.startsWith('<') || input.includes('xml version') || input.includes('<entry')
}

/**
 * 从 x4-game.com 分享链接中解析模块信息
 * @param urlContent URL 编码或解码的内容
 * @returns 模块ID和数量的映射
 */
export function parseGameComLink(urlContent: string): Record<string, number> {
  let decoded = decodeURIComponent(urlContent)
  const urlMatch = /l=@?([^&]+)/.exec(decoded) || [null, decoded]
  let paramStr = urlMatch[1] || ''

  if (paramStr.startsWith('@')) {
    paramStr = paramStr.substring(1)
  }

  const counts: Record<string, number> = {}
  const parts = paramStr.split(/[;]+/)

  parts.forEach(part => {
    if (!part.includes('$module-')) return

    const idMatch = /\$module-([^,]+)/.exec(part)
    const countMatch = /count:(\d+)/.exec(part)

    if (idMatch && idMatch[1]) {
      const id = idMatch[1]
      const count = countMatch && countMatch[1] ? parseInt(countMatch[1], 10) : 1
      counts[id] = (counts[id] || 0) + count
    }
  })

  return counts
}

/**
 * 将解析出的模块ID映射到实际的模块宏定义
 * 采用多策略匹配：直接匹配 -> 添加后缀 -> 简单转换 -> wareId 查找
 * @param parsedId 解析出的模块ID
 * @param modulesMap 模块映射表
 * @returns 实际的模块ID，如果找不到返回 null
 */
export function resolveModuleId(
  parsedId: string,
  modulesMap: Record<string, X4Module>,
  modulesByMacroId?: Record<string, X4Module>
): string | null {
  const raw = parsedId.trim()
  if (!raw) return null

  if (modulesMap[raw]) return raw

  const macroMap = modulesByMacroId || Object.values(modulesMap).reduce<Record<string, X4Module>>((acc, module) => {
    if (module.macroId) acc[module.macroId] = module
    return acc
  }, {})
  const modulesList = Object.values(modulesMap)

  const byMacro = macroMap[raw]
  if (byMacro) return byMacro.id

  const candidates = new Set<string>()
  candidates.add(raw)
  candidates.add(raw.replace(/^@/, ''))
  candidates.add(raw.replace(/^module-/, ''))
  if (!raw.endsWith('_macro')) candidates.add(`${raw}_macro`)
  if (raw.startsWith('module_')) {
    const stripped = raw.replace(/^module_/, '')
    candidates.add(stripped)
    candidates.add(`${stripped}_macro`)
  }
  if (raw.endsWith('_macro')) {
    candidates.add(raw.slice(0, -6))
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    if (modulesMap[candidate]) return candidate
    const matchedMacro = macroMap[candidate]
    if (matchedMacro) return matchedMacro.id
    const matchedWare = modulesList.find(module => module.wareId === candidate)
    if (matchedWare) return matchedWare.id
  }

  return null
}
