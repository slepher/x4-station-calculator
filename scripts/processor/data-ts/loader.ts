import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readXml, readOrderedXml, orderedText, nodes } from '../shared-ts/xml'
import { I18nRegistry } from '../shared-ts/i18n'
import { roundHalfEven } from '../shared-ts/math'
import { writeJson } from '../shared-ts/io'

// XML intermediates retain string attributes; only domain numeric fields are converted.
type Row = Record<string, any>
type Table = Record<string, Row>
export const LANG_CONFIG = {
  '044': { iso: 'en', name: 'English' }, '086': { iso: 'zh-CN', name: '简体中文' },
  '088': { iso: 'zh-TW', name: '繁體中文' }, '049': { iso: 'de', name: 'Deutsch' },
  '033': { iso: 'fr', name: 'Français' }, '039': { iso: 'it', name: 'Italiano' },
  '034': { iso: 'es', name: 'Español' }, '007': { iso: 'ru', name: 'Русский' },
  '081': { iso: 'ja', name: '日本語' }, '082': { iso: 'ko', name: '한국어' },
  '055': { iso: 'pt-BR', name: 'Português (Brasil)' }, '048': { iso: 'pl', name: 'Polski' }
}
const SLOT_TAGS = ['standard', 'advanced', 'xenon', 'mining', 'missile', 'highpower']
const DLC_TARGETS = [
  ['ego_dlc_split', 'Split Vendetta', '600'], ['ego_dlc_terran', 'Cradle of Humanity', '600'],
  ['ego_dlc_pirate', 'Tides of Avarice', '600'], ['ego_dlc_boron', 'Kingdom End', '600'],
  ['ego_dlc_timelines', 'Timelines', '700'], ['ego_dlc_mini_01', 'Hyperion Pack', '750'],
  ['ego_dlc_mini_02', 'Envoy Pack', '800']
]
const SLOT_ORDER = ['engine', 'thruster', 'shield', 'weapon', 'turret']
const SIZE_RANK: Record<string, number> = { extralarge: 0, large: 1, medium: 2, small: 3 }
const sizeRank = (size: string): number => Object.hasOwn(SIZE_RANK, size) ? SIZE_RANK[size]! : 99
const first = (value: any): any => nodes(value)[0]
const a = (node: any, key: string, defaultValue: any = null): any => {
  const value = first(node)?.[`@_${key}`]
  return value === undefined ? defaultValue : value
}
const num = (node: any, key: string, defaultValue = 0): number => {
  const value = a(node, key)
  if (value === null || value === '') return defaultValue
  const result = Number(value)
  if (!Number.isFinite(result)) throw new Error(`Invalid numeric ${key}: ${value}`)
  return result
}
const tags = (text: string): string[] => text.trim() === '' ? [] : text.trim().split(/\s+/)
const numericFields = (node: any, keys: string[], defaultValue = 0): Row => Object.fromEntries(keys.map(key => [key, num(node, key, defaultValue)]))
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
const hex = (r: number, g: number, b: number): string => '#' + [r, g, b].map(value => value.toString(16).toUpperCase().padStart(2, '0')).join('')

export const roundProduction = (value: number): number => roundHalfEven(value, 2)

export class X4PrecisionLoader {
  raw_path: string
  output_root: string
  config: Row
  i18n_registry: I18nRegistry
  needed_raw_names = new Set<string>()
  valid_macros: Table = Object.create(null)
  all_modules: Row[] = []
  ships_data: Row[] = []
  equipments_data: Row[] = []
  wares_data: Row[] = []
  i18n_data: Record<string, Record<string, string>> = Object.create(null)
  recipes: Record<string, Table> = Object.create(null)
  race_consumption: Record<string, Table> = Object.create(null)
  module_groups_result: Row[] = []
  ware_tier_map: Record<string, number> = Object.create(null)
  all_methods = new Set<string>()
  colors_db: Record<string, string> = Object.create(null)
  mappings_db: Record<string, string> = Object.create(null)
  ware_index: Table = Object.create(null)
  component_to_ware: Record<string, string> = Object.create(null)
  ship_connections: Record<string, Row[]> = Object.create(null)
  ship_connections_raw: Record<string, Row[]> = Object.create(null)
  ship_macros: Table = Object.create(null)
  ship_connection_macros: Table = Object.create(null)
  ship_defaults: Table = Object.create(null)
  loadouts_map: Table = Object.create(null)
  shipgroup_by_macro: Record<string, string> = Object.create(null)
  ship_type_counts: Record<string, number> = Object.create(null)
  ship_type_key_map: Record<string, string> = Object.create(null)
  ship_types_data: Row[] = []
  ship_type_class_map: Record<string, Set<string>> = Object.create(null)
  ship_races_data: Row[] = []
  ship_slot_tags_by_type: Record<string, Set<string>> = Object.create(null)
  equipment_component_tags_by_name: Record<string, Set<string>> = Object.create(null)
  equipment_type_counts: Record<string, number> = Object.create(null)
  equipment_types_data: Row[] = []
  slot_tag_counts: Record<string, number> = Object.create(null)
  slot_tags_data: Row[] = []
  dlcs_data: Row[] = []
  missiles_data: Row[] = []
  bullets_data: Row[] = []
  drones_data: Row[] = []
  consumables_data: Row[] = []
  ship_max_stats: Table = Object.create(null)
  ware_dlc_tags: Record<string, string> = Object.create(null)
  regionyields_db: Table = Object.create(null)
  resource_map_colors: Table = Object.create(null)
  maps_data?: Row
  factions_data: Row[] | null = null
  terraforming_data: Row | null = null
  research_data: Row | null = null
  blueprints_data: Row | null = null
  private localePages: Record<string, [string, string][]> = Object.create(null)

  constructor(rawPath: string, outputRoot: string, config: Row) {
    if (!existsSync(rawPath)) throw new Error(`Missing raw data directory: ${rawPath}`)
    this.raw_path = rawPath
    this.output_root = outputRoot
    this.config = config
    this.i18n_registry = new I18nRegistry()
    this.i18n_registry.configure(rawPath, LANG_CONFIG)
  }

  libraryPath(name: string): string { return join(this.raw_path, 'libraries', name, 'final.xml') }
  private library(name: string): any { return this.readRoot(this.libraryPath(name)) }
  private readRoot(path: string): any {
    const document = readXml(path)
    const key = Object.keys(document).find(key => !key.startsWith('?') && !key.startsWith('@_'))
    if (key === undefined) throw new Error(`Missing XML root: ${path}`)
    return document[key]
  }
  private macros(file: string): Row[] { return nodes(this.readRoot(join(this.raw_path, 'libraries', file)).macro) }
  private collectName(name: string): void { if (name) this.needed_raw_names.add(name) }
  private dlc(wareId: string): string { return this.ware_dlc_tags[wareId] ?? 'base' }

