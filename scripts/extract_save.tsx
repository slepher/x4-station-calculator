import fs from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import mapsData from '../src/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import localeEn from '../src/assets/x4_game_data/8.0-Diplomacy/locales/en.json'
import { createSaveParserRuntime, SAVE_PARSER_WASM_URL } from '../src/workers/saveParserWasm.worker'
import type { SaveArchive, SaveParserConfig } from '../src/types/saveArchive'

function printUsage(): void {
  console.log('Usage: npm exec tsx scripts/extract_save.tsx <input.xml|input.xml.gz|input.gz> [output.json]')
}

function buildConfig(): SaveParserConfig {
  const sectorNames: Record<string, string> = {}
  const positions: Record<string, { x: number; y: number; z: number }> = {}

  for (const clusterData of Object.values((mapsData as { clusters?: Record<string, unknown> }).clusters || {})) {
    const cluster = clusterData as {
      sectors?: Record<string, { name?: string; position?: { x: number; y: number; z: number } }>
      gates?: Record<string, { position?: { x: number; y: number; z: number } }>
    }

    for (const [sectorMacro, sectorInfo] of Object.entries(cluster.sectors || {})) {
      if (sectorInfo.name) {
        sectorNames[sectorMacro.toLowerCase()] = sectorInfo.name
      }
      if (sectorInfo.position) {
        positions[sectorMacro.toLowerCase()] = sectorInfo.position
      }
    }

    for (const [gateMacro, gateInfo] of Object.entries(cluster.gates || {})) {
      if (gateInfo.position) {
        positions[gateMacro.toLowerCase()] = gateInfo.position
      }
    }
  }

  const strings: Record<string, Record<string, string>> = {}
  for (const [key, value] of Object.entries(localeEn as Record<string, string>)) {
    const match = key.match(/^\{(\d+),(\d+)\}$/)
    if (!match || !match[1] || !match[2]) continue
    const page = match[1]
    const id = match[2]
    strings[page] ||= {}
    strings[page][id] = value
  }

  return {
    sectorNames,
    shipNames: {},
    positions,
    strings,
    currentVersion: '8.0'
  }
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

async function extractSave(inputPath: string, outputPath: string): Promise<SaveArchive> {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const absoluteOutput = path.resolve(process.cwd(), outputPath)
  const gzip = isGzipFile(absoluteInput)
  const stat = fs.statSync(absoluteInput)

  console.log(`[extract_save] input: ${absoluteInput}`)
  console.log(`[extract_save] output: ${absoluteOutput}`)
  console.log(`[extract_save] source size: ${formatMB(stat.size)} MB`)
  console.log(`[extract_save] source type: ${gzip ? 'gzip' : 'xml'}`)

  const sourceStream = fs.createReadStream(absoluteInput)
  const dataStream = gzip ? sourceStream.pipe(zlib.createGunzip()) : sourceStream
  const wasmBytes = await readFile(SAVE_PARSER_WASM_URL)
  const runtime = await createSaveParserRuntime({
    ...buildConfig(),
    filename: path.basename(absoluteInput)
  }, {
    progressIntervalMs: 500,
    wasmSource: wasmBytes,
    onProgress: (progress) => {
      console.log(
        `[extract_save] parsed ${formatMB(progress.bytesProcessed)} MB, tags ${progress.tagCount}, sectors ${progress.sectorsCount}`
      )
    }
  })

  let sourceBytesRead = 0
  let nextSourceLogMB = 10

  sourceStream.on('data', (chunk: Buffer) => {
    sourceBytesRead += chunk.length
    const sourceMB = sourceBytesRead / (1024 * 1024)
    if (sourceMB >= nextSourceLogMB) {
      console.log(`[extract_save] read source ${formatMB(sourceBytesRead)} MB / ${formatMB(stat.size)} MB`)
      nextSourceLogMB += 10
    }
  })

  for await (const chunk of dataStream as AsyncIterable<Buffer>) {
    runtime.feed(chunk)
  }

  const archive = runtime.close()
  fs.writeFileSync(absoluteOutput, JSON.stringify(archive, null, 2))

  console.log(`[extract_save] done: sectors ${Object.keys(archive.sectors).length}, compatible=${archive.isCompatible}`)
  console.log(`[extract_save] json written: ${absoluteOutput}`)

  return archive
}

async function main(): Promise<void> {
  const input = process.argv[2]
  const output = process.argv[3]

  if (!input) {
    printUsage()
    process.exitCode = 1
    return
  }

  try {
    await extractSave(input, output || defaultOutputPath(input))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[extract_save] failed: ${message}`)
    process.exitCode = 1
  }
}

void main()
