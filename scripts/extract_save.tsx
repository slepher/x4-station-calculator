import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import sax from 'sax'
import getopts from 'getopts'
import { createSaveParserRuntime, createSaveXmlFilterRuntime, createComponentXmlFilterRuntime } from '../src/workers/saveParser.worker'
import type { SaveArchive, ProgressInfo } from '../src/types/saveArchive'
import { postProcessRustSaveArchive } from '../src/workers/saveParser.post'
import type { X4Module, X4Map, X4Ship, X4Equipment } from '../src/types/x4'

interface FilteredXmlResult {
  xml: string
  sectorCount: number
}

interface FilteredXmlRuntime {
  feed: (xmlChunk: string) => void
  close: () => { sectorCount: number }
}

interface FilteredXmlRuntimeOptions {
  expectedVersion: string | null
  write: (chunk: string) => void
}

interface QueryTag {
  name: string
  attributes: Record<string, string>
}

interface QueryXmlResult {
  xml: string
  matchCount: number
}

interface QueryXmlRuntime {
  feed: (xmlChunk: string) => void
  close: () => { matchCount: number }
}

interface QueryXmlRuntimeOptions {
  query: QueryTag
  write: (chunk: string) => void
}

interface QueryXmlNode {
  name: string
  attrStr: string
  depth: number
  isSelfClosing: boolean
}

interface QueryTreeNode {
  name: string
  attrStr: string
  selfClosing: boolean
  children: QueryTreeNode[]
}

interface QueryMatch {
  ancestors: QueryXmlNode[]
  root: QueryTreeNode
}

interface ComponentFilterOptions {
  className: string
  codes: string[]
}

function printHelp(): void {
  console.log('Usage: vite-node scripts/extract_save.tsx <input.xml|input.xml.gz|input.gz> [output] [options]')
  console.log('')
  console.log('Extract and parse X4: Foundations save files into JSON or filtered XML.')
  console.log('')
  console.log('Positional arguments:')
  console.log('  input              Input save file (.xml, .xml.gz, or .gz)')
  console.log('  output             Output file path (default: derived from input name)')
  console.log('')
  console.log('Options:')
  console.log('  -h, --help         Show this help message and exit')
  console.log('  --wasm             Use Rust WASM parser (3.25x faster, experimental)')
  console.log('  --xml              Output as XML instead of JSON (extracts only relevant data)')
  console.log('  --class <c>        Filter by component class (e.g., station, sector, ship_l)')
  console.log('  --code <c>         Filter by component code (comma-separated, e.g., XAJ-926,FIX-154)')
  console.log('  --query-xml <q>    Output matching tags with full subtree and ancestor chain as XML')
  console.log('  --version <v>      Expected game version (e.g., "8.0"). Skipped if not set')
  console.log('  --skip-post        Skip post-processing (output raw parsed data without tag inference)')
  console.log('')
  console.log('Examples:')
  console.log('  vite-node scripts/extract_save.tsx save_009.xml')
  console.log('  vite-node scripts/extract_save.tsx save_009.xml.gz --wasm')
  console.log('  vite-node scripts/extract_save.tsx save_009.xml out.json --version 8.0')
  console.log('  vite-node scripts/extract_save.tsx save_009.xml --xml')
  console.log('  vite-node scripts/extract_save.tsx save_009.xml --query-xml \'<component class="station"/>\'')
  console.log('  vite-node scripts/extract_save.tsx save_009.xml --class station --code XAJ-926,FIX-154')
}

interface ParsedArgs {
  input: string
  output: string
  useWasm: boolean
  outputXml: boolean
  queryXml: string | null
  componentFilter: ComponentFilterOptions | null
  expectedVersion: string | null
  skipPost: boolean
}