  buildDatabase(): void {
    this.buildWareDlcTags()
    for (const key of Object.values<string>(this.config.module_types ?? {})) this.needed_raw_names.add(key)
    for (const ware of nodes(this.library('wares').ware)) {
      const id = a(ware, 'id'), rawName = a(ware, 'name', ''), rawTags = a(ware, 'tags', '')
      const transport = a(ware, 'transport')
      let group = a(ware, 'group', '')
      const productionTags = new Set<string>()
      const methodTags: Record<string, Set<string>> = Object.create(null)
      let noPlayerBuild = 0
      const productions = nodes(ware.production)
      if (id) this.ware_index[id] = { id, nameId: rawName, group, tags: rawTags, production_tags: [], production_methods: 0,
        production_noplayerbuild: 0, production_method_tags: {}, transport }
      const ref = a(ware.component, 'ref')
      if (ref && !(ref in this.component_to_ware)) this.component_to_ware[ref] = id
      if (id === 'bogas') group = 'agricultural'
      for (const prod of productions) {
        const method = a(prod, 'method', 'default'), values = tags(a(prod, 'tags', ''))
        const set = methodTags[method] ??= new Set()
        for (const tag of values) { productionTags.add(tag); set.add(tag) }
        if (values.includes('noplayerbuild')) noPlayerBuild++
        this.all_methods.add(method)
        const work = nodes(prod.effects).flatMap(effects => nodes(effects.effect)).find(effect => a(effect, 'type') === 'work')
        const recipe = { time: num(prod, 'time', 1), amount: num(prod, 'amount', 1), bonus: num(work, 'product'),
          inputs: Object.fromEntries(nodes(prod.primary).flatMap(primary => nodes(primary.ware)).map(input => [a(input, 'ware'), num(input, 'amount')])) }
        ;(this.recipes[id] ??= Object.create(null))[method] = recipe
      }
      if (id && (productionTags.size || productions.length)) Object.assign(this.ware_index[id], {
        production_tags: [...productionTags].sort(), production_methods: productions.length,
        production_noplayerbuild: noPlayerBuild,
        production_method_tags: Object.fromEntries(Object.entries(methodTags).map(([method, set]) => [method, [...set].sort()]))
      })
      if (transport === 'workunit' && ['workunit_idle', 'workunit_busy'].includes(id)) {
        const state = id === 'workunit_busy' ? 'busy' : 'idle'
        for (const prod of productions) {
          const method = a(prod, 'method', 'default'), time = num(prod, 'time', 600), amount = num(prod, 'amount', 200)
          ;(this.race_consumption[method] ??= Object.create(null))[state] = Object.fromEntries(nodes(prod.primary).flatMap(primary => nodes(primary.ware)).map(input =>
            [a(input, 'ware'), num(input, 'amount') / (amount * time) * 3600]))
        }
      }
      let valid = false
      if (['container', 'solid', 'liquid', 'condensate'].includes(transport) && !rawTags.includes('module') && ware.price !== undefined) {
        valid = true
        const data = { id, nameId: rawName, group, name: rawName, dlc_tag: this.dlc(id), transport,
          price: num(ware.price, 'average'), volume: num(ware, 'volume'), minPrice: num(ware.price, 'min'),
          maxPrice: num(ware.price, 'max'), transmutable: tags(rawTags).includes('transmutable') }
        if (id !== 'nividiumgems') this.wares_data.push(data)
      }
      if (rawTags.includes('module') && ref) {
        valid = true
        const prod = productions.find(prod => a(prod, 'method') === 'default')
        this.valid_macros[ref] = { module_ware_id: id, name_id: rawName,
          build_cost: Object.fromEntries(nodes(prod?.primary).flatMap(primary => nodes(primary.ware)).map(input => [a(input, 'ware'), num(input, 'amount')])),
          build_time: num(prod, 'time') }
      }
      if (valid) this.collectName(rawName)
    }
    this.needed_raw_names.add('{20102,2011}')
    this.calculateTiers()
    for (const ware of this.wares_data) ware.tier = this.ware_tier_map[ware.id] ?? null
  }

  private buildWareDlcTags(): void {
    const dir = join(this.raw_path, 'libraries', 'wares'), base = join(dir, 'base.xml')
    if (!existsSync(base)) return
    const baseDoc = readXml(base), rootKey = Object.keys(baseDoc).find(key => !key.startsWith('?'))!
    for (const ware of nodes(baseDoc[rootKey].ware)) if (a(ware, 'id')) this.ware_dlc_tags[a(ware, 'id')] = 'base'
    for (const id of this.config.dlc_order ?? []) {
      const name = id.startsWith('ego_') ? id.slice(4) : id, path = join(dir, `${name}.xml`)
      if (!existsSync(path)) continue
      const document = readXml(path)
      let wares: Row[] = []
      if (document[rootKey] !== undefined) wares = nodes(document[rootKey].ware)
      else if (document.diff !== undefined) wares = nodes(document.diff.add).filter(add => a(add, 'sel') === '/wares').flatMap(add => nodes(add.ware))
      for (const ware of wares) {
        const wareId = a(ware, 'id')
        if (wareId && !(wareId in this.ware_dlc_tags)) this.ware_dlc_tags[wareId] = name
      }
    }
  }

  calculateTiers(): void {
    const network = new Set(Object.keys(this.recipes))
    for (const methods of Object.values(this.recipes)) for (const recipe of Object.values(methods))
      for (const input of Object.keys(recipe.inputs)) network.add(input)
    const tier = (id: string, visited = new Set<string>()): number => {
      if (id in this.ware_tier_map) return this.ware_tier_map[id]!
      if (visited.has(id)) return 0
      const methods = this.recipes[id]
      if (!methods) return this.ware_tier_map[id] = 0
      visited.add(id)
      let max = -1
      for (const recipe of Object.values(methods)) for (const input of Object.keys(recipe.inputs)) max = Math.max(max, tier(input, visited))
      return this.ware_tier_map[id] = max >= 0 ? max + 1 : 0
    }
    for (const ware of this.wares_data) if (network.has(ware.id)) tier(ware.id)
  }

  loadColors(): void {
    const path = this.libraryPath('colors')
    if (!existsSync(path)) return
    const root = this.library('colors')
    for (const color of nodes(root.colors).flatMap(colors => nodes(colors.color))) this.colors_db[a(color, 'id')] = hex(num(color, 'r'), num(color, 'g'), num(color, 'b'))
    for (const mapping of nodes(root.mappings).flatMap(mappings => nodes(mappings.mapping))) this.mappings_db[a(mapping, 'id')] = a(mapping, 'ref')
    const aliases: Record<string, string> = { scrap: 'rawscrap', khaakscrap: 'rawkhaakscrap' }
    for (const [id, ref] of Object.entries(this.mappings_db)) if (id.startsWith('resource_map_') && ref in this.colors_db) {
      const extracted = id.replaceAll('resource_map_', ''), ware = Object.hasOwn(aliases, extracted) ? aliases[extracted]! : extracted
      this.resource_map_colors[ware] = { color_id: ref, color_rgb: this.colors_db[ref] }
    }
  }

  loadRegionyieldsColors(): void {
    if (!existsSync(this.libraryPath('regionyields'))) return
    const root = this.library('regionyields')
    // Resource definitions are direct children of the regionyields root.
    for (const resource of nodes(root.resource)) {
      const ware = a(resource, 'ware')
      if (!ware) continue
      const r = num(resource, 'effect_r'), g = num(resource, 'effect_g'), b = num(resource, 'effect_b')
      this.regionyields_db[ware] = { r, g, b, color_rgb: hex(r, g, b) }
    }
  }

