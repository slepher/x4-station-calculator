export interface FocusOverlayInViewportOptions {
  panX: number
  panY: number
  clampPan: (nextX: number, nextY: number) => void
}

export function focusOverlayInViewport(
  viewport: HTMLElement,
  selector: string,
  options: FocusOverlayInViewportOptions
): boolean {
  const overlay = viewport.querySelector<SVGGraphicsElement>(selector)
  if (!overlay) return false

  const viewportRect = viewport.getBoundingClientRect()
  const overlayRect = overlay.getBoundingClientRect()
  const overlayCenterX = overlayRect.left - viewportRect.left + overlayRect.width / 2
  const overlayCenterY = overlayRect.top - viewportRect.top + overlayRect.height / 2

  options.clampPan(
    options.panX + viewportRect.width / 2 - overlayCenterX,
    options.panY + viewportRect.height / 2 - overlayCenterY
  )

  return true
}
