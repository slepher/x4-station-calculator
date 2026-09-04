import { describe, expect, it } from 'vitest'
import { getLocalizedSectorQueryMatch, matchesLocalizedSectorQuery } from '@/components/empire/savePoiSearch'

describe('user-save-map localized save poi search', () => {
  it('matches both raw english name and localized display name in non-english locale', () => {
    expect(matchesLocalizedSectorQuery({
      rawName: 'Watchful Gaze',
      displayName: '警惕凝视',
      normalizedQuery: 'watchful',
      locale: 'zh-CN'
    })).toBe(true)

    expect(matchesLocalizedSectorQuery({
      rawName: 'Watchful Gaze',
      displayName: '警惕凝视',
      normalizedQuery: '警惕',
      locale: 'zh-CN'
    })).toBe(true)
  })

  it('only requires raw english name matching in english locale', () => {
    expect(matchesLocalizedSectorQuery({
      rawName: 'Watchful Gaze',
      displayName: '警惕凝视',
      normalizedQuery: 'watchful',
      locale: 'en'
    })).toBe(true)

    expect(matchesLocalizedSectorQuery({
      rawName: 'Watchful Gaze',
      displayName: '警惕凝视',
      normalizedQuery: '警惕',
      locale: 'en'
    })).toBe(false)
  })

  it('reports when a non-english locale matched only the raw english name', () => {
    expect(getLocalizedSectorQueryMatch({
      rawName: 'Watchful Gaze',
      displayName: '警惕凝视',
      normalizedQuery: 'watchful',
      locale: 'zh-CN'
    })).toEqual({
      matched: true,
      matchedRawName: true,
      matchedDisplayName: false
    })

    expect(getLocalizedSectorQueryMatch({
      rawName: 'Watchful Gaze',
      displayName: '警惕凝视',
      normalizedQuery: '警惕',
      locale: 'zh-CN'
    })).toEqual({
      matched: true,
      matchedRawName: false,
      matchedDisplayName: true
    })
  })
})
