import sax from 'sax'
import type {
  SaveArchive,
  SaveParserMessage,
  SectorData,
  StationBaseEntry,
  PlayerStationEntry,
  FactionStationEntry,
  NpcStationEntry,
  PlayerStationConstruction,
  StationEquipment,
  DatavaultEntry,
  AbandonedShipEntry
} from '@/types/saveArchive'

type Vector3 = { x: number; y: number; z: number }
type TagNode = { name: string; attributes: Record<string, unknown> }
type ComponentContext = {
  attributes: Record<string, unknown>
  ownOffset: Vector3
}

interface SaveData {
  meta: {
    guid: string
    seed: number
    time: number
    playerName: string
    version: string
  }
  sectors: Record<string, SectorData>
}

function hasEntries<T>(record: Record<string, T> | undefined): boolean {
  return Boolean(record && Object.keys(record).length > 0)
}

export interface SaveParserProgressInfo {
  bytesProcessed: number
  tagCount: number
  sectorsCount: number
}

export interface SaveParserRuntime {
  feed: (text: string) => void
  close: (filename: string) => SaveArchive
  getProgress: () => SaveParserProgressInfo
  getData: () => SaveData
  isDone: () => boolean
}

export interface SaveXmlFilterRuntime {
  feed: (text: string) => void
  close: () => { sectorCount: number }
}

type SaveXmlCaptureKind = 'game' | 'player' | 'station' | 'datavault' | 'abandonedShip'

const SAX_WRITE_CHUNK_SIZE = 64 * 1024
const SAX_MAX_BUFFER_LENGTH = 8 * 1024
const DEFAULT_PROGRESS_INTERVAL_MS = 1000
const saxWithBufferConfig = sax as typeof sax & { MAX_BUFFER_LENGTH: number }

function stripSaveFileExtension(filename: string): string {
  return filename.replace(/(\.xml)?\.gz$/i, '').replace(/\.xml$/i, '')
}

class X4SaveParser {
  private path: TagNode[] = []
  private currentSectorStack: string[] = []
  private componentStack: ComponentContext[] = []
  private tagCount = 0
  private sectorsCount = 0
  private expectedVersion: string | null
  private versionChecked = false
  private universeClosed = false

  private currentStationOwner: string | null = null
  private currentStationModules: PlayerStationConstruction[] = []
  private currentEntryIndex: number | null = null
  private currentEntryRef: string | null = null
  private currentEntryEquipments: StationEquipment[] = []

  public data: SaveData