function parseArgs(): ParsedArgs & { help: boolean } {
  const rawArgv = process.argv.slice(2)
  const argv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv
  const opts = getopts(argv, {
    alias: {
      h: 'help',
    },
    boolean: ['help', 'wasm', 'xml', 'skip-post'],
    string: ['class', 'code', 'query-xml', 'version'],
  })

  const help = opts.help as boolean
  const useWasm = opts.wasm as boolean
  const outputXml = opts.xml as boolean
  const skipPost = opts['skip-post'] as boolean
  const queryXml = (opts['query-xml'] as string) || null
  const expectedVersion = (opts.version as string) || null

  let componentFilter: ComponentFilterOptions | null = null
  const codeValue = opts.code as string | undefined
  if (codeValue) {
    const className = (opts.class as string) || ''
    const codes = codeValue.split(',').map(c => c.trim()).filter(c => c.length > 0)
    componentFilter = { className, codes }
  }

  const input = opts._[0] || ''
  const output = opts._[1] || ''

  return { input, output, useWasm, outputXml, queryXml, componentFilter, expectedVersion, skipPost, help }
}

function isGzipFile(filePath: string): boolean {
  if (filePath.toLowerCase().endsWith('.gz')) return true
  const fd = fs.openSync(filePath, 'r')
  try {
    const header = Buffer.alloc(2)
    fs.readSync(fd, header, 0, 2, 0)
    return header[0] === 0x1f && header[1] === 0x8b
  } finally {
    fs.closeSync(fd)
  }
}

function defaultOutputPath(inputPath: string, outputXml: boolean): string {
  const ext = outputXml ? '.filtered.xml' : '.json'
  if (inputPath.toLowerCase().endsWith('.xml.gz')) return inputPath.slice(0, -7) + ext
  if (inputPath.toLowerCase().endsWith('.gz')) return inputPath.slice(0, -3) + ext
  if (inputPath.toLowerCase().endsWith('.xml')) return inputPath.slice(0, -4) + ext
  return inputPath + ext
}

function defaultQueryOutputPath(inputPath: string): string {
  if (inputPath.toLowerCase().endsWith('.xml.gz')) return inputPath.slice(0, -7) + '.query.xml'
  if (inputPath.toLowerCase().endsWith('.gz')) return inputPath.slice(0, -3) + '.query.xml'
  if (inputPath.toLowerCase().endsWith('.xml')) return inputPath.slice(0, -4) + '.query.xml'
  return inputPath + '.query.xml'
}

