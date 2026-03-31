import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createSaveParserRuntime } from '../src/workers/saveParserSimplified.worker'
import type { SaveArchive } from '../src/types/saveArchive'

function printUsage(): void {
  console.log('Usage: npm exec tsx scripts/extract_save.tsx <input.xml|input.xml.gz|input.gz> [output.json] [--wasm]')
  console.log('')
  console.log('Options:')
  console.log('  --wasm    Use Rust WASM parser (3.25x faster, experimental)')
}

function parseArgs(): { input: string; output: string; useWasm: boolean } {
  const args = process.argv.slice(2)
  const useWasm = args.includes('--wasm')
  const positional = args.filter(a => !a.startsWith('--'))
  const input = positional[0]
  const output = positional[1]
  return { input, output, useWasm }
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

async function extractSaveSaxJs(inputPath: string, outputPath: string): Promise<SaveArchive> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log(`[extract_save] parser: sax-js`)
  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)

  const sourceStream = fs.createReadStream(absoluteInput)
  const dataStream = gzip ? sourceStream.pipe(zlib.createGunzip()) : sourceStream

  const runtime = createSaveParserRuntime({
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

async function extractSaveWasm(inputPath: string, outputPath: string): Promise<SaveArchive> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log(`[extract_save] parser: Rust WASM (experimental)`)
  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)

  const initWasm = (await import('../src/wasm/save_parser.js')).default
  const { SaveParser } = await import('../src/wasm/save_parser.js')
  const wasmPath = new URL('../src/wasm/save_parser_bg.wasm', import.meta.url)
  const wasmBinary = fs.readFileSync(wasmPath)

  console.log('[extract_save] initializing WASM...')
  await initWasm({ module_or_path: wasmBinary })

  const parser = new SaveParser()

  console.log('[extract_save] reading file...')
  let inputBuffer = fs.readFileSync(absoluteInput)

  if (gzip) {
    console.log('[extract_save] decompressing...')
    inputBuffer = zlib.gunzipSync(inputBuffer)
  }

  const totalBytes = inputBuffer.length
  console.log(`[extract_save] decompressed size: ${formatMB(totalBytes)} MB`)

  console.log('[extract_save] parsing...')
  const start = performance.now()
  parser.feed(new Uint8Array(inputBuffer))
  const result = parser.finish(path.basename(absoluteInput))
  const elapsed = performance.now() - start

  console.log(`[extract_save] parse time: ${elapsed.toFixed(2)}ms`)

  const archive: SaveArchive = JSON.parse(result)
  
  console.log(`[extract_save] done: sectors ${Object.keys(archive.sectors).length}, compatible=${archive.isCompatible}`)
  fs.writeFileSync(absoluteOutput, JSON.stringify(archive, null, 2))
  console.log(`[extract_save] json written: ${absoluteOutput}`)

  return archive
}

async function main(): Promise<void> {
  const { input, output, useWasm } = parseArgs()

  if (!input) {
    printUsage()
    process.exitCode = 1
    return
  }

  try {
    if (useWasm) {
      await extractSaveWasm(input, output || defaultOutputPath(input))
    } else {
      await extractSaveSaxJs(input, output || defaultOutputPath(input))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[extract_save] failed: ${message}`)
    process.exitCode = 1
  }
}

void main()