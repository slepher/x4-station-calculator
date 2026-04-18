<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { SaveArchive, SaveParserRustMessage } from '@/types/saveArchive'
import { streamFileToSaveParserWorker } from './saveUploadStreaming'
import { postProcessRustSaveArchive } from '@/workers/saveParser.post'

const { t } = useI18n()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const parsePercent = ref(0)

function isSaveUploadTimingDebugEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('save_upload_timing_debug') === 'true'
  } catch {
    return false
  }
}

const emit = defineEmits<{
  (e: 'upload-complete', archive: SaveArchive): void
}>()

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0 && files[0]) {
    await processFile(files[0])
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0 && files[0]) {
    processFile(files[0])
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

async function processFile(file: File) {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.json')) {
    await processJsonFile(file)
  } else if (fileName.endsWith('.xml') || fileName.endsWith('.xml.gz')) {
    await processXmlFile(file)
  } else {
    saveStore.setParsingState(false, '', t('save_import.unsupported_file_type'))
  }
}

async function processJsonFile(file: File) {
  parsePercent.value = 0
  saveStore.setParsingState(true, t('save_import.loading_json'), null)

  try {
    const text = await file.text()
    const jsonData = JSON.parse(text)
    const result = saveStore.importFromJson(jsonData)

    if (result.success) {
      saveStore.setParsingState(false, '', null)
      if (saveStore.selectedArchive) {
        emit('upload-complete', saveStore.selectedArchive)
      }
    } else {
      let errorMessage = result.error || t('save_import.import_failed')
      
      if (result.errorDetail?.type === 'version_mismatch') {
        errorMessage = t('save_import.version_mismatch_detail', {
          saveVersion: result.errorDetail.save_version_normalized,
          expectedVersion: result.errorDetail.expected_version_normalized
        })
      } else if (result.errorDetail?.type === 'parse_error') {
        errorMessage = t('save_import.parse_error', {
          message: result.errorDetail.message
        })
      }
      
      saveStore.setParsingState(false, '', errorMessage)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : t('save_import.import_failed')
    saveStore.setParsingState(false, '', message)
  }
}

async function processXmlFile(file: File) {
  parsePercent.value = 0
  saveStore.setParsingState(true, t('save_import.reading_file'), null)
  const debugTimings = isSaveUploadTimingDebugEnabled()
  const uploadStartedAt = Date.now()
  let lastProgressAt = uploadStartedAt

  if (debugTimings) {
    console.log('[save-upload-timing][ui] upload:start', {
      fileName: file.name,
      fileSize: file.size
    })
  }

  try {
    const worker = new Worker(
      new URL('@/workers/saveParserRust.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e: MessageEvent<SaveParserRustMessage>) => {
      const msg = e.data

      if (msg.type === 'progress') {
        const { percent, phase, sectorCount, error } = msg.data
        parsePercent.value = Math.max(0, Math.min(100, percent))
        const statusText = error
          ? error
          : phase === 'done'
            ? t('save_import.finalizing')
            : `${percent.toFixed(0)}% - ${sectorCount} sectors`
        saveStore.setParsingState(true, statusText, null)
        if (debugTimings) {
          const now = Date.now()
          console.log('[save-upload-timing][ui] worker:progress', {
            phase,
            percent,
            sectorCount,
            elapsedMs: now - uploadStartedAt,
            sinceLastProgressMs: now - lastProgressAt
          })
          lastProgressAt = now
        }
      } else if (msg.type === 'complete') {
        parsePercent.value = 100
        const processedArchive = postProcessRustSaveArchive(
          msg.data, 
          gameDataStore.modulesByMacroId,
          gameDataStore.maps,
          gameDataStore.ships,
          gameDataStore.equipments
        )
        saveStore.addArchive(processedArchive)
        saveStore.setParsingState(false, '', null)
        emit('upload-complete', processedArchive)
        if (debugTimings) {
          console.log('[save-upload-timing][ui] upload:complete', {
            elapsedMs: Date.now() - uploadStartedAt,
            sectorCount: Object.keys(processedArchive.sectors || {}).length
          })
        }
        worker.terminate()
      } else if (msg.type === 'error') {
        parsePercent.value = 0
        let errorMessage = msg.message || t('save_import.parse_failed')
        
        if (msg.detail?.type === 'version_mismatch') {
          errorMessage = t('save_import.version_mismatch_detail', {
            saveVersion: msg.detail.save_version_normalized,
            expectedVersion: msg.detail.expected_version_normalized
          })
        } else if (msg.detail?.type === 'parse_error') {
          errorMessage = t('save_import.parse_error', {
            message: msg.detail.message
          })
        }
        
        saveStore.setParsingState(false, '', errorMessage)
        if (debugTimings) {
          console.log('[save-upload-timing][ui] upload:error', {
            elapsedMs: Date.now() - uploadStartedAt,
            message: msg.message,
            detail: msg.detail
          })
        }
        worker.terminate()
      }
    }

    worker.onerror = (error) => {
      parsePercent.value = 0
      saveStore.setParsingState(false, '', error.message || t('save_import.parse_failed'))
      if (debugTimings) {
        console.log('[save-upload-timing][ui] worker:error', {
          elapsedMs: Date.now() - uploadStartedAt,
          message: error.message
        })
      }
      worker.terminate()
    }

    await streamFileToSaveParserWorker({
      worker,
      file,
      currentVersion: gameDataStore.currentVersion,
      debugTimings
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : t('save_import.parse_failed')
    saveStore.setParsingState(false, '', message)
    if (debugTimings) {
      console.log('[save-upload-timing][ui] upload:exception', {
        elapsedMs: Date.now() - uploadStartedAt,
        message
      })
    }
  }
}
</script>

<template>
  <div class="save-upload-panel">
    <div
      class="upload-zone"
      :class="{ 'upload-zone-dragging': isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="triggerFileInput"
    >
      <div class="upload-icon">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <div class="upload-text">
        <span class="upload-title">{{ t('save_import.drag_drop_hint') }}</span>
        <span class="upload-hint">{{ t('save_import.supported_formats') }}</span>
      </div>
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept=".xml,.gz,application/gzip,.json"
        @change="handleFileSelect"
      />
    </div>

    <div v-if="saveStore.isParsing" class="parse-status">
      <div class="parse-progress">
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: `${parsePercent}%` }"></div>
        </div>
        <span>{{ saveStore.parseProgress }}</span>
      </div>
    </div>

    <div v-if="saveStore.parseError" class="parse-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ saveStore.parseError }}</span>
    </div>
  </div>
</template>

<style scoped>
.save-upload-panel {
  @apply flex flex-col gap-3;
}

.upload-zone {
  @apply flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer transition-all duration-200 bg-slate-800/30;
}

.upload-zone:hover {
  @apply border-slate-500 bg-slate-800/50;
}

.upload-zone-dragging {
  @apply border-blue-500 bg-blue-500/10;
}

.upload-icon {
  @apply text-slate-400;
}

.upload-text {
  @apply flex flex-col items-center gap-1;
}

.upload-title {
  @apply text-sm text-slate-300;
}

.upload-hint {
  @apply text-xs text-slate-500;
}

.hidden {
  display: none;
}

.parse-status {
  @apply flex items-center justify-center p-3 bg-slate-800/50 rounded;
}

.parse-progress {
  @apply flex items-center gap-3 text-sm text-slate-400;
}

.progress-bar-container {
  @apply w-32 h-2 bg-slate-700 rounded overflow-hidden;
}

.progress-bar {
  @apply h-full bg-blue-500 transition-all duration-300;
}

.parse-error {
  @apply flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400;
}
</style>