  moduleColors(type: string, group?: string): { color: string; color_rgb: string } {
    if (group?.toLowerCase().includes('venture')) {
      if (type.toLowerCase().includes('dock')) type = 'venturedock'
      else if (type.toLowerCase().includes('connection')) type = 'ventureconnection'
      else type = 'ventureplatform'
    }
    const ids: Record<string, string> = { production: 'production', storage: 'storage', habitation: 'habitation',
      defencemodule: 'defence', defense: 'defence', dockarea: 'dockingbay', pier: 'pier', connectionmodule: 'connection',
      processingmodule: 'processing', ventureplatform: 'ventureplatform', welfaremodule: 'welfare', buildmodule: 'build', radar: 'radar' }
    const id = `holomap_component_${Object.hasOwn(ids, type) ? ids[type] : type}`
    let color: string
    if (id in this.mappings_db) color = this.mappings_db[id]!
    else if ('holomap_component_base' in this.mappings_db) color = this.mappings_db.holomap_component_base!
    else color = 'grey_160'
    return { color, color_rgb: this.colors_db[color] ?? '#A0A0A0' }
  }

  processModuleGroups(): void {
    if (existsSync(this.libraryPath('waregroups'))) for (const group of nodes(this.library('waregroups').group)) {
      const id = a(group, 'id'), name = a(group, 'name', '')
      this.module_groups_result.push({ id, nameId: name, type: 'production', name, ...this.moduleColors('production', id) })
      this.collectName(name)
    }
    for (const [type, name] of Object.entries<string>(this.config.module_types ?? {})) {
      this.module_groups_result.push({ id: type, nameId: name, type, name, ...this.moduleColors(type, type) })
      this.collectName(name)
    }
  }

  scanAssets(): void {
    const defaults = first(nodes(this.library('defaults').dataset).find(dataset => a(dataset, 'class') === 'processingmodule')?.properties)
    let defaultProducts = nodes(defaults?.products).flatMap(products => nodes(products.ware))
    if (!defaultProducts.length) defaultProducts = nodes(defaults?.product)
    for (const macro of this.macros('module_macros.xml')) {
      const name = a(macro, 'name'), info = this.valid_macros[name]
      if (!info) continue
      const type = a(macro, 'class'), props = first(macro.properties), wf = props?.workforce
      let needed = num(wf, 'amount')
      if (a(wf, 'max') !== null && a(wf, 'max') !== '') needed = num(wf, 'max')
      const data: Row = { id: info.module_ware_id, macroId: name, wareId: info.module_ware_id, nameId: info.name_id,
        name: info.name_id, dlc_tag: this.dlc(info.module_ware_id), type, group: type, method: 'none', race: 'default',
        isPlayerBlueprint: props?.build !== undefined, buildTime: info.build_time, buildCost: info.build_cost, tier: 0,
        cycleTime: 0, workforce: { capacity: num(wf, 'capacity'), needed, maxBonus: 0 }, outputs: Object.create(null), inputs: Object.create(null),
        dockingCount: 0, buildProcessorCount: 0, buildShipClasses: [], ...this.moduleColors(type) }
      if (type === 'buildmodule') {
        data.buildProcessorCount = nodes(macro.connections).flatMap(section => nodes(section.connection)).filter(conn => a(conn, 'ref') === 'buildprocessorconnection').length
        if (props?.builder !== undefined) data.buildShipClasses = tags(a(props.builder, 'classes', ''))
      }
      if (props?.identification !== undefined) {
        const race = a(props.identification, 'makerrace'), rawType = a(props.identification, 'type')
        if (race) data.race = race
        data.isPlayerBlueprint = data.isPlayerBlueprint && !['xenon', 'khaak', 'unknown'].includes(data.race)
        if (rawType) {
          const special: Record<string, string> = { moduletypes_processing: 'processingmodule', moduletypes_venture: 'ventureplatform' }
          if (Object.hasOwn(special, rawType)) data.group = special[rawType]
          Object.assign(data, this.moduleColors(rawType, data.group))
        }
      }
      if (type === 'production' && props?.production !== undefined) {
        const production = first(props.production), queue = nodes(production.queue)[0]
        let configs: Row[] = []
        if (nodes(queue?.item).length) configs = nodes(queue.item)
        else if (a(queue, 'ware')) configs = [queue]
        else if (a(production, 'wares')) configs = [{ '@_ware': a(production, 'wares'), '@_method': a(production, 'method', 'default') }]
        const recipes: [string, Row][] = []
        for (const config of configs) {
          const wareId = a(config, 'ware'), method = a(config, 'method', 'default')
          data.method = method
          if (data.group === data.type) {
            const ware = this.wares_data.find(ware => ware.id === wareId)
            if (ware?.group) data.group = ware.group
          }
          const methods = this.recipes[wareId]
          if (!methods) continue
          let recipe = methods[method]
          if (recipe === undefined) recipe = methods.default
          if (recipe !== undefined) recipes.push([wareId, recipe])
        }
        const time = recipes.reduce((sum, [, recipe]) => sum + recipe.time, 0)
        if (time > 0) {
          data.cycleTime = time
          const factor = 3600 / time
          for (const [wareId, recipe] of recipes) {
            data.outputs[wareId] = (data.outputs[wareId] ?? 0) + roundProduction(recipe.amount * factor)
            for (const [input, amount] of Object.entries<number>(recipe.inputs)) data.inputs[input] = (data.inputs[input] ?? 0) + roundProduction(amount * factor)
            data.workforce.maxBonus = Math.max(data.workforce.maxBonus, recipe.bonus)
          }
        }
        data.tier = Math.max(0, ...configs.map(config => this.ware_tier_map[a(config, 'ware')] ?? 0))
      }
      if (type === 'processingmodule') {
        const productIds: string[] = []
        let products = nodes(macro.properties).flatMap(properties => nodes(properties.products).flatMap(products => nodes(products.ware)))
        if (!products.length) products = defaultProducts
        for (const product of products) {
          const id = a(product, 'ware'), recipe = this.recipes[id]?.processing
          if (!recipe) continue
          const amount = num(product, 'amount'), cycles = 3600 / recipe.time, scale = amount / recipe.amount
          data.cycleTime = recipe.time
          data.outputs[id] = roundProduction(amount * cycles)
          for (const [input, quantity] of Object.entries<number>(recipe.inputs)) data.inputs[input] = roundProduction(quantity * scale * cycles)
          productIds.push(id)
        }
        data.tier = Math.max(0, ...productIds.map(id => this.ware_tier_map[id] ?? 0))
      }
      if (type === 'storage' && props?.cargo !== undefined) {
        const cargoTags = a(props.cargo, 'tags', '')
        let cargoType = 'container'
        if (cargoTags.includes('liquid')) cargoType = 'liquid'
        else if (cargoTags.includes('solid')) cargoType = 'solid'
        data.cargo = { capacity: num(props.cargo, 'max'), type: cargoType }
      }
      if (type === 'pier') data.dockingCount = nodes(first(macro.connections)?.connection).length
      this.all_modules.push(data)
    }
  }

  parseShipAndEquipmentData(): void {
    this.loadShipgroups()
    this.loadShipConnections()
    this.loadShipConnectionMacros()
    this.loadShipDefaults()
    this.loadShipMacros()
    this.loadLoadouts()
    this.loadEquipmentComponentTags()
    this.buildShips()
    this.buildEquipments()
  }

