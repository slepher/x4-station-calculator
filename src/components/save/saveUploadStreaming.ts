type StreamFileToSaveParserWorkerOptions = {
  worker: Worker
  file: File
  currentVersion: string
  debugTimings?: boolean
  targetBatchBytes?: number
  maxInflightBatches?: number
}

type WorkerAckMessage = {
  type: 'chunk_processed'
  chunkIndex?: number
}

const DEFAULT_TARGET_BATCH_BYTES = 256 * 1024
const DEFAULT_MAX_INFLIGHT_BATCHES = 2

function logSaveUploadTiming(enabled: boolean, stage: string, details?: Record<string, unknown>) {
  if (!enabled) return
  if (details) {
    console.log(`[save-upload-timing][main] ${stage}`, details)
    return
  }
  console.log(`[save-upload-timing][main] ${stage}`)
}

async function getExpectedTotalBytes(file: File): Promise<number> {
  const header = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  const isGzip = header.length >= 2 && header[0] === 0x1f && header[1] === 0x8b
  if (!isGzip || file.size < 4) {
    return file.size
  }

  const trailer = new Uint8Array(await file.slice(Math.max(0, file.size - 4), file.size).arrayBuffer())
  if (trailer.length < 4) {
    return file.size
  }

  return new DataView(trailer.buffer, trailer.byteOffset, trailer.byteLength).getUint32(0, true)
}

function toTransferableBuffer(chunk: Uint8Array): ArrayBuffer {
  if (chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength) {
    return chunk.buffer as ArrayBuffer
  }
  return chunk.slice().buffer as ArrayBuffer
}

function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  if (chunks.length === 1 && chunks[0]) {
    return chunks[0]
  }

  const merged = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

export async function streamFileToSaveParserWorker(options: StreamFileToSaveParserWorkerOptions) {
  const {
    worker,
    file,
    currentVersion,
    debugTimings = false,
    targetBatchBytes = DEFAULT_TARGET_BATCH_BYTES,
    maxInflightBatches = DEFAULT_MAX_INFLIGHT_BATCHES
  } = options
  const streamStartAt = Date.now()
  const expectedBytesStartAt = Date.now()
  const expectedTotalBytes = await getExpectedTotalBytes(file)
  logSaveUploadTiming(debugTimings, 'expectedTotalBytes:ready', {
    fileName: file.name,
    fileSize: file.size,
    expectedTotalBytes,
    elapsedMs: Date.now() - expectedBytesStartAt
  })

  worker.postMessage({
    type: 'parse_start',
    filename: file.name,
    currentVersion,
    expectedTotalBytes,
    debugTimings
  })

  let inflightBatches = 0
  let ackWaiters: Array<() => void> = []
  const handleWorkerMessage = (event: MessageEvent<WorkerAckMessage>) => {
    if (event.data?.type !== 'chunk_processed') return
    inflightBatches = Math.max(0, inflightBatches - 1)
    const waiter = ackWaiters.shift()
    waiter?.()
  }
  worker.addEventListener('message', handleWorkerMessage as EventListener)

  const waitForWorkerCapacity = async () => {
    while (inflightBatches >= maxInflightBatches) {
      await new Promise<void>((resolve) => {
        ackWaiters.push(resolve)
      })
    }
  }

  let batchChunks: Uint8Array[] = []
  let batchBytes = 0
  const reader = file.stream().getReader()
  let sourceChunkCount = 0
  let batchCount = 0
  let bytesSent = 0
  let lastProgressLogAt = Date.now()

  const flushBatch = async (force = false) => {
    if (batchBytes === 0) return
    if (!force && batchBytes < targetBatchBytes) return

    await waitForWorkerCapacity()

    const mergedChunk = concatChunks(batchChunks, batchBytes)
    const transferable = toTransferableBuffer(mergedChunk)
    batchCount += 1
    inflightBatches += 1
    worker.postMessage({
      type: 'parse_chunk',
      chunk: transferable,
      sentAtMs: Date.now(),
      chunkIndex: batchCount
    }, [transferable])

    batchChunks = []
    batchBytes = 0
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.length === 0) continue
      sourceChunkCount += 1
      bytesSent += value.length
      batchChunks.push(value)
      batchBytes += value.byteLength
      await flushBatch()

      const now = Date.now()
      if (debugTimings && now - lastProgressLogAt >= 1000) {
        lastProgressLogAt = now
        logSaveUploadTiming(debugTimings, 'streaming:progress', {
          sourceChunkCount,
          batchCount,
          inflightBatches,
          bytesSent,
          bufferedBatchBytes: batchBytes,
          elapsedMs: now - streamStartAt
        })
      }
    }

    await flushBatch(true)
    while (inflightBatches > 0) {
      await waitForWorkerCapacity()
    }

    worker.postMessage({ type: 'parse_end' })
    logSaveUploadTiming(debugTimings, 'streaming:complete', {
      sourceChunkCount,
      batchCount,
      bytesSent,
      elapsedMs: Date.now() - streamStartAt
    })
  } finally {
    worker.removeEventListener('message', handleWorkerMessage as EventListener)
  }
}
