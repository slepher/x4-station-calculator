import { describe, expect, it, vi } from 'vitest'
import { streamFileToSaveParserWorker } from '../../../src/components/save/saveUploadStreaming'

async function flushAsyncTurns(count = 1) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('save upload streaming', () => {
  it('streams file chunks to worker without reading full arrayBuffer', async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5])
    ]
    const gzipHeader = new Uint8Array([0x1f, 0x8b])
    const gzipSizeTrailer = new Uint8Array([0x34, 0x12, 0x00, 0x00])
    const file = {
      name: 'save.xml.gz',
      size: 5,
      arrayBuffer: vi.fn(),
      slice(start: number, end: number) {
        const headerSlice = start === 0 && end === 2
        const trailerSlice = start === 1 && end === 5
        return {
          arrayBuffer: vi.fn(async () => (headerSlice ? gzipHeader : gzipSizeTrailer).buffer)
        }
      },
      stream() {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk)
            controller.close()
          }
        })
      }
    } as unknown as File

    const listeners = new Map<string, Set<(event: MessageEvent) => void>>()
    const worker = {
      postMessage: vi.fn((message: { type: string }) => {
        if (message.type === 'parse_chunk') {
          const cbs = listeners.get('message')
          cbs?.forEach((cb) => cb({ data: { type: 'chunk_processed' } } as MessageEvent))
        }
      }),
      addEventListener: vi.fn((type: string, cb: (event: MessageEvent) => void) => {
        const set = listeners.get(type) ?? new Set()
        set.add(cb)
        listeners.set(type, set)
      }),
      removeEventListener: vi.fn((type: string, cb: (event: MessageEvent) => void) => {
        listeners.get(type)?.delete(cb)
      })
    } as unknown as Worker

    await streamFileToSaveParserWorker({
      worker,
      file,
      currentVersion: '8.0',
      targetBatchBytes: 1,
      maxInflightBatches: 4
    })

    expect(file.arrayBuffer).not.toHaveBeenCalled()
    expect(worker.postMessage).toHaveBeenCalledTimes(4)
    expect(worker.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'parse_start',
      filename: 'save.xml.gz',
      currentVersion: '8.0',
      expectedTotalBytes: 0x1234,
      debugTimings: false
    })
    expect(worker.postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: 'parse_chunk',
      chunk: chunks[0].buffer,
      chunkIndex: 1
    }), [chunks[0].buffer])
    expect(worker.postMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({
      type: 'parse_chunk',
      chunk: chunks[1].buffer,
      chunkIndex: 2
    }), [chunks[1].buffer])
    expect(worker.postMessage).toHaveBeenNthCalledWith(4, {
      type: 'parse_end'
    })
  })

  it('batches small file chunks before posting to worker', async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9])
    ]
    const listeners = new Map<string, Set<(event: MessageEvent) => void>>()
    const worker = {
      postMessage: vi.fn((message: { type: string }) => {
        if (message.type === 'parse_chunk') {
          const cbs = listeners.get('message')
          cbs?.forEach((cb) => cb({ data: { type: 'chunk_processed' } } as MessageEvent))
        }
      }),
      addEventListener: vi.fn((type: string, cb: (event: MessageEvent) => void) => {
        const set = listeners.get(type) ?? new Set()
        set.add(cb)
        listeners.set(type, set)
      }),
      removeEventListener: vi.fn((type: string, cb: (event: MessageEvent) => void) => {
        listeners.get(type)?.delete(cb)
      })
    } as unknown as Worker
    const file = {
      name: 'save.xml.gz',
      size: 9,
      slice(start: number, end: number) {
        const headerSlice = start === 0 && end === 2
        const trailerSlice = start === 5 && end === 9
        return {
          arrayBuffer: vi.fn(async () => (headerSlice
            ? new Uint8Array([0x1f, 0x8b])
            : new Uint8Array([0x09, 0x00, 0x00, 0x00])).buffer)
        }
      },
      stream() {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk)
            controller.close()
          }
        })
      }
    } as unknown as File

    await streamFileToSaveParserWorker({
      worker,
      file,
      currentVersion: '8.0',
      targetBatchBytes: 5,
      maxInflightBatches: 2
    })

    const parseChunkCalls = worker.postMessage.mock.calls.filter(([message]) => message.type === 'parse_chunk')
    expect(parseChunkCalls).toHaveLength(2)
    expect(new Uint8Array(parseChunkCalls[0][0].chunk)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]))
    expect(new Uint8Array(parseChunkCalls[1][0].chunk)).toEqual(new Uint8Array([7, 8, 9]))
  })

  it('applies backpressure before sending more than the configured inflight batches', async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9]),
      new Uint8Array([10, 11, 12])
    ]
    const listeners = new Map<string, Set<(event: MessageEvent) => void>>()
    const emitMessage = (data: unknown) => {
      const cbs = listeners.get('message')
      cbs?.forEach((cb) => cb({ data } as MessageEvent))
    }
    const worker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn((type: string, cb: (event: MessageEvent) => void) => {
        const set = listeners.get(type) ?? new Set()
        set.add(cb)
        listeners.set(type, set)
      }),
      removeEventListener: vi.fn((type: string, cb: (event: MessageEvent) => void) => {
        listeners.get(type)?.delete(cb)
      })
    } as unknown as Worker
    const file = {
      name: 'save.xml.gz',
      size: 12,
      slice(start: number, end: number) {
        const headerSlice = start === 0 && end === 2
        const trailerSlice = start === 8 && end === 12
        return {
          arrayBuffer: vi.fn(async () => (headerSlice
            ? new Uint8Array([0x1f, 0x8b])
            : new Uint8Array([0x0c, 0x00, 0x00, 0x00])).buffer)
        }
      },
      stream() {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk)
            controller.close()
          }
        })
      }
    } as unknown as File

    const streamingPromise = streamFileToSaveParserWorker({
      worker,
      file,
      currentVersion: '8.0',
      targetBatchBytes: 3,
      maxInflightBatches: 1
    })

    await flushAsyncTurns(2)

    let parseChunkCalls = worker.postMessage.mock.calls.filter(([message]) => message.type === 'parse_chunk')
    expect(parseChunkCalls).toHaveLength(1)

    emitMessage({ type: 'chunk_processed' })
    await flushAsyncTurns(2)

    parseChunkCalls = worker.postMessage.mock.calls.filter(([message]) => message.type === 'parse_chunk')
    expect(parseChunkCalls).toHaveLength(2)

    emitMessage({ type: 'chunk_processed' })
    await flushAsyncTurns(2)
    parseChunkCalls = worker.postMessage.mock.calls.filter(([message]) => message.type === 'parse_chunk')
    expect(parseChunkCalls).toHaveLength(3)

    emitMessage({ type: 'chunk_processed' })
    await flushAsyncTurns(2)
    parseChunkCalls = worker.postMessage.mock.calls.filter(([message]) => message.type === 'parse_chunk')
    expect(parseChunkCalls).toHaveLength(4)

    emitMessage({ type: 'chunk_processed' })

    await streamingPromise

    parseChunkCalls = worker.postMessage.mock.calls.filter(([message]) => message.type === 'parse_chunk')
    expect(parseChunkCalls).toHaveLength(4)
  })
})
