type StreamFileToSaveParserWorkerOptions = {
  worker: Worker
  file: File
  currentVersion: string
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

export async function streamFileToSaveParserWorker(options: StreamFileToSaveParserWorkerOptions) {
  const { worker, file, currentVersion } = options
  const expectedTotalBytes = await getExpectedTotalBytes(file)
  let workerFinished = false
  const onWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === 'complete' || event.data?.type === 'error') {
      workerFinished = true
    }
  }
  worker.addEventListener('message', onWorkerMessage)

  try {
    worker.postMessage({
      type: 'parse_start',
      filename: file.name,
      currentVersion,
      expectedTotalBytes
    })

    const reader = file.stream().getReader()
    let sourceChunkCount = 0
    while (true) {
      if (workerFinished) {
        await reader.cancel()
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.length === 0) continue
      sourceChunkCount += 1
      const transferable = toTransferableBuffer(value)
      worker.postMessage({
        type: 'parse_chunk',
        chunk: transferable,
        sentAtMs: Date.now(),
        chunkIndex: sourceChunkCount
      }, [transferable])
    }

    if (!workerFinished) {
      worker.postMessage({ type: 'parse_end' })
    }
  } finally {
    worker.removeEventListener('message', onWorkerMessage)
  }
}