  private loadShipgroups(): void {
    if (!existsSync(this.libraryPath('shipgroups'))) return
    for (const group of nodes(this.library('shipgroups').group)) {
      const name = a(group, 'name')
      if (!name) continue
      for (const select of nodes(group.select)) if (a(select, 'macro')) this.shipgroup_by_macro[a(select, 'macro')] = name
    }
  }

  private equipmentTypes(values: string[]): string[] {
    const result: string[] = []
    if (values.includes('engine')) result.push('engine')
    if (values.includes('shield')) result.push('shield')
    if (values.includes('weapon') || values.includes('primaryweapon')) result.push('weapon')
    if (values.includes('turret')) result.push('turret')
    if (values.includes('thruster')) result.push('thruster')
    return result
  }

  private typeSize(values: string[], types: string[]): [string | null, string | null] {
    let size: string | null = null
    for (const tag of values) {
      if (Object.hasOwn(SIZE_RANK, tag)) { size = tag; break }
      if (tag === 'xl') { size = 'extralarge'; break }
    }
    return [types[0] ?? null, size]
  }

  private loadShipConnections(): void {
    const path = join(this.raw_path, 'libraries', 'ship_components.xml')
    if (!existsSync(path)) return
    for (const component of nodes(this.readRoot(path).component)) {
      const name = a(component, 'name')
      if (!name) continue
      const raw: Row[] = [], fitted: Row[] = []
      for (const connection of nodes(component.connections).flatMap(section => nodes(section.connection))) {
        const connName = a(connection, 'name'), values = tags(a(connection, 'tags', ''))
        if (!connName) continue
        raw.push({ name: connName, tags: values })
        const types = this.equipmentTypes(values)
        if (!types.length) continue
        const group = a(connection, 'group', '').trim()
        fitted.push({ name: connName, group: group === '' ? connName : group, isImplicitGroup: group === '', tags: values, types })
      }
      if (raw.length) this.ship_connections_raw[name] = raw
      if (fitted.length) this.ship_connections[name] = fitted
    }
  }

  private loadEquipmentComponentTags(): void {
    const path = join(this.raw_path, 'libraries', 'equipment_components.xml')
    if (!existsSync(path)) return
    for (const component of nodes(this.readRoot(path).component)) {
      const name = a(component, 'name')
      if (!name) continue
      for (const connection of nodes(component.connections).flatMap(section => nodes(section.connection))) {
        const values = tags(a(connection, 'tags', ''))
        if (!values.length) continue
        const set = this.equipment_component_tags_by_name[name] ??= new Set()
        for (const value of values) set.add(value)
      }
    }
  }

  private loadShipConnectionMacros(): void {
    const path = join(this.raw_path, 'libraries', 'ship_connection_macros.xml')
    if (!existsSync(path)) return
    for (const macro of this.macros('ship_connection_macros.xml')) {
      const name = a(macro, 'name'), type = a(macro, 'class'), props = first(macro.properties)
      if (!name || props === undefined) continue
      const info: Row = { class: type }
      if (type === 'storage' && props.cargo !== undefined) info.storage = tags(a(props.cargo, 'tags', '')).map(tag => ({ type: tag, capacity: num(props.cargo, 'max') }))
      if (type === 'dockingbay' && props.dock !== undefined && props.docksize !== undefined) {
        const key = a(props.dock, 'storage', '0') === '1' ? 'shipstorage' : 'dockarea'
        const entries = tags(a(props.docksize, 'tags', '')).map(size => ({ size, capacity: num(props.dock, 'capacity', 1) }))
        if (entries.length) info[key] = entries
      }
      if (type === 'dockarea') {
        const refs = nodes(macro.connections).flatMap(section => nodes(section.connection)).map(conn => a(conn.macro, 'ref')).filter(Boolean)
        if (refs.length) info.dockingbayRefs = refs
      }
      this.ship_connection_macros[name] = info
    }
  }

  private loadShipDefaults(): void {
    if (!existsSync(this.libraryPath('defaults'))) return
    for (const dataset of nodes(this.library('defaults').dataset)) {
      const type = a(dataset, 'class'), props = first(dataset.properties)
      if (!type?.startsWith('ship_') || props === undefined) continue
      const info: Row = {}
      if (props.radar !== undefined) info.radarRange = num(props.radar, 'range')
      if (props.storage !== undefined) Object.assign(info, numericFields(props.storage, ['countermeasure', 'deployable']))
      if (props.docksize !== undefined) info.docksize = a(props.docksize, 'tag')
      if (Object.keys(info).length) this.ship_defaults[type] = info
    }
  }

  loadShipMaxStatistics(): void {
    if (!existsSync(this.libraryPath('defaults'))) return
    for (const dataset of nodes(this.library('defaults').dataset)) {
      const type = a(dataset, 'class'), max = first(first(first(dataset.properties)?.statistics)?.max)
      if (!['ship_xl', 'ship_l', 'ship_m', 'ship_s'].includes(type) || max === undefined) continue
      const info: Row = {}
      const fields: Record<string, Record<string, string>> = {
        hull: { value: 'hull' }, weapon: { burst: 'weapon_burst', sustained: 'weapon_sustained' },
        shield: { value: 'shield_value', delay: 'shield_delay', rate: 'shield_rate' },
        turret: { burst: 'turret_value', sustained: 'turret_sustained_value' },
        dock: { ship_m: 'dock_ship_m', ship_s: 'dock_ship_s' },
        engine: { forward: 'engine_forward', acceleration: 'engine_acceleration', yaw: 'engine_yaw', pitch: 'engine_pitch', roll: 'engine_roll' },
        boost: { speed: 'boost_speed', acceleration: 'boost_acceleration', duration: 'boost_duration', recharge: 'boost_recharge' },
        travel: { speed: 'travel_speed', acceleration: 'travel_acceleration', chargetime: 'travel_charge_time' },
        radar: { range: 'radar_range' }
      }
      for (const [node, keys] of Object.entries(fields)) if (max[node] !== undefined)
        for (const [attribute, field] of Object.entries(keys)) info[field] = num(max[node], attribute)
      const groupShield = first(max.groups)?.shield
      for (const key of ['value', 'delay', 'rate']) {
        if (groupShield !== undefined && num(groupShield, 'value') > 0) info[`group_shield_${key}`] = num(groupShield, key)
        else info[`group_shield_${key}`] = info[`shield_${key}`] ?? 0
      }
      const groupTurret = first(max.groups)?.turret
      if (groupTurret !== undefined && num(groupTurret, 'burst') > 0) {
        info.turret_burst = num(groupTurret, 'burst'); info.turret_sustained = num(groupTurret, 'sustained')
      } else { info.turret_burst = info.turret_value ?? 0; info.turret_sustained = info.turret_sustained_value ?? 0 }
      for (const axis of ['horizontal', 'vertical']) if (first(max.thruster)?.[axis] !== undefined)
        for (const field of ['speed', 'acceleration']) info[`thruster_${axis}_${field}`] = num(first(max.thruster)[axis], field)
      if (max.capacity !== undefined) for (const field of ['crew', 'container', 'solid', 'liquid', 'condensate', 'ship_m', 'ship_s', 'unit', 'missile', 'countermeasure', 'deployable']) info[`capacity_${field}`] = num(max.capacity, field)
      if (Object.keys(info).length) this.ship_max_stats[type] = info
    }
  }