function defaultComponentOutputPath(inputPath: string, className: string, codes: string[]): string {
  const baseName = inputPath
    .replace(/\.xml\.gz$/i, '')
    .replace(/\.gz$/i, '')
    .replace(/\.xml$/i, '')
    .replace(/.*[\/\\]/, '')
  
  const classPart = className ? `_${className}` : ''
  const codesPart = codes.length === 1 ? codes[0] : `${codes.length}codes`
  return `${baseName}${classPart}_${codesPart}.xml`
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function getGzipUncompressedSize(buf: Buffer): number | null {
  if (buf.length < 4) return null
  return buf.readUInt32LE(buf.length - 4)
}

function getGzipUncompressedSizeFromFile(filePath: string): number | null {
  const stat = fs.statSync(filePath)
  if (stat.size < 18) return null
  const header = Buffer.alloc(2)
  const trailer = Buffer.alloc(4)
  const fd = fs.openSync(filePath, 'r')
  try {
    fs.readSync(fd, header, 0, 2, 0)
    if (header[0] !== 0x1f || header[1] !== 0x8b) return null
    fs.readSync(fd, trailer, 0, 4, stat.size - 4)
  } finally {
    fs.closeSync(fd)
  }
  return trailer.readUInt32LE(0)
}

function loadModulesByMacroId(version: string | null): Record<string, X4Module> | undefined {
  if (!version) return undefined
  
  const versionConfigPath = path.resolve(process.cwd(), 'src/assets/versions.json')
  if (!fs.existsSync(versionConfigPath)) {
    console.warn(`[extract_save] versions.json not found at ${versionConfigPath}, skipping module enrichment`)
    return undefined
  }
  
  const versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'))
  const versionInfo = versionConfig.versions?.find((v: { version: string }) => String(v.version) === version)
  if (!versionInfo) {
    console.warn(`[extract_save] version ${version} not found in versions.json, skipping module enrichment`)
    return undefined
  }
  
  const folderName = versionInfo.folder_name || version
  const modulesPath = path.resolve(process.cwd(), `src/assets/x4_game_data/${folderName}/data/modules.json`)
  
  if (!fs.existsSync(modulesPath)) {
    console.warn(`[extract_save] modules.json not found at ${modulesPath}, skipping module enrichment`)
    return undefined
  }
  
  const modules: X4Module[] = JSON.parse(fs.readFileSync(modulesPath, 'utf-8'))
  const modulesByMacroId: Record<string, X4Module> = {}
  
  for (const module of modules) {
    if (module.macroId && module.isPlayerBlueprint) {
      modulesByMacroId[module.macroId] = module
    }
  }
  
  console.log(`[extract_save] loaded ${Object.keys(modulesByMacroId).length} modules for version ${version}`)
  return modulesByMacroId
}

function loadMaps(version: string | null): X4Map | undefined {
  if (!version) return undefined
  
  const versionConfigPath = path.resolve(process.cwd(), 'src/assets/versions.json')
  if (!fs.existsSync(versionConfigPath)) {
    console.warn(`[extract_save] versions.json not found at ${versionConfigPath}, skipping maps loading`)
    return undefined
  }
  
  const versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'))
  const versionInfo = versionConfig.versions?.find((v: { version: string }) => String(v.version) === version)
  if (!versionInfo) {
    console.warn(`[extract_save] version ${version} not found in versions.json, skipping maps loading`)
    return undefined
  }
  
  const folderName = versionInfo.folder_name || version
  const mapsPath = path.resolve(process.cwd(), `src/assets/x4_game_data/${folderName}/data/maps.json`)
  
  if (!fs.existsSync(mapsPath)) {
    console.warn(`[extract_save] maps.json not found at ${mapsPath}, skipping maps loading`)
    return undefined
  }
  
  const maps: X4Map = JSON.parse(fs.readFileSync(mapsPath, 'utf-8'))
  
  const clusterCount = Object.keys(maps.clusters).length
  const sectorCount = Object.keys(maps.sectors || {}).length
  const zoneCount = Object.values(maps.sectors || {}).reduce(
    (sum, sector) => sum + Object.keys(sector.zones || {}).length,
    0
  )
  
  console.log(`[extract_save] loaded maps for version ${version}: ${clusterCount} clusters, ${sectorCount} sectors, ${zoneCount} zones`)
  return maps
}

function loadShips(version: string | null): X4Ship[] | undefined {
  if (!version) return undefined
  
  const versionConfigPath = path.resolve(process.cwd(), 'src/assets/versions.json')
  if (!fs.existsSync(versionConfigPath)) {
    console.warn(`[extract_save] versions.json not found at ${versionConfigPath}, skipping ships loading`)
    return undefined
  }
  
  const versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'))
  const versionInfo = versionConfig.versions?.find((v: { version: string }) => String(v.version) === version)
  if (!versionInfo) {
    console.warn(`[extract_save] version ${version} not found in versions.json, skipping ships loading`)
    return undefined
  }
  
  const folderName = versionInfo.folder_name || version
  const shipsPath = path.resolve(process.cwd(), `src/assets/x4_game_data/${folderName}/data/ships.json`)
  
  if (!fs.existsSync(shipsPath)) {
    console.warn(`[extract_save] ships.json not found at ${shipsPath}, skipping ships loading`)
    return undefined
  }
  
  const ships: X4Ship[] = JSON.parse(fs.readFileSync(shipsPath, 'utf-8'))
  console.log(`[extract_save] loaded ${ships.length} ships for version ${version}`)
  return ships
}

function loadEquipments(version: string | null): X4Equipment[] | undefined {
  if (!version) return undefined
  
  const versionConfigPath = path.resolve(process.cwd(), 'src/assets/versions.json')
  if (!fs.existsSync(versionConfigPath)) {
    console.warn(`[extract_save] versions.json not found at ${versionConfigPath}, skipping equipments loading`)
    return undefined
  }
  
  const versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'))
  const versionInfo = versionConfig.versions?.find((v: { version: string }) => String(v.version) === version)
  if (!versionInfo) {
    console.warn(`[extract_save] version ${version} not found in versions.json, skipping equipments loading`)
    return undefined
  }
  
  const folderName = versionInfo.folder_name || version
  const equipmentsPath = path.resolve(process.cwd(), `src/assets/x4_game_data/${folderName}/data/equipments.json`)
  
  if (!fs.existsSync(equipmentsPath)) {
    console.warn(`[extract_save] equipments.json not found at ${equipmentsPath}, skipping equipments loading`)
    return undefined
  }
  
  const equipments: X4Equipment[] = JSON.parse(fs.readFileSync(equipmentsPath, 'utf-8'))
  console.log(`[extract_save] loaded ${equipments.length} equipments for version ${version}`)
  return equipments
}

function pumpWasmParser(options: {
  parser: {
    pump: (maxEvents: number) => boolean
    progress_json: () => string
    take_cli_progress_json?: () => string
  }
  maxEventsPerPump: number
  onProgress: (progress: ProgressInfo) => void
}): void {
  while (true) {
    const hasMore = options.parser.pump(options.maxEventsPerPump)
    const cliProgressJson = options.parser.take_cli_progress_json?.() || ''
    if (cliProgressJson) {
      options.onProgress(JSON.parse(cliProgressJson) as ProgressInfo)
    }
    const progress = JSON.parse(options.parser.progress_json()) as ProgressInfo

    if (progress.error) {
      if (progress.errorDetail) {
        console.error('[extract_save] error detail:', JSON.stringify(progress.errorDetail, null, 2))
      }
      throw new Error(progress.error)
    }

    if (!hasMore) return
  }
}

export function createFilteredSaveXmlRuntime(options: FilteredXmlRuntimeOptions): FilteredXmlRuntime {
  return createSaveXmlFilterRuntime({
    currentVersion: options.expectedVersion,
    write: options.write
  })
}

export function extractFilteredSaveXmlFromString(xml: string, expectedVersion: string | null): FilteredXmlResult {
  const output: string[] = []
  const runtime = createFilteredSaveXmlRuntime({
    expectedVersion,
    write: (chunk) => output.push(chunk)
  })
  runtime.feed(xml)
  const result = runtime.close()
  return {
    xml: output.join(''),
    sectorCount: result.sectorCount
  }
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function serializeXmlAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes)
  if (entries.length === 0) return ''
  return ' ' + entries.map(([k, v]) => `${k}="${escapeXmlAttribute(v)}"`).join(' ')
}

