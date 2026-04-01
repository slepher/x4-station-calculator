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

  worker.postMessage({
    type: 'parse_start',
    filename: file.name,
    currentVersion,
    expectedTotalBytes
  })

  const reader = file.stream().getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value || value.length === 0) continue
    const transferable = toTransferableBuffer(value)
    worker.postMessage({ type: 'parse_chunk', chunk: transferable }, [transferable])
  }

  worker.postMessage({ type: 'parse_end' })
}
