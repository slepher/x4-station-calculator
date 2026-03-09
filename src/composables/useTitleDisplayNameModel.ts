import { computed, type ComputedRef } from 'vue'
import { useTitleEditor, type TitleEditorConfig } from './useTitleEditor'

function resolveConfig(config: ComputedRef<TitleEditorConfig> | (() => TitleEditorConfig)): TitleEditorConfig {
  if (typeof config === 'function') {
    return config() as TitleEditorConfig
  }
  return config.value as TitleEditorConfig
}

export function useTitleDisplayNameModel(config: ComputedRef<TitleEditorConfig> | (() => TitleEditorConfig)) {
  const titleEditor = useTitleEditor(config)

  const displayNameModel = computed({
    get: () => titleEditor.displayTitle.value,
    set: (value: string) => {
      resolveConfig(config).setName(value)
    }
  })

  return {
    displayNameModel
  }
}