export function parseQueryTag(query: string): QueryTag {
  const trimmed = query.trim()
  const inner = trimmed
    .replace(/^<\s*/, '')
    .replace(/\s*\/?>\s*$/, '')
    .trim()

  const nameMatch = inner.match(/^([^\s,]+)(.*)$/)
  if (!nameMatch) {
    throw new Error(`Invalid query tag: ${query}`)
  }

  const rawName = nameMatch[1].replace(/^\[/, '').replace(/\]$/, '')
  const rest = nameMatch[2] || ''
  const attributes: Record<string, string> = {}
  const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*"([^"]*)"|([a-zA-Z0-9_:-]+)\s*=\s*'([^']*)'/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(rest)) !== null) {
    const key = (match[1] || match[3] || '').toLowerCase()
    const value = match[2] ?? match[4] ?? ''
    attributes[key] = value
  }

  return {
    name: rawName.toLowerCase(),
    attributes
  }
}

function nodeMatchesQuery(node: QueryXmlNode, query: QueryTag): boolean {
  if (node.name !== query.name) return false
  for (const [key, value] of Object.entries(query.attributes)) {
    const attrPattern = new RegExp(`${key}="([^"]*)"`)
    const attrMatch = node.attrStr.match(attrPattern)
    if (!attrMatch || attrMatch[1] !== value) return false
  }
  return true
}

