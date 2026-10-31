import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'

type Messages = { [key: string]: string | Messages }

function flatten(messages: Messages, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value]] : Object.entries(flatten(value, path))
  }))
}

const locales = import.meta.glob<Messages>('/src/locales/*.json', { eager: true, import: 'default' })
const reference = flatten(en)

describe('UI locale completeness', () => {
  it('discovers all 12 UI dictionaries', () => {
    expect(Object.keys(locales)).toHaveLength(12)
  })

  it.each(Object.entries(locales))('%s covers all English keys and preserves parameters', (_locale, messages) => {
    const translated = flatten(messages)
    expect(Object.keys(translated).sort()).toEqual(Object.keys(reference).sort())
    for (const [key, source] of Object.entries(reference)) {
      expect(translated[key].match(/\{\w+\}/g)?.sort(), key)
        .toEqual(source.match(/\{\w+\}/g)?.sort())
    }
  })
})