  private loadShipMacros(): void {
    const path = join(this.raw_path, 'libraries', 'ship_macros.xml')
    if (!existsSync(path)) return
    for (const macro of this.macros('ship_macros.xml')) {
      const name = a(macro, 'name'), component = a(macro.component, 'ref'), props = first(macro.properties)
      if (!name || !component || a(macro, 'class') === 'ship_xs') continue
      let physics: Row | null = null
      if (props?.physics !== undefined) physics = { mass: num(props.physics, 'mass'),
        drag: numericFields(first(props.physics).drag, ['forward', 'reverse', 'horizontal', 'vertical', 'pitch', 'yaw', 'roll']),
        accfactors: numericFields(first(props.physics).accfactors, ['horizontal', 'vertical'], 1) }
      this.ship_macros[name] = { id: name, class: a(macro, 'class'), component, shipType: a(props?.ship, 'type'),
        purposePrimary: a(props?.purpose, 'primary'),
        storage: props?.storage === undefined ? null : numericFields(props.storage, ['missile', 'unit']),
        crew: props?.people === undefined ? null : numericFields(props.people, ['capacity']),
        hull: num(props?.hull, 'max'), physics, thrusterTags: tags(a(props?.thruster, 'tags', '')),
        radarRange: props?.radar === undefined ? null : num(props.radar, 'range'),
        connectionMacroRefs: nodes(macro.connections).flatMap(section => nodes(section.connection)).map(conn => a(conn.macro, 'ref')).filter(Boolean) }
    }
  }

  private loadLoadouts(): void {
    if (!existsSync(this.libraryPath('loadouts'))) return
    const add = (ship: string, group: string, type: string, macro: string, count: number, optional: boolean): void => {
      if (!ship || !group || !type || !macro) return
      const entry = (((this.loadouts_map[ship] ??= Object.create(null))[group] ??= Object.create(null))[type] ??= Object.create(null))[macro] ??= { count: 0, optional: 0 }
      entry.count += count
      if (optional) entry.optional += count
    }
    for (const root of readOrderedXml(this.libraryPath('loadouts'))) for (const loadout of root.loadouts ?? []) {
      if (!loadout.loadout) continue
      const ship = a(loadout[':@'], 'macro')
      if (!ship) continue
      const component = this.ship_macros[ship]?.component
      const connectionMap = Object.fromEntries((this.ship_connections[component] ?? []).map(conn => [conn.name, conn.group]))
      for (const section of ['macros', 'groups']) {
        const container = loadout.loadout.find((node: Row) => node[section] !== undefined)
        for (const node of container?.[section] ?? []) {
          const tag = Object.keys(node).find(key => key !== ':@' && key !== '#text')
          if (tag === undefined) continue
          const type = tag.toLowerCase().replace(/s$/, ''), entry = node[':@']
          let group: string, count = 1
          if (section === 'macros') {
            const path = a(entry, 'path', '').trim(), name = path === '' ? '' : path.split('/').at(-1)!.trim()
            group = Object.hasOwn(connectionMap, name) ? connectionMap[name] : name
          } else { group = a(entry, 'group'); count = num(entry, 'exact', 1) }
          add(ship, group, type, a(entry, 'macro'), count, a(entry, 'optional') === '1')
        }
      }
    }
  }

  private race(name: string): string | null {
    const abbrev = name.split('_')[1]?.toLowerCase()
    if (!abbrev) return null
    const map: Record<string, string> = { arg: 'argon', tel: 'teladi', par: 'paranid', spl: 'split', ter: 'terran', bor: 'boron',
      xen: 'xenon', kha: 'khaak', pir: 'pirates', yak: 'yaki', atf: 'terran', gen: 'generic' }
    return Object.hasOwn(map, abbrev) ? map[abbrev]! : abbrev
  }

  private production(ware: Row): Row[] {
    return Object.entries(this.recipes[ware.id] ?? {}).map(([method, recipe]) => ({ method,
      noplayerbuild: (ware.production_method_tags[method] ?? []).includes('noplayerbuild'), cost: recipe.inputs, time: recipe.time }))
  }
  private buildCost(id: string): Row { return Object.fromEntries(Object.entries(this.recipes[id] ?? {}).map(([method, recipe]) => [method, recipe.inputs])) }
  private buildTime(id: string): Row { return Object.fromEntries(Object.entries(this.recipes[id] ?? {}).map(([method, recipe]) => [method, recipe.time])) }
  private collectSlotTags(values: string[]): void { for (const tag of values) if (SLOT_TAGS.includes(tag)) this.slot_tag_counts[tag] = (this.slot_tag_counts[tag] ?? 0) + 1 }

  droneTags(purpose: string | null, cargo: Row[], engine: string | null = null): string[] {
    if (purpose === 'build') return engine === 'engine_gen_xs_repairdrone_01_macro' ? [] : ['build']
    if (purpose !== 'mine') return []
    const values = new Set(cargo.map(entry => entry.type)), result = ['mine']
    if (values.has('liquid')) result.push('liquid')
    if (values.has('solid')) result.push('solid')
    return result
  }

  private shipStorage(info: Row): Row {
    const storage: Row[] = [], dock: Row[] = [], shipStorage: Row[] = []
    const visit = (ref: string, visited = new Set<string>()): void => {
      if (visited.has(ref)) return
      visited.add(ref)
      const macro = this.ship_connection_macros[ref]
      if (!macro) return
      if (macro.class === 'storage') storage.push(...(macro.storage ?? []))
      else if (macro.class === 'dockingbay') { dock.push(...(macro.dockarea ?? [])); shipStorage.push(...(macro.shipstorage ?? [])) }
      else if (macro.class === 'dockarea') for (const child of macro.dockingbayRefs ?? []) visit(child, visited)
    }
    for (const ref of info.connectionMacroRefs) visit(ref)
    const merge = (entries: Row[], key: string): Row[] => {
      const amounts: Record<string, number> = Object.create(null)
      for (const entry of entries) if (entry[key]) amounts[entry[key]] = (amounts[entry[key]] ?? 0) + (entry.capacity ?? 1)
      return Object.entries(amounts).map(([value, capacity]) => ({ [key]: value, capacity }))
    }
    return { cargo: merge(storage, 'type'), dockarea: merge(dock, 'size'), shipstorage: merge(shipStorage, 'size') }
  }