function serializeQueryTree(node: QueryTreeNode, depth: number): string[] {
  const indent = '  '.repeat(depth)
  if (node.selfClosing && node.children.length === 0) {
    return [`${indent}<${node.name}${node.attrStr}/>`]
  }

  const lines = [`${indent}<${node.name}${node.attrStr}>`]
  for (const child of node.children) {
    lines.push(...serializeQueryTree(child, depth + 1))
  }
  lines.push(`${indent}</${node.name}>`)
  return lines
}

function writeAncestorChain(lines: string[], ancestors: QueryXmlNode[], root: QueryTreeNode, depth: number): void {
  if (ancestors.length === 0) {
    lines.push(...serializeQueryTree(root, depth))
    return
  }

  const [head, ...tail] = ancestors
  const indent = '  '.repeat(depth)
  lines.push(`${indent}<${head.name}${head.attrStr}>`)
  writeAncestorChain(lines, tail, root, depth + 1)
  lines.push(`${indent}</${head.name}>`)
}

export function createQueryXmlRuntime(options: QueryXmlRuntimeOptions): QueryXmlRuntime {
  const parser = sax.parser(false, { lowercase: true, position: false })
  const pathStack: QueryXmlNode[] = []
  const activeCaptures: Array<{ rootDepth: number; nodeStack: QueryTreeNode[]; ancestors: QueryXmlNode[] }> = []
  const matches: QueryMatch[] = []

  parser.onopentag = (node: sax.Tag) => {
    const attrEntries = Object.entries(node.attributes).map(([k, v]) => [k.toLowerCase(), String(v)] as const)
    const currentNode: QueryXmlNode = {
      name: node.name,
      attrStr: serializeXmlAttributes(Object.fromEntries(attrEntries)),
      depth: pathStack.length + 1,
      isSelfClosing: node.isSelfClosing === true
    }
    pathStack.push(currentNode)

    for (const capture of activeCaptures) {
      if (currentNode.depth <= capture.rootDepth) continue
      const treeNode: QueryTreeNode = {
        name: currentNode.name,
        attrStr: currentNode.attrStr,
        selfClosing: currentNode.isSelfClosing,
        children: []
      }
      const parent = capture.nodeStack[capture.nodeStack.length - 1]
      parent.children.push(treeNode)
      if (!currentNode.isSelfClosing) {
        capture.nodeStack.push(treeNode)
      }
    }

    if (nodeMatchesQuery(currentNode, options.query)) {
      const root: QueryTreeNode = {
        name: currentNode.name,
        attrStr: currentNode.attrStr,
        selfClosing: currentNode.isSelfClosing,
        children: []
      }
      const capture = {
        rootDepth: currentNode.depth,
        nodeStack: currentNode.isSelfClosing ? [] : [root],
        ancestors: pathStack.slice(0, -1).map((ancestor) => ({ ...ancestor }))
      }
      matches.push({ ancestors: capture.ancestors, root })
      if (!currentNode.isSelfClosing) {
        activeCaptures.push(capture)
      }
    }
  }

  parser.ontext = () => {}
  parser.oncdata = () => {}
  parser.onerror = (err: Error) => {
    throw err
  }

  parser.onclosetag = () => {
    const currentNode = pathStack[pathStack.length - 1]
    if (currentNode) {
      for (let i = activeCaptures.length - 1; i >= 0; i--) {
        const capture = activeCaptures[i]
        if (currentNode.depth < capture.rootDepth) continue
        if (currentNode.depth === capture.rootDepth) {
          activeCaptures.splice(i, 1)
          continue
        }
        if (!currentNode.isSelfClosing) {
          capture.nodeStack.pop()
        }
      }
    }
    pathStack.pop()
  }

  return {
    feed(xmlChunk: string) {
      parser.write(xmlChunk)
    },
    close() {
      parser.close()
      options.write('<?xml version="1.0" encoding="utf-8"?>\n')
      options.write('<query-results>\n')
      matches.forEach((match, index) => {
        const lines = [`  <match index="${index + 1}">`]
        writeAncestorChain(lines, match.ancestors, match.root, 2)
        lines.push('  </match>')
        options.write(lines.join('\n') + '\n')
      })
      options.write('</query-results>\n')
      return { matchCount: matches.length }
    }
  }
}

