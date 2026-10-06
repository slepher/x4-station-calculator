import { readFileSync } from 'node:fs'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export type XmlNode = Record<string, any>
const options = { ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false, trimValues: false }
const parser = new XMLParser(options)

export function parseXml(text: string): XmlNode {
  const validation = XMLValidator.validate(text)
  if (validation !== true) throw new Error(`Invalid XML: ${validation.err.msg}`)
  return parser.parse(text) as XmlNode
}

export function readXml(path: string): XmlNode {
  try { return parseXml(readFileSync(path, 'utf8')) }
  catch (error) { throw new Error(`XML ${path}: ${error instanceof Error ? error.message : String(error)}`) }
}

export function nodes<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

export function xmlText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(xmlText).join('')
  return Object.entries(value).filter(([key]) => !key.startsWith('@_')).map(([, child]) => xmlText(child)).join('')
}

export function readOrderedXml(path: string): XmlNode[] {
  const text = readFileSync(path, 'utf8')
  const validation = XMLValidator.validate(text)
  if (validation !== true) throw new Error(`XML ${path}: ${validation.err.msg}`)
  return new XMLParser({ ...options, preserveOrder: true }).parse(text) as XmlNode[]
}

export function orderedText(value: XmlNode[]): string {
  return value.map(node => Object.entries(node).filter(([key]) => key !== ':@').map(([key, child]) => {
    if (key === '#text') return String(child)
    if (Array.isArray(child)) return orderedText(child)
    return ''
  }).join('')).join('')
}
