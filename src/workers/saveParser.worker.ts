import sax from 'sax'
import type {
  SaveArchive,
  SaveParserConfig,
  SaveParserMessage,
  SectorData,
  StationEntry,
  DatavaultEntry,
  AbandonedShipEntry
} from '@/types/saveArchive'

type Vector3 = { x: number; y: number; z: number }
type TagNode = { name: string; attributes: Record<string, unknown> }
type ComponentContext = {
  attributes: Record<string, unknown>
  macroOffset: Vector3
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

export interface SaveParserProgressInfo {
  bytesProcessed: number
  tagCount: number
  sectorsCount: number
}

export interface SaveParserRuntime {
  feed: (text: string) => void
  close: () => SaveArchive
  getProgress: () => SaveParserProgressInfo
  getData: () => SaveData
}

const SAX_WRITE_CHUNK_SIZE = 64 * 1024

function stripSaveFileExtension(filename: string): string {
  return filename.replace(/(\.xml)?\.gz$/i, '').replace(/\.xml$/i, '')
}

class X4SaveParser {
  private sectorNames: Record<string, string>
  private strings: Record<string, Record<string, string>>
  private positions: Record<string, Vector3>
  private path: TagNode[] = []
  private currentSectorStack: string[] = []
  private componentStack: ComponentContext[] = []
  private tagCount = 0

  public data: SaveData

  constructor(config: SaveParserConfig) {
    this.sectorNames = config.sectorNames
    this.strings = config.strings
    this.positions = config.positions

    this.data = {
      meta: { guid: '', seed: 0, time: 0, playerName: '', version: '' },
      sectors: {}
    }
  }

  private resolveName(value: string): string {
    let s = value
    const seen = new Set<string>()
    const reference = /\{(\d*),\s*(\d+)\}/g

    while (true) {
      reference.lastIndex = 0
      const match = reference.exec(s)
      if (!match) break

      const full = match[0]
      const page = match[1] || '20'
      const id = match[2]
      if (!id) break

      const key = `${page},${id}`
      let replacement = ''
      if (!seen.has(key)) {
        seen.add(key)
        replacement = this.strings[page]?.[id] || ''
      }

      s = s.replace(full, replacement)
    }

    return s.replace(/\([^)]*\)/g, '').trim()
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
    return this.isAtTags('savegame', 'info', 'game')
  }

  private isPlayerTag(): boolean {
    return this.isAtTags('savegame', 'info', 'player')
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

  private extractPositionFromCurrentTag(): Vector3 {
    const pos = this.currentNode()?.attributes || {}
    return {
      x: this.toNumber(pos.x),
      y: this.toNumber(pos.y),
      z: this.toNumber(pos.z)
    }
  }

  private getSectorName(macro: string): string {
    const rawName = this.sectorNames[macro] || macro
    return this.resolveName(rawName)
  }

  private getCurrentSectorData(): SectorData | null {
    const sectorKey = this.currentSectorStack[this.currentSectorStack.length - 1]
    if (!sectorKey) return null
    return this.data.sectors[sectorKey] || null
  }

  private getAccumulatedPosition(): Vector3 {
    const result: Vector3 = { x: 0, y: 0, z: 0 }
    for (const component of this.componentStack) {
      result.x += component.macroOffset.x + component.ownOffset.x
      result.y += component.macroOffset.y + component.ownOffset.y
      result.z += component.macroOffset.z + component.ownOffset.z
    }
    return result
  }

  private getMacroOffset(attrib: Record<string, unknown>): Vector3 {
    const macro = String(attrib.macro || '').toLowerCase()
    return macro ? this.positions[macro] || { x: 0, y: 0, z: 0 } : { x: 0, y: 0, z: 0 }
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
        macroOffset: this.getMacroOffset(attrib),
        ownOffset: { x: 0, y: 0, z: 0 }
      })
    }

    if (this.isGameTag()) {
      this.data.meta.guid = String(attrib.guid || '')
      this.data.meta.seed = this.toNumber(attrib.seed)
      this.data.meta.time = this.toNumber(attrib.time)
      this.data.meta.version = String(attrib.version || '')
      return
    }

    if (this.isPlayerTag()) {
      this.data.meta.playerName = String(attrib.name || '')
      return
    }

    if (this.isSector()) {
      const macro = String(attrib.macro || '').toLowerCase()
      this.currentSectorStack.push(macro)
      this.data.sectors[macro] = this.data.sectors[macro] || {
        name: this.getSectorName(macro),
        is_known: attrib.known === '1' || attrib.knownto === 'player',
        stations: [],
        datavaults: [],
        erlkingVaults: [],
        abandonedShips: []
      }
    }

    if (this.isComponentPosition()) {
      const component = this.currentComponentContext()
      if (component) {
        component.ownOffset = this.extractPositionFromCurrentTag()
      }
    }
  }

  onCloseTag(name: string): void {
    const node = this.currentNode()

    if (node?.name === 'component') {
      const sectorData = this.getCurrentSectorData()
      const pos = this.getAccumulatedPosition()
      const attrib = node.attributes

      if (this.isStation() && sectorData) {
        const entry: StationEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          owner: String(attrib.owner || ''),
          x: pos.x,
          y: pos.y,
          z: pos.z,
          is_wreck: attrib.state === 'wreck' || undefined,
          is_headquarter: attrib.factionheadquarters === '1' || undefined
        }
        sectorData.stations.push(entry)
      } else if (this.isDatavault() && sectorData) {
        const entry: DatavaultEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          owner: String(attrib.owner || ''),
          x: pos.x,
          y: pos.y,
          z: pos.z,
          ...this.buildDatavaultFlags(attrib)
        }
        sectorData.datavaults.push(entry)
      } else if (this.isErlkingVault() && sectorData) {
        const entry: DatavaultEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          owner: String(attrib.owner || ''),
          x: pos.x,
          y: pos.y,
          z: pos.z,
          ...this.buildDatavaultFlags(attrib)
        }
        sectorData.erlkingVaults.push(entry)
      } else if (this.isAbandonedShip() && sectorData) {
        const entry: AbandonedShipEntry = {
          code: String(attrib.code || ''),
          macro: String(attrib.macro || ''),
          class: String(attrib.class || ''),
          x: pos.x,
          y: pos.y,
          z: pos.z
        }
        sectorData.abandonedShips.push(entry)
      }

      if (node.attributes.class === 'sector') {
        this.currentSectorStack.pop()
      }

      this.componentStack.pop()
    }

    if (this.path.length > 0 && this.path[this.path.length - 1]?.name === name) {
      this.path.pop()
      return
    }

    for (let i = this.path.length - 1; i >= 0; i--) {
      if (this.path[i]?.name === name) {
        this.path.splice(i, 1)
        break
      }
    }
  }

  getTagCount(): number {
    return this.tagCount
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

export function buildSaveArchive(data: SaveData, config: SaveParserConfig): SaveArchive {
  return {
    meta: {
      ...data.meta,
      filename: stripSaveFileExtension(config.filename || ''),
      parser_version: 'v1',
      source: 'original'
    },
    sectors: data.sectors,
    isCompatible: normalizeVersion(data.meta.version) === normalizeVersion(config.currentVersion)
  }
}

export function createSaveParserRuntime(
  config: SaveParserConfig,
  options?: {
    onProgress?: (info: SaveParserProgressInfo) => void
  }
): SaveParserRuntime {
  const parser = new X4SaveParser(config)
  const saxParser = sax.parser(false, { lowercase: true, position: false })
  let bytesProcessed = 0

  saxParser.onopentag = (node: TagNode) => {
    parser.onOpenTag(node)
  }

  saxParser.onclosetag = (name: string) => {
    parser.onCloseTag(name)
  }

  saxParser.onerror = (err: Error) => {
    throw err
  }

  const emitProgress = () => {
    options?.onProgress?.({
      bytesProcessed,
      tagCount: parser.getTagCount(),
      sectorsCount: Object.keys(parser.data.sectors).length
    })
  }

  return {
    feed(text: string) {
      if (!text) return
      bytesProcessed += text.length
      for (let i = 0; i < text.length; i += SAX_WRITE_CHUNK_SIZE) {
        saxParser.write(text.slice(i, i + SAX_WRITE_CHUNK_SIZE))
      }
      emitProgress()
    },
    close() {
      saxParser.close()
      return buildSaveArchive(parser.data, config)
    },
    getProgress() {
      return {
        bytesProcessed,
        tagCount: parser.getTagCount(),
        sectorsCount: Object.keys(parser.data.sectors).length
      }
    },
    getData() {
      return parser.data
    }
  }
}

export async function parseSaveXmlChunks(
  runtime: SaveParserRuntime,
  chunks: Iterable<string> | AsyncIterable<string>
): Promise<SaveArchive> {
  for await (const chunk of chunks) {
    runtime.feed(chunk)
  }
  return runtime.close()
}

type WorkerMessageData = { type: string; arrayBuffer?: ArrayBuffer; config?: SaveParserConfig; filename?: string }

function hasWorkerRuntime(): boolean {
  const scope = globalThis as { postMessage?: unknown; self?: unknown; importScripts?: unknown }
  return typeof globalThis !== 'undefined'
    && typeof scope.postMessage === 'function'
    && typeof scope.self !== 'undefined'
    && typeof scope.importScripts === 'function'
}

if (hasWorkerRuntime()) {
  self.onmessage = async (e: MessageEvent<WorkerMessageData>) => {
    const { type, arrayBuffer, config, filename } = e.data

    if (type !== 'parse' || !arrayBuffer || !config) return

    try {
      self.postMessage({ type: 'progress', status: 'Starting parse...' } as SaveParserMessage)

      const header = new Uint8Array(arrayBuffer.slice(0, 2))
      const isGzipped = header[0] === 0x1f && header[1] === 0x8b
      const blob = new Blob([arrayBuffer])
      let textStream: ReadableStream<Uint8Array>

      if (isGzipped) {
        self.postMessage({ type: 'progress', status: 'Decompressing...' } as SaveParserMessage)
        textStream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
      } else {
        textStream = blob.stream()
      }

      self.postMessage({ type: 'progress', status: 'Parsing XML...' } as SaveParserMessage)

      const runtime = createSaveParserRuntime({ ...config, filename })
      const reader = textStream.getReader()
      const decoder = new TextDecoder()
      let lastReportedMB = -1

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        runtime.feed(decoder.decode(value, { stream: true }))

        const progress = runtime.getProgress()
        const currentMB = Math.floor(progress.bytesProcessed / (1024 * 1024))
        if (currentMB > lastReportedMB) {
          lastReportedMB = currentMB
          self.postMessage({
            type: 'progress',
            status: `Processing ... ${currentMB} MB, sectors ${progress.sectorsCount}`
          } as SaveParserMessage)
        }
      }

      const tail = decoder.decode()
      if (tail) {
        runtime.feed(tail)
      }

      const archive = runtime.close()
      self.postMessage({ type: 'complete', data: archive } as SaveParserMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[saveParser] error:', message, error)
      self.postMessage({ type: 'error', message } as SaveParserMessage)
    }
  }
}
