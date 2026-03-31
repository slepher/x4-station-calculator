import type { SaveArchive, SaveParserMessage } from '@/types/saveArchive'
import initWasm, { SaveParser } from '@/wasm/save_parser'
import wasmUrl from '@/wasm/save_parser_bg.wasm?url'

interface SaveParserProgressInfo {
  bytesProcessed: number
  tagCount: number
  sectorsCount: number
}

interface SaveParserRuntime {
  feed: (data: Uint8Array) => void
  close: (filename: string) => SaveArchive
  getProgress: () => SaveParserProgressInfo
}

let wasmInitialized = false

async function ensureWasmInit() {
  if (wasmInitialized) return
  const wasmBinary = await fetch(wasmUrl).then(r => r.arrayBuffer())
  await initWasm({ module_or_path: wasmBinary })
  wasmInitialized = true
}

export async function createRustParserRuntime(
  options?: {
    onProgress?: (info: SaveParserProgressInfo) => void
    progressIntervalMs?: number
  }
): Promise<SaveParserRuntime> {
  await ensureWasmInit()
  const parser = new SaveParser()
  
  let bytesProcessed = 0
  let lastProgressAt = 0
  const progressIntervalMs = options?.progressIntervalMs ?? 500
  
  const emitProgress = (force = false) => {
    const now = Date.now()
    if (!force && now - lastProgressAt < progressIntervalMs) return
    lastProgressAt = now
    options?.onProgress?.({
      bytesProcessed,
      tagCount: parser.tag_count(),
      sectorsCount: parser.sector_count()
    })
  }
  
  return {
    feed(data: Uint8Array) {
      if (!data.length) return
      parser.feed(data)
      bytesProcessed += data.length
      emitProgress()
    },
    
    close(filename: string) {
      const result = parser.finish(filename)
      return JSON.parse(result) as SaveArchive
    },
    
    getProgress() {
      return {
        bytesProcessed,
        tagCount: parser.tag_count(),
        sectorsCount: parser.sector_count()
      }
    }
  }
}

if (typeof self !== 'undefined' && typeof (self as unknown as { importScripts: unknown }).importScripts === 'function') {
  self.onmessage = async (e: MessageEvent<{ type: string; arrayBuffer?: ArrayBuffer; filename?: string }>) => {
    const { type, arrayBuffer, filename } = e.data
    
    if (type !== 'parse' || !arrayBuffer) return
    
    try {
      self.postMessage({ type: 'progress', status: 'Initializing...' } as SaveParserMessage)
      
      const runtime = await createRustParserRuntime({
        onProgress: (info) => {
          self.postMessage({
            type: 'progress',
            status: `Processing ${Math.floor(info.bytesProcessed / 1024 / 1024)} MB`
          } as SaveParserMessage)
        }
      })
      
      self.postMessage({ type: 'progress', status: 'Parsing...' } as SaveParserMessage)
      
      const header = new Uint8Array(arrayBuffer.slice(0, 2))
      const isGzipped = header[0] === 0x1f && header[1] === 0x8b
      
      let data: Uint8Array
      if (isGzipped) {
        self.postMessage({ type: 'progress', status: 'Decompressing...' } as SaveParserMessage)
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
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const combined = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          combined.set(chunk, offset)
          offset += chunk.length
        }
        
        data = combined
      } else {
        data = new Uint8Array(arrayBuffer)
      }
      
      runtime.feed(data)
      const archive = runtime.close(filename || '')
      
      self.postMessage({ type: 'complete', data: archive } as SaveParserMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      self.postMessage({ type: 'error', message } as SaveParserMessage)
    }
  }
}