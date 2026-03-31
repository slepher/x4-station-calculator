import type { SaveArchive, SaveParserMessage } from '@/types/saveArchive'
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
    
    const postProgress = (status: string) => {
      self.postMessage({ type: 'progress', status } as SaveParserMessage)
    }
    
    try {
      postProgress('Initializing WASM...')
      
      await ensureWasmInit()
      const parser = new SaveParser()
      
      postProgress('Checking file format...')
      
      const header = new Uint8Array(arrayBuffer.slice(0, 2))
      const isGzipped = header[0] === 0x1f && header[1] === 0x8b
      
      let data: Uint8Array
      let totalMB: number
      
      if (isGzipped) {
        postProgress('Decompressing...')
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
        totalMB = totalBytes / (1024 * 1024)
        data = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
          data.set(chunk, offset)
          offset += chunk.length
        }
      } else {
        data = new Uint8Array(arrayBuffer)
        totalMB = data.length / (1024 * 1024)
      }
      
      // Feed in chunks to provide progress feedback
      const CHUNK_SIZE = 16 * 1024 * 1024 // 16MB chunks
      const totalChunks = Math.ceil(data.length / CHUNK_SIZE)
      
      postProgress(`Parsing ${totalMB.toFixed(0)} MB (${totalChunks} chunks)...`)
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, data.length)
        const chunk = data.slice(start, end)
        parser.feed(chunk)
        
        // Report progress after each chunk
        const progress = ((i + 1) / totalChunks * 100).toFixed(0)
        const sectors = parser.sector_count()
        postProgress(`${progress}% parsed, ${sectors} sectors found`)
      }
      
      const finalSectors = parser.sector_count()
      postProgress(`Finalizing ${finalSectors} sectors...`)
      
      const result = parser.finish(filename || '')
      const archive: SaveArchive = JSON.parse(result)
      
      self.postMessage({ type: 'complete', data: archive } as SaveParserMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      self.postMessage({ type: 'error', message } as SaveParserMessage)
    }
  }
}