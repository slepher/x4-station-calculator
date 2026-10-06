import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readXml, readOrderedXml, nodes } from '../shared-ts/xml'
export { nodes }
// XML and generated records have heterogeneous, domain-specific fields.
export type Row = Record<string, any>
export interface ExtensionLoader {
  raw_path: string
  needed_raw_names: Set<string>
  ware_dlc_tags: Record<string, string>
  component_to_ware: Record<string, string>
  ware_index: Record<string, Row>
  wares_data: Row[]
  // Optional current-run maps output for location-name resolution.
  maps_data?: Row
  factions_data?: Row[] | null
  terraforming_data?: Row | null
  research_data?: Row | null
  blueprints_data?: Row | null
}
export const a = (n: Row | undefined, key: string, missing = ''): string => n?.[`@_${key}`] ?? missing
export const integer = (v: unknown, missing: number | null = null): number | null => v != null && /^[-+]?\d+$/.test(String(v).trim()) ? Number(v) : missing
export const clean = (v: string): string => v.trim().replace(/^'+|'+$/g, '')
export const tags = (v: string): string[] => v.split(/\s+/).filter(Boolean)
const sourceOrder = Symbol('sourceOrder')
export function children(n: Row): [string, Row][] {
  const ordered = (n as any)?.[sourceOrder]
  if (ordered) return ordered
  return Object.entries(n).filter(([k]) => !k.startsWith('@_') && k !== '#text').flatMap(([k,v]) => nodes(v).map(child => [k,child] as [string,Row]))
}
export function descendants(n: Row, tag: string): Row[] {
  const result: Row[] = []
  for (const [key, child] of children(n)) {
    if (key === tag) result.push(child)
    if (child && typeof child === 'object') result.push(...descendants(child, tag))
  }
  return result
}
export function library(raw: string, ...parts: string[]): Row | undefined {
  const path = join(raw, ...parts)
  if (!existsSync(path)) return undefined
  if (parts[0] === 'md') {
    function convert(entries: Row[]): Row {
      const result: Row = {}, order: [string,Row][] = []
      Object.defineProperty(result,sourceOrder,{value:order})
      for (const entry of entries) for (const [key,value] of Object.entries(entry)) {
        if (key === ':@') continue
        if (key === '#text') { result[key] = value; continue }
        const child = convert(value as Row[])
        Object.assign(child,entry[':@'])
        if (result[key] === undefined) result[key] = child
        else if (Array.isArray(result[key])) result[key].push(child)
        else result[key] = [result[key],child]
        order.push([key,child])
      }
      return result
    }
    const document = convert(readOrderedXml(path).filter(n => !Object.keys(n).some(k => k.startsWith('?'))))
    return children(document)[0]?.[1]
  }
  const document = readXml(path)
  return Object.entries(document).find(([key]) => !key.startsWith('?'))?.[1] as Row
}
export function collect(set: Set<string>, ...ids: string[]) { for (const id of ids) if (id) set.add(id) }
export function uniqueAppend(list: string[], ...ids: string[]) { for (const id of ids) if (id && !list.includes(id)) list.push(id) }
