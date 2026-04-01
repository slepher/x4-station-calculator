import type { SaveParserRustMessage, ProgressInfo } from '@/types/saveArchive'
import initWasm, { SaveParser } from '@/wasm/save_parser'
import wasmUrl from '@/wasm/save_parser_bg.wasm?url'

let wasmInitialized = false
const PROGRESS_POST_INTERVAL_MS = 1000

async function ensureWasmInit() {
  if (wasmInitialized) return
  const wasmBinary = await fetch(wasmUrl).then(r => r.arrayBuffer())
  await initWasm({ module_or_path: wasmBinary })
  wasmInitialized = true
}

type RustSaveParserLike = {
  push_chunk: (chunk: Uint8Array) => void
  pump: (maxEvents: number) => boolean
  progress_json: () => string
  finish_input: () => void
  set_expected_version?: (version: string) => void
  set_expected_total_bytes?: (total: number) => void
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

type WorkerInputMessage =
  | { type: 'parse_start'; filename?: string; currentVersion?: string; expectedTotalBytes?: number }
  | { type: 'parse_chunk'; chunk?: ArrayBuffer }
  | { type: 'parse_end' }

type RustParseSession = {
  pushChunk: (chunk: Uint8Array) => Promise<boolean>
  finish: () => Promise<boolean>
}

function createRustParseSession(options: {
  parser: SaveParser
  filename: string
  currentVersion?: string
  expectedTotalBytes?: number
  postProgress: (info: ProgressInfo) => void
  postComplete: (archive: unknown) => void
  postError: (message: string, detail?: unknown) => void
}): RustParseSession {
  const MAX_EVENTS_PER_PUMP = 50000
  let finalized = false
  let failed = false
  let isGzipped: boolean | null = null
  let gzipWriter: WritableStreamDefaultWriter<Uint8Array> | null = null
  let gzipTask: Promise<boolean> | null = null

  if (options.currentVersion) {
    options.parser.set_expected_version?.(options.currentVersion)
  }

  const handleParserError = (progress: ProgressInfo) => {
    failed = true
    options.postError(progress.error ?? 'Unknown error', progress.errorDetail)
    return true
  }

  const pumpNow = () => pumpRustParser({
    parser: options.parser,
    maxEventsPerPump: MAX_EVENTS_PER_PUMP,
    onProgress: options.postProgress,
    onError: handleParserError
  })

  const ensureMode = (chunk: Uint8Array) => {
    if (isGzipped !== null) return
    isGzipped = chunk.length >= 2 && chunk[0] === 0x1f && chunk[1] === 0x8b

    if (!isGzipped) {
      options.parser.set_expected_total_bytes?.(options.expectedTotalBytes ?? 0)
      return
    }

    const transform = new TransformStream<Uint8Array, Uint8Array>()
    gzipWriter = transform.writable.getWriter()
    gzipTask = streamCompressedXmlToRustParser({
      parser: options.parser,
      stream: transform.readable.pipeThrough(new DecompressionStream('gzip')),
      maxEventsPerPump: MAX_EVENTS_PER_PUMP,
      onProgress: options.postProgress,
      onError: handleParserError
    })
  }

  return {
    async pushChunk(chunk: Uint8Array) {
      if (finalized || failed || chunk.length === 0) return false
      ensureMode(chunk)

      if (isGzipped) {
        await gzipWriter?.write(chunk)
        return !failed
      }

      options.parser.push_chunk(chunk)
      return pumpNow()
    },
    async finish() {
      if (finalized || failed) return false
      finalized = true

      if (isGzipped) {
        await gzipWriter?.close()
        const completed = await gzipTask
        if (!completed || failed) return false
      } else {
        options.parser.finish_input()
        const completed = pumpNow()
        if (!completed || failed) return false
      }

      const result = options.parser.finish(options.filename || '')
      const archive = JSON.parse(result)
      options.postComplete(archive)
      return true
    }
  }
}

if (typeof self !== 'undefined' && typeof (self as unknown as { importScripts: unknown }).importScripts === 'function') {
  let session: RustParseSession | null = null
  let messageQueue = Promise.resolve()
  let lastProgressPostedAt = 0
  let lastProgressSnapshot: ProgressInfo | null = null

  self.onmessage = (e: MessageEvent<WorkerInputMessage>) => {
    const postProgress = (info: ProgressInfo, force = false) => {
      lastProgressSnapshot = info
      const now = Date.now()
      if (!force && now - lastProgressPostedAt < PROGRESS_POST_INTERVAL_MS) return
      lastProgressPostedAt = now
      self.postMessage({ type: 'progress', data: info } as SaveParserRustMessage)
    }

    const postError = (message: string, detail?: unknown) => {
      self.postMessage({ type: 'error', message, detail } as SaveParserRustMessage)
    }

    const postComplete = (archive: unknown) => {
      self.postMessage({ type: 'complete', data: archive } as SaveParserRustMessage)
    }

    messageQueue = messageQueue.then(async () => {
      try {
        if (e.data.type === 'parse_start') {
          lastProgressPostedAt = 0
          lastProgressSnapshot = null
          postProgress({
            phase: 'receiving', percent: 0, tagCount: 0, sectorCount: 0,
            done: false, inputComplete: false, error: null,
            inputBytesTotal: 0, parsedBytesTotal: 0, bufferedBytes: 0, expectedTotalBytes: 0
          }, true)

          await ensureWasmInit()
          const parser = new SaveParser()
          session = createRustParseSession({
            parser,
            filename: e.data.filename || '',
            currentVersion: e.data.currentVersion || '8.0',
            expectedTotalBytes: e.data.expectedTotalBytes,
            postProgress,
            postComplete,
            postError
          })
          return
        }

        if (!session) return

        if (e.data.type === 'parse_chunk') {
          if (!e.data.chunk) return
          await session.pushChunk(new Uint8Array(e.data.chunk))
          return
        }

        if (e.data.type === 'parse_end') {
          if (lastProgressSnapshot) {
            postProgress({
              ...lastProgressSnapshot,
              phase: 'finalizing',
              percent: Math.max(lastProgressSnapshot.percent, 99),
              inputComplete: true
            }, true)
          }
          await session.finish()
          session = null
        }
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error'
        postError(message)
        session = null
      }
    })
  }
}
