// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import SaveUploadPanel from '../../../src/components/save/SaveUploadPanel.vue'

const isParsing = ref(false)
const parseProgress = ref('')
const parseError = ref<string | null>(null)

const saveStoreMock = {
  isParsing,
  parseProgress,
  parseError,
  selectedArchive: null as any,
  setParsingState: vi.fn((parsing: boolean, progress = '', error: string | null = null) => {
    isParsing.value = parsing
    parseProgress.value = progress
    parseError.value = error
  }),
  addArchive: vi.fn()
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: () => saveStoreMock
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    currentVersion: '8.0'
  })
}))

vi.mock('../../../src/components/save/saveUploadStreaming', () => ({
  streamFileToSaveParserWorker: vi.fn(async ({ worker }: { worker: Worker }) => {
    worker.onmessage?.({
      data: {
        type: 'progress',
        data: {
          phase: 'parsing',
          percent: 42,
          sectorCount: 7,
          error: null,
          tagCount: 100,
          done: false,
          inputComplete: false,
          inputBytesTotal: 420,
          parsedBytesTotal: 420,
          bufferedBytes: 0,
          expectedTotalBytes: 1000
        }
      }
    } as MessageEvent)
  })
}))

describe('save upload panel', () => {
  beforeEach(() => {
    isParsing.value = false
    parseProgress.value = ''
    parseError.value = null
    saveStoreMock.selectedArchive = null
    saveStoreMock.setParsingState.mockClear()
    saveStoreMock.addArchive.mockClear()
  })

  it('binds progress bar width to worker percent while parsing xml', async () => {
    const workerTerminate = vi.fn()
    class WorkerMock {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null
      terminate = workerTerminate
    }
    vi.stubGlobal('Worker', WorkerMock)

    const wrapper = mount(SaveUploadPanel)
    const input = wrapper.get('input[type="file"]')
    const file = new File(['<savegame/>'], 'test.xml', { type: 'text/xml' })

    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true
    })
    await input.trigger('change')
    await nextTick()

    expect(saveStoreMock.parseProgress.value).toBe('42% - 7 sectors')
    expect(saveStoreMock.isParsing.value).toBe(true)
    const progressBar = wrapper.get('.progress-bar')
    expect(progressBar.attributes('style')).toContain('width: 42%')
  })
})