export function extractQueryXmlFromString(xml: string, query: string): QueryXmlResult {
  const output: string[] = []
  const runtime = createQueryXmlRuntime({
    query: parseQueryTag(query),
    write: (chunk) => output.push(chunk)
  })
  runtime.feed(xml)
  const result = runtime.close()
  return {
    xml: output.join(''),
    matchCount: result.matchCount
  }
}

async function extractSaveQueryXml(inputPath: string, outputPath: string, query: string): Promise<void> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log('[extract_save] parser: sax-js (query XML output)')
  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)
  console.log(`[extract_save] query: ${query}`)

  const sourceStream = fs.createReadStream(absoluteInput)
  const dataStream = gzip ? sourceStream.pipe(zlib.createGunzip()) : sourceStream
  const outputFd = fs.openSync(absoluteOutput, 'w')
  const runtime = createQueryXmlRuntime({
    query: parseQueryTag(query),
    write: (chunk) => {
      fs.writeSync(outputFd, chunk)
    }
  })

  const decoder = new TextDecoder()
  for await (const chunk of dataStream as AsyncIterable<Buffer>) {
    runtime.feed(decoder.decode(chunk, { stream: true }))
  }

  const tail = decoder.decode()
  if (tail) {
    runtime.feed(tail)
  }

  try {
    const result = runtime.close()
    console.log(`[extract_save] done: ${result.matchCount} matches`)
  } finally {
    fs.closeSync(outputFd)
  }

  console.log(`[extract_save] xml written: ${absoluteOutput}`)
}

async function extractSaveComponentXml(inputPath: string, outputPath: string, filter: ComponentFilterOptions): Promise<void> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log('[extract_save] parser: sax-js (component XML output)')
  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)
  console.log(`[extract_save] filter: class=${filter.className || '(any)'}, codes=${filter.codes.join(',')}`)

  const sourceStream = fs.createReadStream(absoluteInput)
  const dataStream = gzip ? sourceStream.pipe(zlib.createGunzip()) : sourceStream
  
  const outputFd = fs.openSync(absoluteOutput, 'w')
  fs.writeSync(outputFd, '<?xml version="1.0" encoding="utf-8"?>\n')
  
  const runtime = createComponentXmlFilterRuntime({
    codeFilters: filter.codes,
    classFilter: filter.className || null,
    write: (chunk) => {
      fs.writeSync(outputFd, chunk)
    }
  })

  let bytesRead = 0
  let nextLogMB = 10

  sourceStream.on('data', (chunk: string | Buffer) => {
    bytesRead += typeof chunk === 'string' ? chunk.length : chunk.length
    const mb = (bytesRead / (1024 * 1024)).toFixed(1)
    if (bytesRead >= nextLogMB * 1024 * 1024) {
      console.log(`[extract_save] read ${mb} MB / ${formatMB(stat.size)} MB`)
      nextLogMB += 10
    }
  })

  const decoder = new TextDecoder()
  for await (const chunk of dataStream as AsyncIterable<Buffer>) {
    runtime.feed(decoder.decode(chunk, { stream: true }))
  }

  const tail = decoder.decode()
  if (tail) {
    runtime.feed(tail)
  }

  try {
    const result = runtime.close()
    console.log(`[extract_save] done: ${result.matchCount} matches`)
  } finally {
    fs.closeSync(outputFd)
  }
  
  console.log(`[extract_save] xml written: ${absoluteOutput}`)
}

