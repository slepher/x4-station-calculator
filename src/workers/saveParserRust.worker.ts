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
        const reader = decompressedStream.getReader()

        const chunks: Uint8Array[] = []
        let totalSize = 0

        while (true) {
          const { done, value } = await reader.read()
          if (value) {
            chunks.push(value)
            totalSize += value.length
          }
          if (done) break
        }

        const decompressed = new Uint8Array(totalSize)
        let offset = 0
        for (const chunk of chunks) {
          decompressed.set(chunk, offset)
          offset += chunk.length
        }

        parser.push_chunk(decompressed)
        parser.finish_input()

        const MAX_EVENTS_PER_PUMP = 50000
        while (true) {
          const hasMore = parser.pump(MAX_EVENTS_PER_PUMP)
          const progressJson = parser.progress_json()
          const progress: ProgressInfo = JSON.parse(progressJson)
          postProgress(progress)
          if (!hasMore) break
        }
      } else {
        const data = new Uint8Array(arrayBuffer)
        parser.set_expected_total_bytes(data.length)
        parser.push_chunk(data)
        parser.finish_input()

        const MAX_EVENTS_PER_PUMP = 50000
        while (true) {
          const hasMore = parser.pump(MAX_EVENTS_PER_PUMP)
          const progressJson = parser.progress_json()
          const progress: ProgressInfo = JSON.parse(progressJson)
          postProgress(progress)
          if (!hasMore) break
        }
      }

      const result = parser.finish(filename || '')
      const archive = JSON.parse(result)
      
      self.postMessage({ type: 'complete', data: archive } as SaveParserRustMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      self.postMessage({ type: 'error', message } as SaveParserRustMessage)
    }
  }
}