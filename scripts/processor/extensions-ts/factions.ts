import { a, tags, library, nodes, descendants, collect } from './common'
import type { ExtensionLoader, Row } from './common'
import { readXml } from '../shared-ts/xml'
export function processFactions(loader: ExtensionLoader, paths?: Record<string, string>): void {
  const input = (name: string): Row | undefined => {
    if (paths !== undefined && paths[`${name}-xml`] !== undefined) {
      const document = readXml(paths[`${name}-xml`]!)
      return Object.entries(document).find(([key]) => !key.startsWith('?'))?.[1] as Row
    }
    return library(loader.raw_path, 'libraries', name, 'final.xml')
  }
  const root = input('factions')
  const colors = input('colors')
  const palette: Record<string, string> = {}
  if (colors) {
    for (const n of descendants({ root: colors }, 'color')) {
      const id = a(n, 'id').trim()
      if (id) palette[id] = '#' + ['r', 'g', 'b'].map(k => Math.trunc(Number(a(n, k, '0'))).toString(16).toUpperCase().padStart(2, '0')).join('')
    }
    for (const n of descendants(colors, 'mapping')) if (a(n, 'id') && palette[a(n, 'ref')]) palette[a(n, 'id')] = palette[a(n, 'ref')]
  }
  loader.factions_data = root ? nodes(root.faction).filter(n => a(n, 'id').trim()).map(n => {
    const nameId = a(n, 'name').trim(), t = tags(a(n, 'tags')), color_name = a(n.color, 'ref')
    collect(loader.needed_raw_names, nameId)
    const licences = nodes(n.licences?.licence).filter(l => !a(l, 'factions').trim() && a(l, 'name').trim()).map(l => {
      const entry: Row = { type: a(l, 'type').trim(), nameId: a(l, 'name').trim(), name: '' }
      const relation = a(l, 'minrelation')
      if (relation && Number.isFinite(Number(relation))) entry.minrelation = Number(relation)
      collect(loader.needed_raw_names, entry.nameId)
      return entry
    })
    const entry: Row = { id: a(n, 'id').trim(), name: '', nameId, tags: t, color_name, color: palette[color_name] ?? '#4b5563', claimspace: t.includes('claimspace'), licences, noblueprintsale: t.includes('noblueprintsale') || t.includes('nodiplomacyselection') }
    if (t.includes('nodiplomacyselection')) entry.nodiplomacyselection = true
    return entry
  }).sort((x,y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0) : []
}