async function extractSaveSaxJs(inputPath: string, outputPath: string, expectedVersion: string | null): Promise<SaveArchive> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log(`[extract_save] parser: sax-js`)
  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)
  if (expectedVersion) {
    console.log(`[extract_save] expected version: ${expectedVersion}`)
  } else {
    console.log(`[extract_save] version check: skipped`)
  }

  const sourceStream = fs.createReadStream(absoluteInput)
  const dataStream = gzip ? sourceStream.pipe(zlib.createGunzip()) : sourceStream

  const runtime = createSaveParserRuntime({
    currentVersion: expectedVersion || undefined,
    onProgress: (progress) => {
      console.log(
        `[extract_save] parsed ${formatMB(progress.bytesProcessed)} MB, tags ${progress.tagCount}, sectors ${progress.sectorsCount}`
      )
    }
  })

  let sourceBytesRead = 0
  let nextSourceLogMB = 10

  sourceStream.on('data', (chunk: string | Buffer) => {
    sourceBytesRead += typeof chunk === 'string' ? chunk.length : chunk.length
    const sourceMB = sourceBytesRead / (1024 * 1024)
    if (sourceMB >= nextSourceLogMB) {
      console.log(`[extract_save] read source ${formatMB(sourceBytesRead)} MB / ${formatMB(stat.size)} MB`)
      nextSourceLogMB += 10
    }
  })

  const decoder = new TextDecoder()
  for await (const chunk of dataStream as AsyncIterable<Buffer>) {
    runtime.feed(decoder.decode(chunk, { stream: true }))
  }

  const tail = decoder.decode()
  if (tail) runtime.feed(tail)

  const archive = runtime.close(path.basename(absoluteInput))
  fs.writeFileSync(absoluteOutput, JSON.stringify(archive, null, 2))

  console.log(`[extract_save] done: sectors ${Object.keys(archive.sectors).length}, compatible=${archive.isCompatible}`)
  console.log(`[extract_save] json written: ${absoluteOutput}`)

  return archive
}

async function extractSaveToXml(inputPath: string, outputPath: string, expectedVersion: string | null): Promise<void> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log(`[extract_save] parser: sax-js (XML output)`)
  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)
  if (expectedVersion) {
    console.log(`[extract_save] expected version: ${expectedVersion}`)
  } else {
    console.log(`[extract_save] version check: skipped`)
  }

  const sourceStream = fs.createReadStream(absoluteInput)
  const dataStream = gzip ? sourceStream.pipe(zlib.createGunzip()) : sourceStream

  let sectorCount = 0
  let sourceBytesRead = 0
  let nextSourceLogMB = 10
  const outputFd = fs.openSync(absoluteOutput, 'w')
  const runtime = createFilteredSaveXmlRuntime({
    expectedVersion,
    write: (chunk) => {
      fs.writeSync(outputFd, chunk)
    }
  })
  
  sourceStream.on('data', (chunk: string | Buffer) => {
    sourceBytesRead += typeof chunk === 'string' ? chunk.length : chunk.length
    const sourceMB = sourceBytesRead / (1024 * 1024)
    if (sourceMB >= nextSourceLogMB) {
      console.log(`[extract_save] read source ${formatMB(sourceBytesRead)} MB / ${formatMB(stat.size)} MB, sectors: ${sectorCount}`)
      nextSourceLogMB += 10
    }
  })

  const decoder = new TextDecoder()
  for await (const chunk of dataStream as AsyncIterable<Buffer>) {
    runtime.feed(decoder.decode(chunk, { stream: true }))
  }

  const tail = decoder.decode()
  if (tail) {
    runtime.feed(tail)
  }

  try {
    const result = runtime.close()
    sectorCount = result.sectorCount
  } finally {
    fs.closeSync(outputFd)
  }

  console.log(`[extract_save] done: ${sectorCount} sectors`)
  console.log(`[extract_save] xml written: ${absoluteOutput}`)
}

