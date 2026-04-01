/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { focusOverlayInViewport } from '@/components/empire/focusOverlayInViewport'

describe('focusOverlayInViewport', () => {
  it('centers the viewport on a matching overlay element', () => {
    document.body.innerHTML = `
      <div id="viewport">
        <svg>
          <g data-save-poi-key="playerStation:ABC"></g>
        </svg>
      </div>
    `

    const viewport = document.querySelector('#viewport') as HTMLDivElement
    const overlay = document.querySelector('[data-save-poi-key="playerStation:ABC"]') as SVGGElement

    viewport.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }))

    overlay.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 150,
      right: 140,
      bottom: 190,
      width: 40,
      height: 40,
      x: 100,
      y: 150,
      toJSON: () => ({})
    }))

    const clampPan = vi.fn()

    const focused = focusOverlayInViewport(viewport, '[data-save-poi-key="playerStation:ABC"]', {
      panX: 10,
      panY: 20,
      clampPan
    })

    expect(focused).toBe(true)
    expect(clampPan).toHaveBeenCalledWith(290, 150)
  })
})
