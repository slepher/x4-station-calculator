import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import zhCN from '@/locales/zh-CN.json'
import zhTW from '@/locales/zh-TW.json'
import ja from '@/locales/ja.json'

type Messages = { [key: string]: string | Messages }

function flatten(messages: Messages, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value]] : Object.entries(flatten(value, path))
  }))
}

const reference = { ...flatten(en), ...flatten(zhCN) }

describe('UI locale completeness', () => {
  it.each([['zh-TW', zhTW], ['ja', ja]] as const)('%s covers all source keys and preserves parameters', (_locale, messages) => {
    const translated = flatten(messages)
    expect(Object.keys(translated).sort()).toEqual(Object.keys(reference).sort())
    for (const [key, source] of Object.entries(reference)) {
      expect(translated[key].match(/\{\w+\}/g)?.sort(), key)
        .toEqual(source.match(/\{\w+\}/g)?.sort())
    }
  })
})