  constructor(expectedVersion: string | null) {
    this.expectedVersion = expectedVersion
    this.data = {
      meta: { guid: '', seed: 0, time: 0, playerName: '', version: '' },
      sectors: {}
    }
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
    if (typeof value !== 'string' || value.length === 0) return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  private isAtTags(...tags: string[]): boolean {
    const n = tags.length
    if (this.path.length < n) return false
    for (let i = 0; i < n; i++) {
      if (this.path[this.path.length - n + i]?.name !== tags[i]) return false
    }
    return true
  }

  private currentNode(): TagNode | undefined {
    return this.path[this.path.length - 1]
  }

  private currentComponentContext(): ComponentContext | undefined {
    return this.componentStack[this.componentStack.length - 1]
  }

  private isGameTag(): boolean {
    return this.path.length >= 3
      && this.path[this.path.length - 3]?.name === 'savegame'
      && this.path[this.path.length - 2]?.name === 'info'
      && this.path[this.path.length - 1]?.name === 'game'
  }

  private isPlayerTag(): boolean {
    return this.path.length >= 3
      && this.path[this.path.length - 3]?.name === 'savegame'
      && this.path[this.path.length - 2]?.name === 'info'
      && this.path[this.path.length - 1]?.name === 'player'
  }

  private isComponent(node: TagNode | undefined): boolean {
    return node?.name === 'component'
  }

  private isSector(): boolean {
    const node = this.currentNode()
    return this.isComponent(node) && node?.attributes.class === 'sector'
  }

  private isStation(): boolean {
    const node = this.currentNode()
    return this.isComponent(node) && node?.attributes.class === 'station'
  }

  private isDatavault(): boolean {
    const node = this.currentNode()
    return this.isComponent(node) && node?.attributes.class === 'datavault'
  }

  private isErlkingVault(): boolean {
    const node = this.currentNode()
    const macro = String(node?.attributes.macro || '').toLowerCase()
    return this.isComponent(node) && macro.includes('erlking_vault')
  }

  private isAbandonedShip(): boolean {
    const node = this.currentNode()
    const clazz = String(node?.attributes.class || '')
    const owner = String(node?.attributes.owner || '')
    return this.isComponent(node) && clazz.startsWith('ship_') && owner === 'ownerless'
  }

  private isComponentPosition(): boolean {
    return this.isAtTags('component', 'offset', 'position')
  }

  private currentPositionComponentNode(): TagNode | undefined {
    if (!this.isComponentPosition()) return undefined
    return this.path[this.path.length - 3]
  }

  private isEntryTag(): boolean {
    return this.isAtTags('component', 'construction', 'sequence', 'entry')
  }

  private isShieldsTag(): boolean {
    return this.isAtTags('component', 'construction', 'sequence', 'entry', 'upgrades', 'groups', 'shields')
  }

  private isTurretsTag(): boolean {
    return this.isAtTags('component', 'construction', 'sequence', 'entry', 'upgrades', 'groups', 'turrets')
  }

  private extractPositionFromCurrentTag(): Vector3 {
    const pos = this.currentNode()?.attributes || {}
    return {
      x: this.toNumber(pos.x),
      y: this.toNumber(pos.y),
      z: this.toNumber(pos.z)
    }
  }

  getSectorsCount(): number {
    return this.sectorsCount
  }

  isDone(): boolean {
    return this.universeClosed
  }

  private getCurrentSectorData(): SectorData | null {
    const sectorKey = this.currentSectorStack[this.currentSectorStack.length - 1]
    if (!sectorKey) return null
    return this.data.sectors[sectorKey] || null
  }

  private getAccumulatedPosition(): Vector3 {
    const result: Vector3 = { x: 0, y: 0, z: 0 }
    for (const component of this.componentStack) {
      result.x += component.ownOffset.x
      result.y += component.ownOffset.y
      result.z += component.ownOffset.z
    }
    return result
  }

  private buildDatavaultFlags(attrib: Record<string, unknown>): Pick<DatavaultEntry, 'has_blueprints' | 'has_wares' | 'has_signalleak'> {
    const hasBlueprints = attrib.has_blueprints === '1' || attrib.blueprints === '1'
    const hasWares = attrib.has_wares === '1' || attrib.wares === '1'
    const hasSignalleak = attrib.has_signalleak === '1' || attrib.signalleak === '1'
    return {
      has_blueprints: hasBlueprints || undefined,
      has_wares: hasWares || undefined,
      has_signalleak: hasSignalleak || undefined
    }
  }

  onOpenTag(node: TagNode): void {
    this.tagCount++
    this.path.push(node)
    const attrib = node.attributes

    if (this.isComponent(this.currentNode())) {
      this.componentStack.push({
        attributes: attrib,
        ownOffset: { x: 0, y: 0, z: 0 }
      })
    }

    if (this.isGameTag()) {
      this.data.meta.guid = String(attrib.guid || '')
      this.data.meta.seed = this.toNumber(attrib.seed)
      this.data.meta.time = this.toNumber(attrib.time)
      this.data.meta.version = String(attrib.version || '')
      
      if (!this.versionChecked && this.data.meta.version && this.expectedVersion !== null) {
        this.versionChecked = true
        const saveVersion = normalizeVersion(this.data.meta.version)
        const expected = normalizeVersion(this.expectedVersion)
        if (saveVersion !== expected) {
          throw new Error(`Version mismatch: save version ${this.data.meta.version} (${saveVersion}) does not match current game version ${this.expectedVersion} (${expected})`)
        }
      }
      return
    }

    if (this.isPlayerTag()) {
      this.data.meta.playerName = String(attrib.name || '')
      return
    }

    if (this.isSector()) {
      const macro = String(attrib.macro || '').toLowerCase()
      this.currentSectorStack.push(macro)
      if (!this.data.sectors[macro]) {
        this.data.sectors[macro] = {
          name: macro,
          is_known: attrib.known === '1' || attrib.knownto === 'player',
          owner: typeof attrib.owner === 'string' ? attrib.owner : undefined,
          player_stations: {},
          xenon_stations: {},
          khaak_stations: {},
          npc_stations: {},
          player_buildstorages: {},
          datavaults: {},
          erlking_vaults: {},
          abandoned_ships: {}
        }
        this.sectorsCount++
      }
    }

    if (this.isStation()) {
      this.currentStationOwner = String(attrib.owner || '')
      this.currentStationModules = []
    }

    if (this.isComponentPosition()) {
      const component = this.currentComponentContext()
      if (component) {
        component.ownOffset = this.extractPositionFromCurrentTag()
      }
    }

    if (this.isEntryTag() && this.currentStationOwner === 'player') {
      this.currentEntryIndex = this.toNumber(attrib.index)
      this.currentEntryRef = String(attrib.macro || '')
      this.currentEntryEquipments = []
    }

    if (this.isShieldsTag() && this.currentEntryIndex !== null) {
      this.currentEntryEquipments.push({
        type: 'shields',
        ref: String(attrib.macro || ''),
        group: String(attrib.group || ''),
        exact: this.toNumber(attrib.exact, 1)
      })
    }

    if (this.isTurretsTag() && this.currentEntryIndex !== null) {
      this.currentEntryEquipments.push({
        type: 'turrets',
        ref: String(attrib.macro || ''),
        group: String(attrib.group || ''),
        exact: this.toNumber(attrib.exact, 1)
      })
    }
  }

  onCloseTag(name: string): void {
    const node = this.currentNode()

    if (name === 'entry' && this.currentEntryIndex !== null && this.currentEntryRef !== null) {
      const construction: PlayerStationConstruction = {
        index: this.currentEntryIndex,
        ref: this.currentEntryRef
      }
      if (this.currentEntryEquipments.length > 0) {
        construction.equipments = this.currentEntryEquipments
      }
      this.currentStationModules.push(construction)
      this.currentEntryIndex = null
      this.currentEntryRef = null
      this.currentEntryEquipments = []
    }

    if (node?.name === 'component') {
      const sectorData = this.getCurrentSectorData()
      const pos = this.getAccumulatedPosition()
      const attrib = node.attributes

      if (this.isStation() && sectorData) {
        const owner = String(attrib.owner || '')
        const relativePosition = { x: pos.x, y: pos.y, z: pos.z }
        const base: StationBaseEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          owner: owner,
          relative_position: relativePosition,
          position: relativePosition,
          is_wreck: attrib.state === 'wreck' || undefined,
          is_headquarter: attrib.factionheadquarters === '1' || undefined
        }

        if (owner === 'player') {
          const entry: PlayerStationEntry = { ...base }
          if (this.currentStationModules.length > 0) {
            entry.constructions = this.currentStationModules
          }
          sectorData.player_stations ||= {}
          sectorData.player_stations[entry.code] = entry
        } else if (owner === 'xenon') {
          const entry: FactionStationEntry = { ...base }
          sectorData.xenon_stations ||= {}
          sectorData.xenon_stations[entry.code] = entry
        } else if (owner === 'khaak') {
          const entry: FactionStationEntry = { ...base }
          sectorData.khaak_stations ||= {}
          sectorData.khaak_stations[entry.code] = entry
        } else {
          const entry: NpcStationEntry = { ...base }
          sectorData.npc_stations ||= {}
          sectorData.npc_stations[entry.code] = entry
        }
      } else if (this.isDatavault() && sectorData) {
        const relativePosition = { x: pos.x, y: pos.y, z: pos.z }
        const entry: DatavaultEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          owner: String(attrib.owner || ''),
          relative_position: relativePosition,
          position: relativePosition,
          unlocked: false,
          wares: [],
          ...this.buildDatavaultFlags(attrib)
        }
        sectorData.datavaults ||= {}
        sectorData.datavaults[entry.code] = entry
      } else if (this.isErlkingVault() && sectorData) {
        const relativePosition = { x: pos.x, y: pos.y, z: pos.z }
        const entry: DatavaultEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          owner: String(attrib.owner || ''),
          relative_position: relativePosition,
          position: relativePosition,
          unlocked: false,
          wares: [],
          ...this.buildDatavaultFlags(attrib)
        }
        sectorData.erlking_vaults ||= {}
        sectorData.erlking_vaults[entry.code] = entry
      } else if (this.isAbandonedShip() && sectorData) {
        const relativePosition = { x: pos.x, y: pos.y, z: pos.z }
        const entry: AbandonedShipEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          class: String(attrib.class || ''),
          relative_position: relativePosition,
          position: relativePosition
        }
        sectorData.abandoned_ships ||= {}
        sectorData.abandoned_ships[entry.code] = entry
      }

      if (this.isStation()) {
        this.currentStationOwner = null
        this.currentStationModules = []
        this.currentEntryIndex = null
        this.currentEntryRef = null
        this.currentEntryEquipments = []
      }

      if (node.attributes.class === 'sector') {
        this.currentSectorStack.pop()
      }

      this.componentStack.pop()
    }

    if (name === 'universe') {
      this.universeClosed = true
    }

    if (this.path.length > 0 && this.path[this.path.length - 1]?.name === name) {
      this.path.pop()
    }
  }

  getTagCount(): number {
    return this.tagCount
  }

  getCurrentXmlCaptureKind(): SaveXmlCaptureKind | null {
    if (this.isGameTag()) return 'game'
    if (this.isPlayerTag()) return 'player'
    if (this.isStation()) return 'station'
    if (this.isDatavault() || this.isErlkingVault()) return 'datavault'
    if (this.isAbandonedShip()) return 'abandonedShip'
    return null
  }

  shouldKeepCurrentNodeInXml(rootKind: SaveXmlCaptureKind): boolean {
    if (rootKind === 'game' || rootKind === 'player') {
      return false
    }

    const positionComponent = this.currentPositionComponentNode()
    if (positionComponent) {
      if (rootKind === 'station') {
        return positionComponent.attributes.class === 'station'
      }
      if (rootKind === 'datavault') {
        const macro = String(positionComponent.attributes.macro || '').toLowerCase()
        return positionComponent.attributes.class === 'datavault' || macro.includes('erlking_vault')
      }
      if (rootKind === 'abandonedShip') {
        const clazz = String(positionComponent.attributes.class || '')
        const owner = String(positionComponent.attributes.owner || '')
        return clazz.startsWith('ship_') && owner === 'ownerless'
      }
      return false
    }

    if (rootKind !== 'station') {
      return false
    }

    if (this.isEntryTag() && this.currentStationOwner === 'player') {
      return true
    }

    if (this.isShieldsTag() && this.currentEntryIndex !== null) {
      return true
    }

    if (this.isTurretsTag() && this.currentEntryIndex !== null) {
      return true
    }

    if (this.isAtTags('component', 'trade', 'offers', 'production', 'trade')) {
      return true
    }

    return false
  }
}