async function extractSaveWasm(inputPath: string, outputPath: string, expectedVersion: string | null, skipPost: boolean): Promise<SaveArchive> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log(`[extract_save] parser: Rust WASM`)
  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)
  if (expectedVersion) {
    console.log(`[extract_save] expected version: ${expectedVersion}`)
  } else {
    console.log(`[extract_save] version check: skipped`)
  }
  if (skipPost) {
    console.log(`[extract_save] post-processing: skipped`)
  }

  const initWasm = (await import('../src/wasm/save_parser.js')).default
  const { SaveParser } = await import('../src/wasm/save_parser.js')

  const wasmPath = path.resolve(process.cwd(), 'src/wasm/save_parser_bg.wasm')
  const wasmBinary = fs.readFileSync(wasmPath)
  await initWasm({ module_or_path: wasmBinary })

  const parser = new SaveParser()
  
  if (expectedVersion) {
    parser.set_expected_version(expectedVersion)
  }
  
  const start = performance.now()

  console.log('[extract_save] parsing...')
  const MAX_EVENTS_PER_PUMP = 50000
  const reportProgress = (progress: ProgressInfo) => {
    console.log(
      `[extract_save] ${progress.percent.toFixed(1)}% parsed, ${formatMB(progress.parsedBytesTotal)} MB / ${formatMB(progress.expectedTotalBytes || progress.inputBytesTotal)} MB, ${progress.tagCount} tags, ${progress.sectorCount} sectors`
    )
  }

  if (gzip) {
    const expectedSize = getGzipUncompressedSizeFromFile(absoluteInput)
    if (expectedSize && expectedSize > 0) {
      parser.set_expected_total_bytes(expectedSize)
      console.log(`[extract_save] decompressed size: ${formatMB(expectedSize)} MB`)
    } else {
      console.log('[extract_save] decompressing...')
    }

    for await (const chunk of fs.createReadStream(absoluteInput)) {
      parser.push_chunk(new Uint8Array(chunk as Buffer))
      pumpWasmParser({
        parser,
        maxEventsPerPump: MAX_EVENTS_PER_PUMP,
        onProgress: reportProgress
      })
    }
  } else {
    parser.set_expected_total_bytes(stat.size)
    console.log(`[extract_save] file size: ${formatMB(stat.size)} MB`)
    for await (const chunk of fs.createReadStream(absoluteInput)) {
      parser.push_chunk(new Uint8Array(chunk as Buffer))
      pumpWasmParser({
        parser,
        maxEventsPerPump: MAX_EVENTS_PER_PUMP,
        onProgress: reportProgress
      })
    }
  }

  parser.finish_input()
  pumpWasmParser({
    parser,
    maxEventsPerPump: MAX_EVENTS_PER_PUMP,
    onProgress: reportProgress
  })

  const elapsed = performance.now() - start
  console.log(`[extract_save] parse time: ${elapsed.toFixed(0)}ms`)

  const result = parser.finish(path.basename(absoluteInput))
  const rawArchive = JSON.parse(result) as SaveArchive
  
  let archive: SaveArchive
  if (skipPost) {
    archive = rawArchive
  } else {
    const modulesByMacroId = loadModulesByMacroId(expectedVersion)
    const maps = loadMaps(expectedVersion)
    const ships = loadShips(expectedVersion)
    const equipments = loadEquipments(expectedVersion)
    archive = postProcessRustSaveArchive(rawArchive, modulesByMacroId, maps, ships, equipments)
  }

  console.log(`[extract_save] done: sectors ${Object.keys(archive.sectors).length}, compatible=${archive.isCompatible}`)
  fs.writeFileSync(absoluteOutput, JSON.stringify(archive, null, 2))
  console.log(`[extract_save] json written: ${absoluteOutput}`)

  return archive
}

async function main(): Promise<void> {
  const { input, output, useWasm, outputXml, queryXml, componentFilter, expectedVersion, skipPost, help } = parseArgs()

  if (help) {
    printHelp()
    return
  }

  if (!input) {
    printHelp()
    process.exitCode = 1
    return
  }

  try {
    if (componentFilter) {
      const outputPath = output || defaultComponentOutputPath(input, componentFilter.className, componentFilter.codes)
      await extractSaveComponentXml(input, outputPath, componentFilter)
    } else if (queryXml) {
      await extractSaveQueryXml(input, output || defaultQueryOutputPath(input), queryXml)
    } else if (outputXml) {
      if (useWasm) {
        console.error('[extract_save] --xml mode does not support --wasm, using JS parser')
      }
      await extractSaveToXml(input, output || defaultOutputPath(input, true), expectedVersion)
    } else if (useWasm) {
      await extractSaveWasm(input, output || defaultOutputPath(input, false), expectedVersion, skipPost)
    } else {
      await extractSaveSaxJs(input, output || defaultOutputPath(input, false), expectedVersion)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[extract_save] failed: ${message}`)
    process.exitCode = 1
  }
}

void main()
