import { describe, expect, it } from 'vitest'
import {
  inferMapArchiveTarget,
  shouldShowBindingOverlayForArchive,
  shouldShowBindingOverlayForMapTarget
} from '@/components/map/utils/bindingOverlayVisibility'

describe('binding overlay visibility', () => {
  it('hides binding overlays when the displayed archive belongs to another game guid', () => {
    expect(shouldShowBindingOverlayForArchive({
      archiveGuid: 'archive-b',
      bindingGuid: 'archive-a'
    })).toBe(false)
  })

  it('hides binding overlays when no archive is displayed', () => {
    expect(shouldShowBindingOverlayForArchive({
      archiveGuid: null,
      bindingGuid: 'archive-a'
    })).toBe(false)
  })

  it('shows binding overlays when the displayed archive matches the active binding guid', () => {
    expect(shouldShowBindingOverlayForArchive({
      archiveGuid: 'archive-a',
      bindingGuid: 'archive-a'
    })).toBe(true)
  })

  it('hides binding overlays for the explicit default map target', () => {
    expect(shouldShowBindingOverlayForMapTarget({
      target: { kind: 'default-map' },
      bindingGuid: 'archive-a'
    })).toBe(false)
  })

  it('shows binding overlays only when archive target matches active binding guid', () => {
    expect(shouldShowBindingOverlayForMapTarget({
      target: { kind: 'archive', guid: 'archive-a', time: 1 },
      bindingGuid: 'archive-a'
    })).toBe(true)

    expect(shouldShowBindingOverlayForMapTarget({
      target: { kind: 'archive', guid: 'archive-b', time: 1 },
      bindingGuid: 'archive-a'
    })).toBe(false)
  })

  it('infers active binding archive before default map when no target was explicitly selected', () => {
    expect(inferMapArchiveTarget({
      activeBindingGuid: 'archive-a',
      activeBindingArchiveTime: 9,
      selectedArchiveGuid: null,
      selectedArchiveTime: null
    })).toEqual({ kind: 'archive', guid: 'archive-a', time: 9 })
  })

  it('falls back to default map when no archive target can be inferred', () => {
    expect(inferMapArchiveTarget({
      activeBindingGuid: null,
      activeBindingArchiveTime: null,
      selectedArchiveGuid: null,
      selectedArchiveTime: null
    })).toEqual({ kind: 'default-map' })
  })
})
