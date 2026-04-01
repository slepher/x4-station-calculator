import type { SaveParserRustMessage, ProgressInfo } from '@/types/saveArchive'
import initWasm, { SaveParser } from '@/wasm/save_parser'
import wasmUrl from '@/wasm/save_parser_bg.wasm?url'

let wasmInitialized = false

async function ensureWasmInit() {
  if (wasmInitialized) return
  const wasmBinary = await fetch(wasmUrl).then(r => r.arrayBuffer())
  await initWasm({ module_or_path: wasmBinary })
  wasmInitialized = true
}

function getGzipUncompressedSize(buf: ArrayBuffer): number | null {
  if (buf.byteLength < 18) return null
  const bytes = new Uint8Array(buf)
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return null
  const view = new DataView(buf)
  return view.getUint32(buf.byteLength - 4, true)
}

type RustSaveParserLike = {
  push_chunk: (chunk: Uint8Array) => void
  pump: (maxEvents: number) => boolean
  progress_json: () => string
  finish_input: () => void
}

function pumpRustParser(options: {
  parser: RustSaveParserLike
  maxEventsPerPump: number
  onProgress: (info: ProgressInfo) => void
  onError: (progress: ProgressInfo) => boolean
}) {
  while (true) {
    const hasMore = options.parser.pump(options.maxEventsPerPump)
    const progress: ProgressInfo = JSON.parse(options.parser.progress_json())
    options.onProgress(progress)

    if (progress.error) {
      if (options.onError(progress)) {
        return false
      }
      return false
    }

    if (!hasMore) break
  }

  return true
}

export async function streamCompressedXmlToRustParser(options: {
  parser: RustSaveParserLike
  stream: ReadableStream<Uint8Array>
  maxEventsPerPump: number
  onProgress: (info: ProgressInfo) => void
  onError: (progress: ProgressInfo) => boolean
}) {
  const reader = options.stream.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (value && value.length > 0) {
      options.parser.push_chunk(value)
      const shouldContinue = pumpRustParser({
        parser: options.parser,
        maxEventsPerPump: options.maxEventsPerPump,
        onProgress: options.onProgress,
        onError: options.onError
      })
      if (!shouldContinue) return false
    }
    if (done) break
  }

  options.parser.finish_input()
  return pumpRustParser({
    parser: options.parser,
    maxEventsPerPump: options.maxEventsPerPump,
    onProgress: options.onProgress,
    onError: options.onError
  })
}

if (typeof self !== 'undefined' && typeof (self as unknown as { importScripts: unknown }).importScripts === 'function') {
  self.onmessage = async (e: MessageEvent<{ type: string; arrayBuffer?: ArrayBuffer; filename?: string; currentVersion?: string }>) => {
    const { type, arrayBuffer, filename, currentVersion } = e.data

    if (type !== 'parse' || !arrayBuffer) return

    const postProgress = (info: ProgressInfo) => {
      self.postMessage({ type: 'progress', data: info } as SaveParserRustMessage)
    }

    const expectedVersion = currentVersion || '8.0'

    try {
      postProgress({
        phase: 'receiving', percent: 0, tagCount: 0, sectorCount: 0,
        done: false, inputComplete: false, error: null,
        inputBytesTotal: 0, parsedBytesTotal: 0, bufferedBytes: 0, expectedTotalBytes: 0
      })

      await ensureWasmInit()
      const parser = new SaveParser()
      
      if (expectedVersion) {
        parser.set_expected_version(expectedVersion)
      }

      const MAX_EVENTS_PER_PUMP = 50000
      const postParserError = (progress: ProgressInfo) => {
        self.postMessage({
          type: 'error',
          message: progress.error ?? 'Unknown error',
          detail: progress.errorDetail
        } as SaveParserRustMessage)
        return true
      }

      const header = new Uint8Array(arrayBuffer.slice(0, 2))
      const isGzipped = header[0] === 0x1f && header[1] === 0x8b

      if (isGzipped) {
        const expectedSize = getGzipUncompressedSize(arrayBuffer)
        if (expectedSize && expectedSize > 0) {
          parser.set_expected_total_bytes(expectedSize)
        }

        const ds = new DecompressionStream('gzip')
        const blob = new Blob([arrayBuffer])
        const decompressedStream = blob.stream().pipeThrough(ds)
        const completed = await streamCompressedXmlToRustParser({
          parser,
          stream: decompressedStream,
          maxEventsPerPump: MAX_EVENTS_PER_PUMP,
          onProgress: postProgress,
          onError: postParserError
        })
        if (!completed) return
      } else {
        const data = new Uint8Array(arrayBuffer)
        parser.set_expected_total_bytes(data.length)
        parser.push_chunk(data)
        parser.finish_input()

        const completed = pumpRustParser({
          parser,
          maxEventsPerPump: MAX_EVENTS_PER_PUMP,
          onProgress: postProgress,
          onError: postParserError
        })
        if (!completed) return
      }

      const result = parser.finish(filename || '')
      const archive = JSON.parse(result)
      
      self.postMessage({ type: 'complete', data: archive } as SaveParserRustMessage)
    } catch (error) {
      const message = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : 'Unknown error'
      self.postMessage({ type: 'error', message } as SaveParserRustMessage)
    }
  }
}
