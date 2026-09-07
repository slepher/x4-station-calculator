import { tinycolor } from 'vue-color'

export function useSectorGroupColorPresenter(emitColor: (color: string | undefined) => void) {
  function updateColor(value: Parameters<typeof tinycolor>[0]): boolean {
    const color = tinycolor(value)
    if (!color.isValid()) return false
    const alpha = color.getAlpha()
    if (alpha === 0) emitColor(undefined)
    else if (alpha === 1) emitColor(color.toHexString())
    else emitColor(color.toHex8String())
    return true
  }

  return { updateColor }
}
