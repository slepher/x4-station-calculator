import type {
  SaveParserRustMessage,
  ProgressInfo,
  SaveArchive
} from '@/types/saveArchive'
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

type WorkerInputMessage =
  | { type: 'parse_start'; filename?: string; currentVersion?: string; expectedTotalBytes?: number; debugTimings?: boolean }
  | { type: 'parse_chunk'; chunk?: ArrayBuffer; sentAtMs?: number; chunkIndex?: number }
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
  options.parser.set_expected_total_bytes?.(options.expectedTotalBytes ?? 0)

  return {
    async pushChunk(chunk: Uint8Array) {
      if (finalized || failed || chunk.length === 0) return false
      options.parser.push_chunk(chunk)
      return pumpNow()
    },
    async finish() {
      if (finalized || failed) return false
      finalized = true
      options.parser.finish_input()
      const completed = pumpNow()
      if (!completed || failed) return false

      const result = options.parser.finish(options.filename || '')
      const archive = JSON.parse(result) as SaveArchive
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
  let debugTimings = false
  let parseStartedAtMs = 0
  let workerReadyAtMs = 0
  let chunksProcessed = 0
  let totalChunkBytes = 0
  let totalQueueLagMs = 0
  let maxQueueLagMs = 0
  let totalPushAndPumpMs = 0
  let maxPushAndPumpMs = 0
  let lastChunkProgressLogAtMs = 0

  const logTiming = (stage: string, details?: Record<string, unknown>) => {
    if (!debugTimings) return
    if (details) {
      console.log(`[save-upload-timing][worker] ${stage}`, details)
      return
    }
    console.log(`[save-upload-timing][worker] ${stage}`)
  }

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
          debugTimings = e.data.debugTimings === true
          parseStartedAtMs = Date.now()
          workerReadyAtMs = 0
          chunksProcessed = 0
          totalChunkBytes = 0
          totalQueueLagMs = 0
          maxQueueLagMs = 0
          totalPushAndPumpMs = 0
          maxPushAndPumpMs = 0
          lastChunkProgressLogAtMs = parseStartedAtMs
          lastProgressPostedAt = 0
          lastProgressSnapshot = null
          postProgress({
            phase: 'receiving', percent: 0, tagCount: 0, sectorCount: 0,
            done: false, inputComplete: false, error: null,
            inputBytesTotal: 0, parsedBytesTotal: 0, bufferedBytes: 0, expectedTotalBytes: 0
          }, true)

          logTiming('parse_start:received', {
            filename: e.data.filename,
            expectedTotalBytes: e.data.expectedTotalBytes
          })

          const initStartedAt = Date.now()
          await ensureWasmInit()
          workerReadyAtMs = Date.now()
          logTiming('wasm:init_complete', {
            elapsedMs: workerReadyAtMs - initStartedAt,
            sinceParseStartMs: workerReadyAtMs - parseStartedAtMs
          })
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
          const chunk = new Uint8Array(e.data.chunk)
          const handleStartedAt = Date.now()
          const queueLagMs = e.data.sentAtMs ? handleStartedAt - e.data.sentAtMs : 0
          const pushPumpStartedAt = Date.now()
          await session.pushChunk(chunk)
          const pushAndPumpMs = Date.now() - pushPumpStartedAt
          chunksProcessed += 1
          totalChunkBytes += chunk.byteLength
          totalQueueLagMs += queueLagMs
          maxQueueLagMs = Math.max(maxQueueLagMs, queueLagMs)
          totalPushAndPumpMs += pushAndPumpMs
          maxPushAndPumpMs = Math.max(maxPushAndPumpMs, pushAndPumpMs)

          const now = Date.now()
          if (debugTimings && now - lastChunkProgressLogAtMs >= 1000) {
            lastChunkProgressLogAtMs = now
            logTiming('chunk:progress', {
              chunksProcessed,
              totalChunkBytes,
              avgQueueLagMs: chunksProcessed > 0 ? Number((totalQueueLagMs / chunksProcessed).toFixed(2)) : 0,
              maxQueueLagMs,
              avgPushAndPumpMs: chunksProcessed > 0 ? Number((totalPushAndPumpMs / chunksProcessed).toFixed(2)) : 0,
              maxPushAndPumpMs,
              lastChunkIndex: e.data.chunkIndex
            })
          }
          self.postMessage({
            type: 'chunk_processed',
            chunkIndex: e.data.chunkIndex
          })
          return
        }

        if (e.data.type === 'parse_end') {
          logTiming('parse_end:received', {
            elapsedMs: Date.now() - parseStartedAtMs,
            chunksProcessed,
            totalChunkBytes
          })
          if (lastProgressSnapshot) {
            postProgress({
              ...lastProgressSnapshot,
              phase: 'finalizing',
              percent: Math.max(lastProgressSnapshot.percent, 99),
              inputComplete: true
            }, true)
          }
          const finishStartedAt = Date.now()
          await session.finish()
          logTiming('finish:complete', {
            finishElapsedMs: Date.now() - finishStartedAt,
            totalElapsedMs: Date.now() - parseStartedAtMs,
            chunksProcessed,
            totalChunkBytes,
            avgQueueLagMs: chunksProcessed > 0 ? Number((totalQueueLagMs / chunksProcessed).toFixed(2)) : 0,
            maxQueueLagMs,
            avgPushAndPumpMs: chunksProcessed > 0 ? Number((totalPushAndPumpMs / chunksProcessed).toFixed(2)) : 0,
            maxPushAndPumpMs
          })
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
