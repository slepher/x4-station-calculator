import type { SavePoiCategory, SavePoiVisibility } from '@/types/saveArchive'

export function getEffectiveVisibleSavePoiCategories(
  visibility: SavePoiVisibility,
  activeDetailCategory: SavePoiCategory | null
): SavePoiCategory[] {
  const categories = (Object.entries(visibility) as Array<[SavePoiCategory, boolean]>)
    .filter(([, visible]) => visible)
    .map(([category]) => category)

  if (activeDetailCategory && !categories.includes(activeDetailCategory)) {
    categories.push(activeDetailCategory)
  }

  return categories
}