  private buildShips(): void {
    for (const [macro, info] of Object.entries(this.ship_macros)) {
      const id = this.component_to_ware[macro]
      if (!id) continue
      const ware = this.ware_index[id]!
      const values = tags(ware.tags)
      if (ware.transport !== 'ship' || values.includes('noblueprint')) continue
      const name = ware.nameId
      this.collectName(name)
      if (info.crew === null || info.crew.capacity <= 0) continue
      const cockpit = (this.ship_connections_raw[info.component] ?? []).some(conn =>
        conn.tags.includes('cockpit') || conn.tags.includes('bridge') || /cockpit|bridge/.test(conn.name.toLowerCase()))
      if (!cockpit) continue
      const production = this.production(ware), defaults = this.ship_defaults[info.class] ?? {}
      const ship: Row = { id, macro, nameId: name, name, dlc_tag: this.dlc(id), class: info.class, type: info.shipType,
        purposePrimary: info.purposePrimary, droneTags: [], race: this.race(macro), shipgroup: this.shipgroup_by_macro[macro] ?? null,
        noplayerblueprint: values.includes('noplayerblueprint'), production, slots: [],
        noplayerbuild: !production.length || production.every(entry => entry.noplayerbuild), ...this.shipStorage(info) }
      if (info.shipType) {
        this.ship_type_counts[info.shipType] = (this.ship_type_counts[info.shipType] ?? 0) + 1
        if (info.class) (this.ship_type_class_map[info.shipType] ??= new Set()).add(info.class)
      }
      ship.droneTags = this.droneTags(ship.purposePrimary, ship.cargo)
      if (info.storage !== null) ship.storage = { ...info.storage, countermeasure: defaults.countermeasure ?? 0, deployable: defaults.deployable ?? 0 }
      ship.crew = info.crew; ship.hull = info.hull
      if (info.physics !== null) ship.physics = info.physics
      if (info.radarRange) ship.radarRange = info.radarRange
      else if (defaults.radarRange) ship.radarRange = defaults.radarRange
      else ship.radarRange = 0
      const groups: Table = Object.create(null), groupTypes: Record<string, string[]> = Object.create(null)
      for (const conn of this.ship_connections[info.component] ?? []) {
        const group: Row = groups[conn.group] ??= { group: conn.group, isImplicitGroup: false, mandatory: false, connection: null, shieldConnection: null }
        group.isImplicitGroup = group.isImplicitGroup || conn.isImplicitGroup
        group.mandatory = group.mandatory || conn.tags.includes('mandatory')
        const [type, size] = this.typeSize(conn.tags, conn.types)
        if (!type || !size) continue
        const filtered = conn.tags.filter((tag: string) => ![type, size, 'platformcollision', 'envmap_cockpit'].includes(tag) && !tag.startsWith('symmetry')).sort()
        this.collectSlotTags(filtered)
        if (type === 'shield') {
          if (group.shieldConnection === null) group.shieldConnection = { size, tags: filtered, count: 0 }
          group.shieldConnection.count++
        } else {
          if (group.connection === null) group.connection = { size, tags: filtered, count: 0 }
          else {
            group.connection.tags = [...new Set([...group.connection.tags, ...filtered])].sort()
            if (group.connection.size === null) group.connection.size = size
          }
          group.connection.count++
        }
        const types = groupTypes[conn.group] ??= []
        for (const type of conn.types) if (!types.includes(type)) types.push(type)
      }
      const byType: Record<string, Row[]> = Object.create(null)
      for (const [key, group] of Object.entries(groups)) {
        const types = groupTypes[key] ?? []
        if (!types.length) continue
        const type = types.find(type => type !== 'shield') ?? types[0]!
        const shield = group.shieldConnection
        delete group.shieldConnection
        if (shield) {
          if (type === 'shield') group.connection = shield
          else {
            if (group.connection === null) group.connection = { size: shield.size, tags: [], count: 0 }
            group.connection.shield = shield
          }
        }
        ;(byType[type] ??= []).push(group)
      }
      if (info.thrusterTags.length) {
        const [, size] = this.typeSize(info.thrusterTags, ['thruster'])
        if (!size) continue
        const blacklist = ['thruster', size, 'platformcollision', 'envmap_cockpit']
        if (size === 'extralarge') blacklist.push('xl')
        const filtered = info.thrusterTags.filter((tag: string) => !blacklist.includes(tag) && !tag.startsWith('symmetry'))
        this.collectSlotTags(filtered)
        ;(byType.thruster ??= []).push({ group: 'thruster', isImplicitGroup: true, mandatory: info.thrusterTags.includes('mandatory'),
          connection: { size, tags: filtered, count: 1 }, equipments: {} })
      }
      for (const type of SLOT_ORDER) {
        if (!(type in byType)) continue
        const sorted = byType[type]!.sort((left, right) => sizeRank(left.connection?.size) - sizeRank(right.connection?.size)
          || compare(left.group.toLowerCase(), right.group.toLowerCase()) || compare(left.group, right.group))
        const counts: Record<string, number> = Object.create(null)
        for (const group of sorted) {
          const conn = group.connection
          if (!conn) continue
          if (conn.size) counts[conn.size] = (counts[conn.size] ?? 0) + conn.count
          for (const tag of conn.tags) if (tag) (this.ship_slot_tags_by_type[type] ??= new Set()).add(tag)
        }
        ship.slots.push({ type, count: counts, groups: sorted })
      }
      this.ships_data.push(ship)
    }
    const races = [...new Set<string>(this.ships_data.map(ship => ship.race).filter(Boolean))].sort()
    this.ship_races_data = races.map(race => ({ id: race,
      noplayerblueprint: this.ships_data.some(ship => ship.race === race && ship.noplayerblueprint),
      noplayerbuild: this.ships_data.some(ship => ship.race === race && ship.noplayerbuild) }))
  }

  private buildEquipments(): void {
    if (!existsSync(join(this.raw_path, 'libraries', 'equipment_macros.xml'))) return
    const classes: Record<string, string> = { engine: 'engine', shieldgenerator: 'shield', weapon: 'weapon', turret: 'turret', missilelauncher: 'weapon', missileturret: 'turret' }
    const typeMap: Record<string, string> = { engine: 'engine', shield: 'shield', weapon: 'weapon', primaryweapon: 'weapon', turret: 'turret', thruster: 'thruster' }
    const sizes: Record<string, string> = { small: 'small', medium: 'medium', large: 'large', extralarge: 'extralarge', s: 'small', m: 'medium', l: 'large', xl: 'extralarge' }
    for (const macro of this.macros('equipment_macros.xml')) {
      const name = a(macro, 'name'), cls = a(macro, 'class')
      const detected = name?.startsWith('thruster_') ? 'thruster' : Object.hasOwn(classes, cls) ? classes[cls] : undefined
      if (!name || !detected) continue
      const id = this.component_to_ware[name]
      if (!id) continue
      const ware = this.ware_index[id]!, nameId = ware.nameId, props = first(macro.properties)
      this.collectName(nameId)
      const ref = a(macro.component, 'ref')
      const rawSlotTags = [...(this.equipment_component_tags_by_name[ref] ?? [])].sort()
      if (rawSlotTags.includes('spacesuit')) continue
      let type: string | null = null, size: string | null = null
      const slotTags: string[] = []
      for (const tag of rawSlotTags) {
        if (tag === 'component') continue
        if (Object.hasOwn(typeMap, tag) && type === null) { type = typeMap[tag]!; continue }
        if (Object.hasOwn(sizes, tag) && size === null) { size = sizes[tag]!; continue }
        slotTags.push(tag)
      }
      this.collectSlotTags(slotTags)
      if (!type || !size) continue
      const rawTags = tags(ware.tags), integrated = a(props?.hull, 'integrated', '').trim().toLowerCase()
      const equipment: Row = { id, nameId, name: nameId, dlc_tag: this.dlc(id), type, class: cls,
        mk: a(props?.identification, 'mk'), race: a(props?.identification, 'makerrace'),
        tags: rawTags.filter(tag => tag !== 'noplayerblueprint'), noplayerblueprint: rawTags.includes('noplayerblueprint'),
        slotTags, ammunitionTags: [], integrated: !['0', 'false', 'no'].includes(integrated), size,
        cost: this.buildCost(id), buildTime: this.buildTime(id) }
      if (type === 'engine' && props !== undefined) {
        for (const [key, fields] of Object.entries({ thrust: ['forward', 'reverse'], boost: ['duration', 'recharge', 'thrust', 'acceleration'], travel: ['charge', 'thrust', 'attack', 'release'] }))
          if (props[key] !== undefined) equipment[key] = numericFields(props[key], fields)
      }
      if (type === 'thruster' && props?.thrust !== undefined) equipment.thrust = numericFields(props.thrust, ['pitch', 'yaw', 'roll', 'strafe'])
      if (type === 'shield' && props?.recharge !== undefined) equipment.recharge = numericFields(props.recharge, ['max', 'rate', 'delay'])
      if (['weapon', 'turret'].includes(type) && props !== undefined) {
        if (props.bullet !== undefined) equipment.bullet = a(props.bullet, 'class')
        if (props.heat !== undefined) equipment.heat = numericFields(props.heat, ['overheat', 'cooldelay', 'coolrate'])
        if (props.ammunition !== undefined) equipment.ammunitionTags = tags(a(props.ammunition, 'tags', ''))
      }
      this.equipments_data.push(equipment)
      this.equipment_type_counts[type] = (this.equipment_type_counts[type] ?? 0) + 1
    }
  }

