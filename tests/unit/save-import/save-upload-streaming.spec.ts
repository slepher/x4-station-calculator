import { describe, expect, it, vi } from 'vitest'
import { streamFileToSaveParserWorker } from '../../../src/components/save/saveUploadStreaming'

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

    const worker = {
      postMessage: vi.fn()
    } as unknown as Worker

    await streamFileToSaveParserWorker({
      worker,
      file,
      currentVersion: '8.0'
    })

    expect(file.arrayBuffer).not.toHaveBeenCalled()
    expect(worker.postMessage).toHaveBeenCalledTimes(4)
    expect(worker.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'parse_start',
      filename: 'save.xml.gz',
      currentVersion: '8.0',
      expectedTotalBytes: 0x1234
    })
    expect(worker.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'parse_chunk',
      chunk: chunks[0].buffer
    }, [chunks[0].buffer])
    expect(worker.postMessage).toHaveBeenNthCalledWith(3, {
      type: 'parse_chunk',
      chunk: chunks[1].buffer
    }, [chunks[1].buffer])
    expect(worker.postMessage).toHaveBeenNthCalledWith(4, {
      type: 'parse_end'
    })
  })
})
