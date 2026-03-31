import type { SaveArchive, SaveParserRustProgress, SaveParserMessage, ProgressInfo } from '@/types/saveArchive'
import initWasm, { SaveParser } from '@/wasm/save_parser'
import wasmUrl from '@/wasm/save_parser_bg.wasm?url'

let wasmInitialized = false

async function ensureWasmInit() {
  if (wasmInitialized) return
  const wasmBinary = await fetch(wasmUrl).then(r => r.arrayBuffer())
  await initWasm({ module_or_path: wasmBinary })
  wasmInitialized = true
}

if (typeof self !== 'undefined' && typeof (self as unknown as { importScripts: unknown }).importScripts === 'function') {
  self.onmessage = async (e: MessageEvent<{ type: string; arrayBuffer?: ArrayBuffer; filename?: string }>) => {
    const { type, arrayBuffer, filename } = e.data
    
    if (type !== 'parse' || !arrayBuffer) return
    
    const postProgress = (info: ProgressInfo) => {
      self.postMessage({ type: 'progress', data: info } as SaveParserRustProgress)
    }
    
    try {
      postProgress({ phase: 'receiving', percent: 0, tagCount: 0, sectorCount: 0, done: false, inputComplete: false, error: null, inputBytesTotal: 0, parsedBytesTotal: 0, bufferedBytes: 0, expectedTotalBytes: 0 })
      
      await ensureWasmInit()
      const parser = new SaveParser()
      
      const header = new Uint8Array(arrayBuffer.slice(0, 2))
      const isGzipped = header[0] === 0x1f && header[1] === 0x8b
      
      let data: Uint8Array
      
      if (isGzipped) {
        const ds = new DecompressionStream('gzip')
        const blob = new Blob([arrayBuffer])
        const decompressedStream = blob.stream().pipeThrough(ds)
        const reader = decompressedStream.getReader()
        const chunks: Uint8Array[] = []
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }
        
        const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        data = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
          data.set(chunk, offset)
          offset += chunk.length
        }
      } else {
        data = new Uint8Array(arrayBuffer)
      }
      
      parser.load_document(data)
      
      const MAX_EVENTS_PER_PUMP = 4000
      
      while (true) {
        const hasMore = parser.pump(MAX_EVENTS_PER_PUMP)
        const progressJson = parser.progress_json()
        const progress: ProgressInfo = JSON.parse(progressJson)
        postProgress(progress)
        
        if (!hasMore) break
      }
      
      const result = parser.finish(filename || '')
      const archive: SaveArchive = JSON.parse(result)
      
      self.postMessage({ type: 'complete', data: archive } as SaveParserMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      self.postMessage({ type: 'error', message } as SaveParserMessage)
    }
  }
}