  buildDronesAndConsumables(): void {
    if (!existsSync(join(this.raw_path, 'libraries', 'equipment_macros.xml'))) return
    const skip = ['engine', 'shieldgenerator', 'weapon', 'turret', 'missilelauncher', 'missileturret', 'missile']
    for (const macro of this.macros('equipment_macros.xml')) {
      const name = a(macro, 'name'), cls = a(macro, 'class')
      if (skip.includes(cls)) continue
      const id = this.component_to_ware[name]
      if (!id) continue
      const ware = this.ware_index[id]!, nameId = ware.nameId, props = first(macro.properties)
      this.collectName(nameId)
      const item: Row = { id, nameId, name: nameId, dlc_tag: this.dlc(id), macro: name, class: cls,
        mk: a(props?.identification, 'mk'), race: a(props?.identification, 'makerrace'), deployable: a(props?.identification, 'deployable', '0') === '1',
        tags: tags(ware.tags), cost: this.buildCost(id), buildTime: this.buildTime(id) }
      if (['ship_xs', 'ship_s'].includes(cls)) {
        const purpose = a(props?.purpose, 'primary'), capacity = num(props?.storage, 'unit')
        let cargo: Row[] = []
        if (purpose === 'trade') cargo = [{ type: 'container', capacity }]
        else if (purpose === 'mine') cargo = [{ type: num(props?.gatherrate, 'gas') > 0 ? 'liquid' : 'solid', capacity }]
        const engine = a(first(first(first(props?.loadouts)?.loadout)?.macros)?.engine, 'macro')
        Object.assign(item, { purposePrimary: purpose, droneTags: this.droneTags(purpose, cargo, engine),
          noplayerblueprint: tags(ware.tags).includes('noplayerblueprint'), cargo })
        this.drones_data.push(item)
      } else if (['mine', 'satellite', 'scanner', 'countermeasure', 'navbeacon', 'resourceprobe'].includes(cls)) this.consumables_data.push(item)
    }
  }

  buildMissiles(): void {
    if (!existsSync(join(this.raw_path, 'libraries', 'equipment_macros.xml'))) return
    for (const macro of this.macros('equipment_macros.xml')) {
      const name = a(macro, 'name'), cls = a(macro, 'class'), props = first(macro.properties)
      if (cls !== 'missile' || props === undefined) continue
      const id = this.component_to_ware[name]
      if (!id) continue
      const ware = this.ware_index[id]!, nameId = ware.nameId
      this.collectName(nameId)
      this.missiles_data.push({ id, nameId, name: nameId, dlc_tag: this.dlc(id), macro: name, class: cls, tags: tags(ware.tags),
        missileTags: tags(a(props.missile, 'tags', '')), cost: this.buildCost(id), buildTime: this.buildTime(id),
        amount: num(props.missile, 'amount'), lifetime: num(props.missile, 'lifetime'), range: num(props.missile, 'range'),
        explosive: num(props.explosiondamage, 'value'), reload: num(props.reload, 'time'), hull: num(props.hull, 'max'),
        resilience: num(props.countermeasure, 'resilience'), ammunition: num(props.ammunition, 'value') })
    }
  }

  buildBullets(): void {
    if (!existsSync(join(this.raw_path, 'libraries', 'bullet_macros.xml'))) return
    for (const macro of this.macros('bullet_macros.xml')) {
      const props = first(macro.properties)
      if (props === undefined) continue
      const speed = num(props.bullet, 'speed'), lifetime = num(props.bullet, 'lifetime'), beam = Math.abs(speed - 299792500) <= 1000
      let range = 0
      if (props.bullet !== undefined) {
        if (a(props.bullet, 'range')) range = num(props.bullet, 'range')
        else range = lifetime * speed
      }
      let reload = 0
      if (a(props.reload, 'time')) reload = num(props.reload, 'time')
      else if (a(props.reload, 'rate')) {
        const rate = num(props.reload, 'rate')
        if (rate !== 0) reload = 1 / rate
      }
      const ammo = num(props.ammunition, 'value')
      this.bullets_data.push({ id: a(macro, 'name'), speed, lifetime, range, reload, damage: num(props.damage, 'value'), repair: num(props.damage, 'repair'),
        chargetime: num(props.bullet, 'chargetime'), amount: num(props.bullet, 'amount', 1), barrelamount: num(props.bullet, 'barrelamount', 1),
        shotHeat: num(props.heat, beam ? 'initial' : 'value'), heat: beam ? num(props.heat, 'value') : 0,
        ammo: ammo > 0 ? ammo : 1, ammoreload: num(props.ammunition, 'reload'), type: beam ? 'beam' : 'bullet' })
    }
  }

  extractAndResolveLanguages(): void {
    this.refreshExportedI18n()
    if (!Object.keys(this.i18n_data.en ?? {}).length) return
    let path = join(this.raw_path, 't', '0001-L044.xml')
    if (!existsSync(path)) path = join(this.raw_path, 't', '0001-l044.xml')
    if (!existsSync(path)) return
    for (const root of readOrderedXml(path)) for (const page of root.language ?? []) {
      if (!page.page) continue
      const pageId = a(page[':@'], 'id')
      if (!['20221', '20109', '20228', '1021'].includes(pageId) || pageId in this.localePages) continue
      const entries: [string, string][] = []
      for (const text of page.page) {
        if (!text.t) continue
        const id = a(text[':@'], 'id'), value = orderedText(text.t).trim()
        if (id && value) {
          const previous = entries.findIndex(([key]) => key === id)
          if (previous === -1) entries.push([id, value])
          else entries[previous] = [id, value]
        }
      }
      this.localePages[pageId] = entries
    }
  }

  refreshExportedI18n(): void {
    this.i18n_registry.collectMany(this.needed_raw_names)
    for (const conf of Object.values(LANG_CONFIG)) this.i18n_data[conf.iso] = this.i18n_registry.exportCollected(conf.iso)
  }

