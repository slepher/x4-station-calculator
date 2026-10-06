import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { orderedText, readOrderedXml, type XmlNode } from './xml'

export type LangConfig = Record<string, { iso: string; name?: string }>
export const X4_LANG_CONFIG: LangConfig = {
  '044': { iso: 'en' }, '086': { iso: 'zh-CN' }, '088': { iso: 'zh-TW' },
  '049': { iso: 'de' }, '033': { iso: 'fr' }, '039': { iso: 'it' },
  '034': { iso: 'es' }, '007': { iso: 'ru' }, '081': { iso: 'ja' },
  '082': { iso: 'ko' }, '055': { iso: 'pt-BR' }, '048': { iso: 'pl' }
}

function stripParenthetical(text: string): string {
  let depth = 0
  let result = ''
  for (const char of text) {
    if (char === '(') depth++
    else if (char === ')') { if (depth > 0) depth-- }
    else if (depth === 0) result += char
  }
  return result
}

function stripLeadingDuplicate(text: string): string {
  if (!text.startsWith('(') && !text.startsWith('（')) return text
  const open = text[0]!
  const close = open === '(' ? ')' : '）'
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close && --depth === 0) {
      const inner = text.slice(1, i).trim()
      const rest = text.slice(i + 1).trim()
      if (rest && (inner.replace(/\s+/g, ' ') === rest.replace(/\s+/g, ' ') || /[A-Za-z0-9\u4e00-\u9fff]/.test(rest))) return rest
      return text
    }
  }
  return text
}

export class I18nRegistry {
  private rawPath = ''
  private langConfig: LangConfig = {}
  private lookups = new Map<string, Map<string, string>>()
  private resolved = new Map<string, Map<string, string>>()
  private collected = new Set<string>()
  private missing = new Map<string, Set<string>>()

  configure(rawPath: string, langConfig: LangConfig): void {
    if (rawPath === this.rawPath && JSON.stringify(langConfig) === JSON.stringify(this.langConfig)) return
    this.rawPath = rawPath
    this.langConfig = structuredClone(langConfig)
    this.lookups.clear(); this.resolved.clear(); this.collected.clear(); this.missing.clear()
  }

  collect(nameId: string): void { if (nameId) this.collected.add(nameId) }
  collectMany(nameIds: Iterable<string>): void { for (const nameId of nameIds) this.collect(nameId) }
  getName(nameId: string, lang = 'en'): string { this.collect(nameId); return this.resolveText(nameId, lang) }
  missingKeys(lang: string): Set<string> { return new Set(this.missing.get(lang)) }
  exportCollected(lang: string): Record<string, string> {
    const output: Record<string, string> = {}
    for (const nameId of [...this.collected].sort()) {
      const value = this.resolveText(nameId, lang)
      if (value) output[nameId] = value
    }
    return output
  }

  private lookup(lang: string): Map<string, string> {
    const cached = this.lookups.get(lang)
    if (cached !== undefined) return cached
    const result = new Map<string, string>()
    const entry = Object.entries(this.langConfig).find(([, config]) => config.iso === lang)
    if (entry !== undefined && this.rawPath) {
      for (const letter of ['L', 'l']) {
        const path = join(this.rawPath, 't', `0001-${letter}${entry[0]}.xml`)
        if (!existsSync(path)) continue
        const tree = readOrderedXml(path)
        for (const root of tree) for (const page of (root.language ?? []) as XmlNode[]) {
          if (!page.page) continue
          const pageId = page[':@']?.['@_id']
          if (!pageId) continue
          for (const node of page.page as XmlNode[]) {
            const id = node[':@']?.['@_id']
            if (node.t && id) result.set(`${pageId},${id}`, orderedText(node.t))
          }
        }
        if (result.size > 0) break
      }
    }
    this.lookups.set(lang, result)
    return result
  }

  resolveText(text: string, lang = 'en', depth = 0, visiting = new Set<string>()): string {
    if (!text || depth > 10) return text
    let cache = this.resolved.get(lang)
    if (cache === undefined) { cache = new Map(); this.resolved.set(lang, cache) }
    const cached = cache.get(text)
    if (cached !== undefined) return cached
    const lookup = this.lookup(lang)
    if (lookup.size === 0) { cache.set(text, text); return text }
    const token = text.trim()
    if (visiting.has(token)) return text
    const next = new Set(visiting); next.add(token)
    const strip = /\{\s*\d+\s*,\s*\d+\s*\}/.test(text)
    let value = text.replaceAll('\\(', '(').replaceAll('\\)', ')').replace(/\{\s*(\d+)\s*,\s*(\d+)\s*\}/g, (match, page, id) => {
      const raw = lookup.get(`${page},${id}`)
      if (raw !== undefined) return this.resolveText(raw, lang, depth + 1, next)
      let missing = this.missing.get(lang)
      if (missing === undefined) { missing = new Set(); this.missing.set(lang, missing) }
      missing.add(`{${page},${id}}`)
      return match
    })
    value = value.replace(/\\033#[^#]*#/g, '').replace(/\\033./g, '').replaceAll('\\n', ' ')
    if (strip) value = stripParenthetical(value)
    value = value.replaceAll('\\', ' ')
    if (strip) value = stripLeadingDuplicate(value)
    value = value.replace(/\s+/g, ' ').trim()
    if (lang === 'zh-CN' || lang === 'zh-TW') {
      const pipe = value.includes('｜') ? '｜' : '|'
      if (value.includes(pipe)) value = value.slice(value.indexOf(pipe) + 1).trim()
    }
    cache.set(text, value)
    return value
  }
}