export function normalizeVersion(v: string): string {
  if (/^\d+\.\d+$/.test(v.trim())) {
    const parsed = Number(v)
    return Number.isFinite(parsed) ? parsed.toFixed(1) : v
  }

  const num = parseInt(v, 10)
  if (Number.isNaN(num)) return v
  return num >= 100 ? (num / 100).toFixed(1) : num.toFixed(1)
}

function escapeXmlAttribute(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function serializeXmlAttributes(attributes: Record<string, unknown>): string {
  const entries = Object.entries(attributes)
  if (entries.length === 0) return ''
  return ' ' + entries.map(([k, v]) => `${k}="${escapeXmlAttribute(v)}"`).join(' ')
}

type XmlCaptureNode = {
  name: string
  attrStr: string
  depth: number
  isSelfClosing: boolean
}

type XmlCaptureTreeNode = {
  name: string
  attrStr: string
  selfClosing: boolean
  selfRelevant: boolean
  hasRelevantDescendant: boolean
  children: XmlCaptureTreeNode[]
}

export interface ComponentXmlFilterRuntime {
  feed: (text: string) => void
  close: () => { matchCount: number }
}

export function createComponentXmlFilterRuntime(options: {
  codeFilters: string[]
  classFilter?: string | null
  write: (chunk: string) => void
}): ComponentXmlFilterRuntime {
  const saxParser = sax.parser(false, { lowercase: true, position: false })
  const previousMaxBufferLength = saxWithBufferConfig.MAX_BUFFER_LENGTH
  saxWithBufferConfig.MAX_BUFFER_LENGTH = Math.min(previousMaxBufferLength, SAX_MAX_BUFFER_LENGTH)

  const targetCodes = new Set(options.codeFilters)
  const targetClass = options.classFilter ?? null
  const pathStack: XmlCaptureNode[] = []
  const matches: Array<{ root: XmlCaptureTreeNode; rootDepth: number }> = []
  let activeCapture: { root: XmlCaptureTreeNode; rootDepth: number; nodeStack: XmlCaptureTreeNode[] } | null = null

  const serializeTree = (node: XmlCaptureTreeNode, depth: number): string[] => {
    const indent = '  '.repeat(depth)
    if (node.selfClosing && node.children.length === 0) {
      return [`${indent}<${node.name}${node.attrStr}/>`]
    }
    const lines = [`${indent}<${node.name}${node.attrStr}>`]
    for (const child of node.children) {
      lines.push(...serializeTree(child, depth + 1))
    }
    lines.push(`${indent}</${node.name}>`)
    return lines
  }

  saxParser.onopentag = (node: TagNode) => {
    const attrStr = serializeXmlAttributes(node.attributes)
    const isSelfClosing = (node as TagNode & { isSelfClosing?: boolean }).isSelfClosing === true
    const captureNode: XmlCaptureNode = {
      name: node.name,
      attrStr,
      depth: pathStack.length + 1,
      isSelfClosing
    }
    pathStack.push(captureNode)

    if (activeCapture) {
      const treeNode: XmlCaptureTreeNode = {
        name: captureNode.name,
        attrStr: captureNode.attrStr,
        selfClosing: captureNode.isSelfClosing,
        selfRelevant: true,
        hasRelevantDescendant: false,
        children: []
      }
      const parent = activeCapture.nodeStack[activeCapture.nodeStack.length - 1]
      if (parent) {
        parent.children.push(treeNode)
      }
      if (!captureNode.isSelfClosing) {
        activeCapture.nodeStack.push(treeNode)
      }
    }

    if (!activeCapture && node.name === 'component') {
      const code = String(node.attributes.code || '')
      const classAttr = String(node.attributes.class || '')
      const codeMatch = targetCodes.has(code)
      const classMatch = !targetClass || classAttr === targetClass

      if (codeMatch && classMatch) {
        const root: XmlCaptureTreeNode = {
          name: captureNode.name,
          attrStr: captureNode.attrStr,
          selfClosing: captureNode.isSelfClosing,
          selfRelevant: true,
          hasRelevantDescendant: false,
          children: []
        }
        activeCapture = {
          root,
          rootDepth: captureNode.depth,
          nodeStack: captureNode.isSelfClosing ? [] : [root]
        }
        matches.push({ root, rootDepth: captureNode.depth })
      }
    }
  }

  saxParser.ontext = () => {}
  saxParser.oncdata = () => {}
  saxParser.onscript = () => {}
  saxParser.onerror = (err: Error) => {
    throw err
  }

  saxParser.onclosetag = () => {
    const currentNode = pathStack[pathStack.length - 1]

    if (activeCapture && currentNode) {
      if (currentNode.depth === activeCapture.rootDepth) {
        const lines = serializeTree(activeCapture.root, 0)
        for (const line of lines) {
          options.write(line + '\n')
        }
        activeCapture = null
      } else if (currentNode.depth > activeCapture.rootDepth && !currentNode.isSelfClosing) {
        activeCapture.nodeStack.pop()
      }
    }

    pathStack.pop()
  }

  return {
    feed(text: string) {
      if (!text) return
      for (let i = 0; i < text.length; i += SAX_WRITE_CHUNK_SIZE) {
        const chunk = text.slice(i, i + SAX_WRITE_CHUNK_SIZE)
        saxParser.write(chunk)
      }
    },
    close() {
      saxParser.close()
      saxWithBufferConfig.MAX_BUFFER_LENGTH = previousMaxBufferLength
      return { matchCount: matches.length }
    }
  }
}

export function createSaveXmlFilterRuntime(options: {
  currentVersion?: string | null
  componentFilter?: { className: string; codes: string[] } | null
  write: (chunk: string) => void
}): SaveXmlFilterRuntime {
  const currentVersion = options.currentVersion ?? null
  const parser = new X4SaveParser(currentVersion)
  const previousMaxBufferLength = saxWithBufferConfig.MAX_BUFFER_LENGTH
  saxWithBufferConfig.MAX_BUFFER_LENGTH = Math.min(previousMaxBufferLength, SAX_MAX_BUFFER_LENGTH)
  const saxParser = sax.parser(false, { lowercase: true, position: false })

  const pathStack: XmlCaptureNode[] = []
  const writtenAncestorKeys = new Set<string>()
  let currentCaptureRoot: XmlCaptureNode | null = null
  let currentCaptureKind: SaveXmlCaptureKind | null = null
  let currentCaptureChildren: XmlCaptureTreeNode[] = []
  let currentCaptureNodeStack: XmlCaptureTreeNode[] = []
  let rootOpened = false
  let rootName = ''

  const serializeCaptureTree = (node: XmlCaptureTreeNode, absoluteDepth: number): string[] => {
    const indent = '  '.repeat(absoluteDepth)
    if (node.selfClosing && node.children.length === 0) {
      return [`${indent}<${node.name}${node.attrStr}/>`]
    }

    const lines = [`${indent}<${node.name}${node.attrStr}>`]
    for (const child of node.children) {
      lines.push(...serializeCaptureTree(child, absoluteDepth + 1))
    }
    lines.push(`${indent}</${node.name}>`)
    return lines
  }

  saxParser.onopentag = (node: TagNode) => {
    const attrStr = serializeXmlAttributes(node.attributes)
    const captureNode: XmlCaptureNode = {
      name: node.name,
      attrStr,
      depth: pathStack.length + 1,
      isSelfClosing: false
    }

    parser.onOpenTag(node)
    captureNode.isSelfClosing = (node as TagNode & { isSelfClosing?: boolean }).isSelfClosing === true
    pathStack.push(captureNode)

    if (!rootOpened) {
      rootOpened = true
      rootName = captureNode.name
      options.write(`<?xml version="1.0" encoding="utf-8"?>\n`)
      options.write(`<${captureNode.name}${captureNode.attrStr}>\n`)
      return
    }

    const insideCapture = currentCaptureRoot !== null
    if (insideCapture && currentCaptureKind !== null) {
      currentCaptureNodeStack.push({
        name: captureNode.name,
        attrStr: captureNode.attrStr,
        selfClosing: captureNode.isSelfClosing,
        selfRelevant: parser.shouldKeepCurrentNodeInXml(currentCaptureKind),
        hasRelevantDescendant: false,
        children: []
      })
    }

    const captureKind = parser.getCurrentXmlCaptureKind()
    const filter = options.componentFilter
    const matchesFilter = !filter
      || captureKind === 'game'
      || captureKind === 'player'
      || (node.name === 'component'
        && (!filter.className || node.attributes.class === filter.className)
        && filter.codes.includes(String(node.attributes.code || '')))
    const isCaptureRoot = !insideCapture && captureKind !== null && matchesFilter
    if (isCaptureRoot) {
      for (const ancestor of pathStack.slice(1, -1)) {
        const key = `${ancestor.depth}:${ancestor.name}:${ancestor.attrStr}`
        if (!writtenAncestorKeys.has(key)) {
          writtenAncestorKeys.add(key)
          options.write(`${'  '.repeat(Math.max(1, ancestor.depth - 1))}<${ancestor.name}${ancestor.attrStr}/>\n`)
        }
      }

      currentCaptureRoot = captureNode
      currentCaptureKind = captureKind
      currentCaptureChildren = []
      currentCaptureNodeStack = []

      if (captureNode.isSelfClosing) {
        options.write(`${'  '.repeat(Math.max(1, captureNode.depth - 1))}<${captureNode.name}${captureNode.attrStr}/>\n`)
        currentCaptureRoot = null
        currentCaptureKind = null
      }
    }
  }

  saxParser.ontext = () => {}
  saxParser.oncdata = () => {}
  saxParser.onscript = () => {}
  saxParser.onerror = (err: Error) => {
    throw err
  }

  saxParser.onclosetag = (name: string) => {
    const currentNode = pathStack[pathStack.length - 1]

    if (currentNode && currentCaptureRoot && currentNode !== currentCaptureRoot) {
      const treeNode = currentCaptureNodeStack.pop()
      if (treeNode && (treeNode.selfRelevant || treeNode.hasRelevantDescendant)) {
        const parent = currentCaptureNodeStack[currentCaptureNodeStack.length - 1]
        if (parent) {
          parent.children.push(treeNode)
          parent.hasRelevantDescendant = true
        } else {
          currentCaptureChildren.push(treeNode)
        }
      }
    }

    if (currentNode && currentCaptureRoot === currentNode) {
      const rootIndent = '  '.repeat(Math.max(1, currentNode.depth - 1))
      if (currentCaptureChildren.length > 0) {
        options.write(`${rootIndent}<${currentNode.name}${currentNode.attrStr}>\n`)
        for (const child of currentCaptureChildren) {
          for (const line of serializeCaptureTree(child, currentNode.depth)) {
            options.write(`${line}\n`)
          }
        }
        options.write(`${rootIndent}</${name}>\n`)
      } else {
        options.write(`${rootIndent}<${currentNode.name}${currentNode.attrStr}/>\n`)
      }
      currentCaptureRoot = null
      currentCaptureKind = null
      currentCaptureChildren = []
      currentCaptureNodeStack = []
    }

    parser.onCloseTag(name)
    pathStack.pop()
  }

  return {
    feed(text: string) {
      if (!text) return
      for (let i = 0; i < text.length; i += SAX_WRITE_CHUNK_SIZE) {
        const chunk = text.slice(i, i + SAX_WRITE_CHUNK_SIZE)
        saxParser.write(chunk)
      }
    },
    close() {
      saxParser.close()
      saxWithBufferConfig.MAX_BUFFER_LENGTH = previousMaxBufferLength
      if (rootOpened) {
        options.write(`</${rootName}>\n`)
      }
      return { sectorCount: parser.getSectorsCount() }
    }
  }
}

export function createSaveParserRuntime(
  options?: {
    onProgress?: (info: SaveParserProgressInfo) => void
    progressIntervalMs?: number
    currentVersion?: string | null
  }
): SaveParserRuntime {
  const currentVersion = options?.currentVersion ?? null
  const parser = new X4SaveParser(currentVersion)
  const previousMaxBufferLength = saxWithBufferConfig.MAX_BUFFER_LENGTH
  saxWithBufferConfig.MAX_BUFFER_LENGTH = Math.min(previousMaxBufferLength, SAX_MAX_BUFFER_LENGTH)
  const saxParser = sax.parser(false, { lowercase: true, position: false })
  let bytesProcessed = 0
  let lastProgressAt = 0
  const progressIntervalMs = options?.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS

  saxParser.onopentag = (node: TagNode) => {
    parser.onOpenTag(node)
  }

  saxParser.onclosetag = (name: string) => {
    parser.onCloseTag(name)
  }

  saxParser.ontext = () => {}
  saxParser.oncdata = () => {}
  saxParser.onscript = () => {}

  saxParser.onerror = (err: Error) => {
    throw err
  }

  const getProgressInfo = (): SaveParserProgressInfo => ({
    bytesProcessed,
    tagCount: parser.getTagCount(),
    sectorsCount: parser.getSectorsCount()
  })

  const emitProgress = (force = false) => {
    const now = Date.now()
    if (!force && now - lastProgressAt < progressIntervalMs) return
    lastProgressAt = now
    options?.onProgress?.({
      ...getProgressInfo()
    })
  }

  const pruneArchive = (archive: SaveArchive): SaveArchive => {
    const prunedSectors = Object.fromEntries(
      Object.entries(archive.sectors).map(([sectorId, sector]) => {
        const nextSector: SectorData = {
          name: sector.name,
          is_known: sector.is_known,
          ...(sector.owner ? { owner: sector.owner } : {})
        }

        if (hasEntries(sector.player_stations)) nextSector.player_stations = sector.player_stations
        if (hasEntries(sector.xenon_stations)) nextSector.xenon_stations = sector.xenon_stations
        if (hasEntries(sector.khaak_stations)) nextSector.khaak_stations = sector.khaak_stations
        if (hasEntries(sector.npc_stations)) nextSector.npc_stations = sector.npc_stations
        if (hasEntries(sector.datavaults)) nextSector.datavaults = sector.datavaults
        if (hasEntries(sector.erlking_vaults)) nextSector.erlking_vaults = sector.erlking_vaults
        if (hasEntries(sector.abandoned_ships)) nextSector.abandoned_ships = sector.abandoned_ships
        return [sectorId, nextSector]
      })
    )

    return { ...archive, sectors: prunedSectors }
  }

  return {
    feed(text: string) {
      if (!text || parser.isDone()) return
      bytesProcessed += text.length
      for (let i = 0; i < text.length; i += SAX_WRITE_CHUNK_SIZE) {
        if (parser.isDone()) break
        const chunk = text.slice(i, i + SAX_WRITE_CHUNK_SIZE)
        saxParser.write(chunk)
      }
      emitProgress()
    },
    close(filename: string) {
      if (!parser.isDone()) {
        saxParser.close()
      }
      emitProgress(true)
      saxWithBufferConfig.MAX_BUFFER_LENGTH = previousMaxBufferLength
      const isCompatible = currentVersion !== null 
        ? normalizeVersion(parser.data.meta.version) === normalizeVersion(currentVersion)
        : true
      return pruneArchive({
        meta: {
          ...parser.data.meta,
          filename: stripSaveFileExtension(filename),
          parser_version: 'v3',
          source: 'original'
        },
        sectors: parser.data.sectors,
        isCompatible,
        isValid: true
      })
    },
    getProgress() {
      return getProgressInfo()
    },
    getData() {
      return parser.data
    },
    isDone() {
      return parser.isDone()
    }
  }
}

export async function parseSaveXmlChunks(
  runtime: SaveParserRuntime,
  chunks: Iterable<string> | AsyncIterable<string>
): Promise<SaveArchive> {
  for await (const chunk of chunks) {
    runtime.feed(chunk)
    if (runtime.isDone()) break
  }
  return runtime.close('')
}

type WorkerMessageData = { type: string; arrayBuffer?: ArrayBuffer; filename?: string; currentVersion?: string }

function hasWorkerRuntime(): boolean {
  const scope = globalThis as { postMessage?: unknown; self?: unknown; importScripts?: unknown }
  return typeof globalThis !== 'undefined'
    && typeof scope.postMessage === 'function'
    && typeof scope.self !== 'undefined'
    && typeof scope.importScripts === 'function'
}

if (hasWorkerRuntime()) {
  self.onmessage = async (e: MessageEvent<WorkerMessageData>) => {
    const { type, arrayBuffer, filename, currentVersion } = e.data

    if (type !== 'parse' || !arrayBuffer) return

    const expectedVersion = currentVersion || '8.0'

    try {
      self.postMessage({ 
        type: 'progress', 
        data: { 
          phase: 'receiving', 
          percent: 0, 
          tagCount: 0, 
          sectorCount: 0, 
          done: false, 
          inputComplete: false, 
          error: null,
          inputBytesTotal: 0,
          parsedBytesTotal: 0,
          bufferedBytes: 0,
          expectedTotalBytes: 0
        } 
      } as SaveParserMessage)

      const header = new Uint8Array(arrayBuffer.slice(0, 2))
      const isGzipped = header[0] === 0x1f && header[1] === 0x8b
      const blob = new Blob([arrayBuffer])
      let textStream: ReadableStream<Uint8Array>

      if (isGzipped) {
        self.postMessage({ 
          type: 'progress', 
          data: { 
            phase: 'parsing', 
            percent: 0, 
            tagCount: 0, 
            sectorCount: 0, 
            done: false, 
            inputComplete: false, 
            error: null,
            inputBytesTotal: 0,
            parsedBytesTotal: 0,
            bufferedBytes: 0,
            expectedTotalBytes: 0
          } 
        } as SaveParserMessage)
        textStream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
      } else {
        textStream = blob.stream()
      }

      let lastReportedMB = -1
      let totalBytesProcessed = 0
      const runtime = createSaveParserRuntime({
        progressIntervalMs: DEFAULT_PROGRESS_INTERVAL_MS,
        currentVersion: expectedVersion,
        onProgress: (progress) => {
          totalBytesProcessed = progress.bytesProcessed
          const currentMB = Math.floor(progress.bytesProcessed / (1024 * 1024))
          if (currentMB <= lastReportedMB) return
          lastReportedMB = currentMB
          self.postMessage({
            type: 'progress',
            data: {
              phase: 'parsing',
              percent: 0,
              tagCount: progress.tagCount,
              sectorCount: progress.sectorsCount,
              done: false,
              inputComplete: false,
              error: null,
              inputBytesTotal: progress.bytesProcessed,
              parsedBytesTotal: progress.bytesProcessed,
              bufferedBytes: 0,
              expectedTotalBytes: 0
            }
          } as SaveParserMessage)
        }
      })
      const reader = textStream.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        runtime.feed(decoder.decode(value, { stream: true }))
        if (runtime.isDone()) {
          await reader.cancel()
          break
        }
      }

      const tail = decoder.decode()
      if (tail && !runtime.isDone()) {
        runtime.feed(tail)
      }

      const archive = runtime.close(filename || '')
      
      self.postMessage({ 
        type: 'progress', 
        data: { 
          phase: 'done', 
          percent: 100, 
          tagCount: runtime.getProgress().tagCount, 
          sectorCount: runtime.getProgress().sectorsCount, 
          done: true, 
          inputComplete: true, 
          error: null,
          inputBytesTotal: totalBytesProcessed,
          parsedBytesTotal: totalBytesProcessed,
          bufferedBytes: 0,
          expectedTotalBytes: totalBytesProcessed
        } 
      } as SaveParserMessage)
      self.postMessage({ type: 'complete', data: archive } as SaveParserMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[saveParser] error:', message, error)
      self.postMessage({ type: 'error', message } as SaveParserMessage)
    }
  }
}
