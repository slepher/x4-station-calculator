<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { buildSaveParserConfig } from '@/utils/saveParserConfig'
import type { SaveArchive, SaveParserMessage } from '@/types/saveArchive'

const { t } = useI18n()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

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
      saveStore.setParsingState(false, '', result.error || t('save_import.import_failed'))
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : t('save_import.import_failed')
    saveStore.setParsingState(false, '', message)
  }
}

async function processXmlFile(file: File) {
  saveStore.setParsingState(true, t('save_import.reading_file'), null)

  try {
    const arrayBuffer = await file.arrayBuffer()
    const config = buildSaveParserConfig(gameDataStore.currentVersion)

    const worker = new Worker(
      new URL('@/workers/saveParser.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e: MessageEvent<SaveParserMessage>) => {
      const msg = e.data

      if (msg.type === 'progress') {
        saveStore.setParsingState(true, msg.status, null)
      } else if (msg.type === 'complete') {
        saveStore.addArchive(msg.data)
        saveStore.setParsingState(false, '', null)
        emit('upload-complete', msg.data)
        worker.terminate()
      } else if (msg.type === 'error') {
        saveStore.setParsingState(false, '', msg.message || t('save_import.parse_failed'))
        worker.terminate()
      }
    }

    worker.onerror = (error) => {
      saveStore.setParsingState(false, '', error.message || t('save_import.parse_failed'))
      worker.terminate()
    }

    worker.postMessage({ type: 'parse', arrayBuffer, config, filename: file.name }, [arrayBuffer])
  } catch (e) {
    const message = e instanceof Error ? e.message : t('save_import.parse_failed')
    saveStore.setParsingState(false, '', message)
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
        accept=".xml,.xml.gz,.json"
        @change="handleFileSelect"
      />
    </div>

    <div v-if="saveStore.isParsing" class="parse-status">
      <div class="parse-progress">
        <div class="spinner"></div>
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
  @apply flex items-center gap-2 text-sm text-slate-400;
}

.spinner {
  @apply w-4 h-4 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin;
}

.parse-error {
  @apply flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400;
}
</style>