  analyzeTypesAndDlcs(): void {
    const keyMap = (page: string, ids: string[], overrides: Record<string, string> = Object.create(null), slot = false): Record<string, string> => {
      const norm = (text: string): string => text.toLowerCase().replace(slot ? /[\s\-_]+/g : /\s+/g, '')
      const index: Record<string, string> = Object.create(null)
      for (const [key, text] of this.localePages[page] ?? []) index[norm(text)] = key
      const result: Record<string, string> = Object.create(null)
      for (const id of ids) {
        const key = index[norm(Object.hasOwn(overrides, id) ? overrides[id]! : id)]
        if (key) { result[id] = `{${page},${key}}`; this.needed_raw_names.add(result[id]!) }
      }
      return result
    }
    this.ship_type_key_map = keyMap('20221', Object.keys(this.ship_type_counts), { resupplier: 'Auxiliary', largeminer: 'Miner', expeditionary: 'Expeditionary Ship' })
    this.ship_types_data = Object.entries(this.ship_type_key_map).map(([id, nameId]) => ({ id, nameId, name: nameId, class: [...(this.ship_type_class_map[id] ?? [])].sort() }))
    const equipment = keyMap('20109', Object.keys(this.equipment_type_counts), { shield: 'Shield Generator' })
    this.equipment_types_data = Object.entries(equipment).map(([id, nameId]) => ({ id, nameId, name: nameId }))
    const slots = keyMap('20228', SLOT_TAGS, { highpower: 'High-Energy' }, true)
    this.slot_tags_data = SLOT_TAGS.map(id => ({ id, nameId: slots[id] ?? '', name: slots[id] ?? '', count: this.slot_tag_counts[id] ?? 0 }))
    const dlcs = keyMap('1021', DLC_TARGETS.map(item => item[0]!), Object.fromEntries(DLC_TARGETS.map(item => [item[0], item[1]])))
    this.dlcs_data = DLC_TARGETS.map(([id, lookup, version]) => {
      const major = Number(version!.slice(0, -2)), minor = version!.slice(-2).replace(/0+$/, '')
      return { id, nameId: dlcs[id!] ?? '', name: dlcs[id!] ?? lookup, dependencyVersion: `${major}.${minor === '' ? '0' : minor}` }
    })
  }

  injectEnglishNames(): void {
    const en = this.i18n_data.en ?? {}
    if (!Object.keys(en).length) return
    for (const list of [this.wares_data, this.all_modules, this.module_groups_result, this.ships_data, this.equipments_data,
      this.ship_types_data, this.equipment_types_data, this.slot_tags_data, this.dlcs_data])
      for (const item of list) if (Object.hasOwn(en, item.nameId)) item.name = en[item.nameId]
    const inject = (item: Row, fields: string[]): void => {
      for (const key of fields) if (item[key] && Object.hasOwn(en, item[key])) item[key.replace('Id', '')] = en[item[key]]
    }
    if (this.terraforming_data !== null) {
      for (const section of ['stats', 'projectGroups', 'projects', 'deliveryShips'])
        for (const item of this.terraforming_data[section] ?? []) inject(item, ['nameId', 'descriptionId', 'inactiveTextId'])
      for (const item of this.terraforming_data.stats ?? []) for (const range of item.ranges ?? []) inject(range, ['descriptionId'])
    }
    if (this.research_data !== null) for (const item of this.research_data.items ?? []) inject(item, ['nameId', 'descriptionId'])
    if (this.blueprints_data !== null) for (const section of ['blueprints', 'classes', 'types']) for (const item of this.blueprints_data[section] ?? []) inject(item, ['nameId'])
    if (this.factions_data !== null) for (const faction of this.factions_data) {
      inject(faction, ['nameId'])
      for (const licence of faction.licences ?? []) inject(licence, ['nameId'])
    }
    // Missiles/drones/consumables intentionally keep raw name placeholders, as the source pipeline does.
  }

  resourceData(): Row[] {
    return this.wares_data.filter(ware => ware.tier === 0).map(ware => {
      const entry: Row = { id: ware.id }
      let color: Row | undefined
      if (ware.id === 'energycells') {
        if (Object.keys(this.regionyields_db).length || Object.keys(this.resource_map_colors).length) color = { color_id: 'magenta_bright', color_rgb: '#FF66FF' }
      } else if (ware.id in this.regionyields_db) color = this.regionyields_db[ware.id]
      else if (ware.id in this.resource_map_colors) color = this.resource_map_colors[ware.id]
      if (color) {
        if ('color_id' in color) entry.color = color.color_id
        if ('color_rgb' in color) entry.color_rgb = color.color_rgb
        if ('r' in color) { entry.color_r = color.r; entry.color_g = color.g; entry.color_b = color.b }
      }
      for (const [iso, values] of Object.entries(this.i18n_data)) entry[`name_${iso}`] = Object.hasOwn(values, ware.nameId) ? values[ware.nameId] : ware.name
      return entry
    })
  }

  shipSlotsMaxes(): Row {
    const classes = ['ship_s', 'ship_m', 'ship_l', 'ship_xl'], types = ['engine', 'shield', 'thruster', 'turret', 'weapon'], sizes = ['small', 'medium', 'large', 'extralarge']
    const maxes: Record<string, Record<string, Record<string, number>>> = Object.create(null)
    for (const ship of this.ships_data) {
      if (!classes.includes(ship.class)) continue
      for (const slot of ship.slots) {
        if (!types.includes(slot.type)) continue
        for (const [size, count] of Object.entries<number>(slot.count)) {
          if (!sizes.includes(size)) continue
          const map = (maxes[ship.class] ??= Object.create(null))[slot.type] ??= Object.create(null)
          if (count > (map[size] ?? 0)) map[size] = Math.trunc(count)
        }
      }
    }
    const result: Row = {}
    for (const cls of classes) {
      result[cls] = []
      for (const type of types) for (const size of sizes) {
        const count = maxes[cls]?.[type]?.[size] ?? 0
        if (count > 0) result[cls].push({ slot: type, size, count })
      }
    }
    return result
  }

  save(): string[] {
    const data: Row = { modules: this.all_modules, wares: this.wares_data, module_groups: this.module_groups_result,
      consumption: this.race_consumption, ships: this.ships_data, ship_slots: this.shipSlotsMaxes(), default_maxes: this.ship_max_stats,
      equipments: this.equipments_data, ship_types: this.ship_types_data, ship_races: this.ship_races_data, equipment_types: this.equipment_types_data,
      slot_tags: this.slot_tags_data, dlcs: this.dlcs_data, missiles: this.missiles_data, bullets: this.bullets_data, drones: this.drones_data,
      consumables: this.consumables_data, res: this.resourceData() }
    for (const [key, value] of Object.entries({ terraforming: this.terraforming_data, research: this.research_data, blueprints: this.blueprints_data, factions: this.factions_data }))
      if (value !== null) data[key] = value
    const files: string[] = [], languages: Row[] = []
    for (const [x4_id, conf] of Object.entries(LANG_CONFIG)) {
      const values = this.i18n_data[conf.iso]
      if (values && Object.keys(values).length) {
        const path = join(this.output_root, 'locales', `${conf.iso}.json`)
        writeJson(path, Object.fromEntries(Object.entries(values).sort(([left], [right]) => compare(left, right))))
        files.push(path)
        languages.push({ code: conf.iso, name: conf.name, x4_id })
      }
    }
    data.languages = languages
    for (const [name, value] of Object.entries(data)) {
      const path = join(this.output_root, 'data', `${name}.json`)
      writeJson(path, value)
      files.push(path)
    }
    return files
  }
}
