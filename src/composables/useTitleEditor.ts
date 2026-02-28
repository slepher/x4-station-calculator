import { ref, computed, type ComputedRef } from 'vue'
import { nextTick } from 'vue'

export interface TitleEditorConfig {
  getName: () => string
  setName: (name: string) => void
  getDefaultName: () => string | (() => string)
}

export function useTitleEditor(config: ComputedRef<TitleEditorConfig> | (() => TitleEditorConfig)) {
  const isEditing = ref(false)
  const inputRef = ref<HTMLInputElement | null>(null)
  const lastValidValue = ref('')
  const editingValue = ref('')

  const getConfig = () => {
    if (typeof config === 'function') {
      return config() as TitleEditorConfig
    }
    return config.value as TitleEditorConfig
  }

  const getDefaultNameValue = () => {
    const cfg = getConfig()
    const defaultName = cfg.getDefaultName()
    return typeof defaultName === 'function' ? defaultName() : defaultName
  }

  const displayTitle = computed(() => {
    const cfg = getConfig()
    return cfg.getName() || getDefaultNameValue()
  })

  const startEditing = async () => {
    lastValidValue.value = displayTitle.value
    editingValue.value = displayTitle.value
    isEditing.value = true
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }

  const cancelEditing = () => {
    isEditing.value = false
    editingValue.value = ''
  }

  const confirmEditing = () => {
    isEditing.value = false
    const cfg = getConfig()
    const defaultName = getDefaultNameValue()

    if (!editingValue.value.trim()) {
      // 空输入：如果之前是默认值则清除，否则保留原名
      cfg.setName(lastValidValue.value === defaultName ? '' : lastValidValue.value)
    } else {
      // 非空输入：直接设置新值
      cfg.setName(editingValue.value)
    }
    editingValue.value = ''
  }

  const setEditingValue = (val: string) => {
    editingValue.value = val
  }

  return {
    isEditing,
    inputRef,
    displayTitle,
    editingValue,
    startEditing,
    cancelEditing,
    confirmEditing,
    setEditingValue
  }
}
