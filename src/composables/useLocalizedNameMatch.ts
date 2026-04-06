import { useI18n } from 'vue-i18n'

export interface LocalizedNameMatchInput {
  englishName: string
  localizedName: string
  query: string
}

export interface LocalizedNameMatchResult {
  matched: boolean
  matchedEnglish: boolean
  matchedLocal: boolean
  shouldShowEnglish: boolean
}

export function useLocalizedNameMatch() {
  const { locale } = useI18n()

  function normalize(str: string): string {
    return str.toLowerCase().trim()
  }

  function match(input: LocalizedNameMatchInput): LocalizedNameMatchResult {
    const normalizedQuery = normalize(input.query)
    const normalizedEnglish = normalize(input.englishName)
    const normalizedLocal = normalize(input.localizedName)

    const matchedEnglish = normalizedQuery.length > 0 && normalizedEnglish.includes(normalizedQuery)
    const matchedLocal = normalizedQuery.length > 0 && normalizedLocal.includes(normalizedQuery)

    const isNonEnglish = locale.value !== 'en'
    const shouldShowEnglish = isNonEnglish && matchedEnglish && !matchedLocal && input.englishName !== input.localizedName

    return {
      matched: matchedEnglish || matchedLocal,
      matchedEnglish,
      matchedLocal,
      shouldShowEnglish
    }
  }

  function formatLabel(englishName: string, localizedName: string, query: string): string {
    const result = match({ englishName, localizedName, query })
    
    if (result.shouldShowEnglish) {
      return `${localizedName} (${englishName})`
    }
    return localizedName || englishName
  }

  return {
    match,
    formatLabel
  }
}