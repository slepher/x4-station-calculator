import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createSaveParserRuntime } from '../src/workers/saveParser.worker'
import type { SaveArchive, ProgressInfo } from '../src/types/saveArchive'

function printUsage(): void {
  console.log('Usage: npm exec tsx scripts/extract_save.tsx <input.xml|input.xml.gz|input.gz> [output.json] [options]')
  console.log('')
  console.log('Options:')
  console.log('  --wasm         Use Rust WASM parser (3.25x faster, experimental)')
  console.log('  --version <v>  Expected game version (e.g., "8.0"). If not set, version check is skipped')
}

function parseArgs(): { input: string; output: string; useWasm: boolean; expectedVersion: string | null } {
  const args = process.argv.slice(2)
  const useWasm = args.includes('--wasm')
  
  let expectedVersion: string | null = null
  const versionIndex = args.indexOf('--version')
  if (versionIndex !== -1 && args[versionIndex + 1] && !args[versionIndex + 1].startsWith('--')) {
    expectedVersion = args[versionIndex + 1]
  }
  
  // Filter out options and their values
  const positional = args.filter((a, i) => {
    if (a.startsWith('--')) return false
    if (versionIndex !== -1 && (i === versionIndex + 1)) return false
    return true
  })
  
  const input = positional[0]
  const output = positional[1]
  return { input, output, useWasm, expectedVersion }
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

function defaultOutputPath(inputPath: string): string {
  if (inputPath.toLowerCase().endsWith('.xml.gz')) return inputPath.slice(0, -7) + '.json'
  if (inputPath.toLowerCase().endsWith('.gz')) return inputPath.slice(0, -3) + '.json'
  if (inputPath.toLowerCase().endsWith('.xml')) return inputPath.slice(0, -4) + '.json'
  return inputPath + '.json'
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function getGzipUncompressedSize(buf: Buffer): number | null {
  if (buf.length < 18) return null
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return null
  return buf.readUInt32LE(buf.length - 4)
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

async function extractSaveWasm(inputPath: string, outputPath: string, expectedVersion: string | null): Promise<SaveArchive> {
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

  let inputBuffer: Buffer
  let totalBytes: number

  if (gzip) {
    console.log('[extract_save] decompressing...')
    const compressed = fs.readFileSync(absoluteInput)
    const expectedSize = getGzipUncompressedSize(compressed)
    if (expectedSize && expectedSize > 0) {
      parser.set_expected_total_bytes(expectedSize)
    }
    inputBuffer = zlib.gunzipSync(compressed)
    totalBytes = inputBuffer.length
    console.log(`[extract_save] decompressed size: ${formatMB(totalBytes)} MB`)
  } else {
    inputBuffer = fs.readFileSync(absoluteInput)
    totalBytes = inputBuffer.length
    parser.set_expected_total_bytes(totalBytes)
    console.log(`[extract_save] file size: ${formatMB(totalBytes)} MB`)
  }

  parser.push_chunk(new Uint8Array(inputBuffer))
  parser.finish_input()

  console.log('[extract_save] parsing...')
  const MAX_EVENTS_PER_PUMP = 50000
  let pumpCount = 0

  while (true) {
    const hasMore = parser.pump(MAX_EVENTS_PER_PUMP)
    pumpCount++

    const progressJson = parser.progress_json()
    const progress = JSON.parse(progressJson) as ProgressInfo

    if (pumpCount % 20 === 0 || !hasMore) {
      console.log(
        `[extract_save] ${progress.percent.toFixed(1)}% parsed, ${formatMB(progress.parsedBytesTotal)} MB / ${formatMB(progress.inputBytesTotal)} MB, ${progress.tagCount} tags, ${progress.sectorCount} sectors`
      )
    }
    
    if (progress.error) {
      if (progress.errorDetail) {
        console.error('[extract_save] error detail:', JSON.stringify(progress.errorDetail, null, 2))
      }
      throw new Error(progress.error)
    }

    if (!hasMore) break
  }

  const elapsed = performance.now() - start
  console.log(`[extract_save] parse time: ${elapsed.toFixed(0)}ms`)

  const result = parser.finish(path.basename(absoluteInput))
  const archive: SaveArchive = JSON.parse(result)

  console.log(`[extract_save] done: sectors ${Object.keys(archive.sectors).length}, compatible=${archive.isCompatible}`)
  fs.writeFileSync(absoluteOutput, JSON.stringify(archive, null, 2))
  console.log(`[extract_save] json written: ${absoluteOutput}`)

  return archive
}

async function main(): Promise<void> {
  const { input, output, useWasm, expectedVersion } = parseArgs()

  if (!input) {
    printUsage()
    process.exitCode = 1
    return
  }

  try {
    if (useWasm) {
      await extractSaveWasm(input, output || defaultOutputPath(input), expectedVersion)
    } else {
      await extractSaveSaxJs(input, output || defaultOutputPath(input), expectedVersion)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[extract_save] failed: ${message}`)
    process.exitCode = 1
  }
}

void main()