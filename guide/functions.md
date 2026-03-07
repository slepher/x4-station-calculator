# Guide Functions

## Functions

- `getShipCandidates`
  - `file: src/domain-data/ship-build-queries.ts`
  - `ref: extractShipCandidates`
  - `usage: 选择飞船候选`
  - `signature: getShipCandidates(filters)`
  - `args:`
    - `filters.shipClass: 'ship_s' | 'ship_m' | 'ship_l' | 'ship_xl' | null`
    - `filters.races: string[]`
    - `filters.types: string[]`
    - `filters.query?: string`
  - `returns:`
    - `items: X4Ship[] (已排序)`
    - `raceCountMap: Map<string, number>`
    - `typeCountMap: Map<string, number>`
  - `example: getShipCandidates({ shipClass: 'ship_m', races: ['terran'], types: ['corvette'] })`
  - `constraints: shipClass 为 null 时返回空 items 与空 countMap；items 固定按 ship.id 排序`

- `getEquipmentCandidatesBySelector`
  - `file: src/domain-data/ship-build-queries.ts`
  - `ref: extractEquipmentCandidatesBySelector`
  - `usage: 选择装备候选`
  - `signature: getEquipmentCandidatesBySelector(shipId, selector, filters)`
  - `args:`
    - `shipId: string`
    - `selector.mode: 'slotTypeSizeNth' | 'slotTypeGroupName' | 'slotTypeSizeN'`
    - `selector(slotTypeSizeNth): { slotType, size, nth }`
    - `selector(slotTypeGroupName): { slotType, groupName }`
    - `selector(slotTypeSizeN): { slotType, sizeN } // 例: 'L'|'L1'|'M3'|'XL'`
    - `filters.races: string[]`
    - `filters.mks: string[]`
    - `filters.tags: string[]`
  - `returns: FitEquipmentOption[] (按 id 排序)`
  - `example: getEquipmentCandidatesBySelector('ship_ter_m_corvette_02_a', { mode: 'slotTypeSizeN', slotType: 'turret', sizeN: 'M1' }, { races: [], mks: [], tags: [] })`
  - `constraints: 不支持 tagAll，filters.tags 固定为任一命中；sizeN 数字按 1-based 解析并转换为内部 nth(0-based)`

- `getEquipmentCandidatesBySlot`
  - `file: src/domain-data/ship-build-queries.ts`
  - `ref: filterEquipmentCandidates`
  - `usage: 选择装备候选（slotType + size）`
  - `signature: getEquipmentCandidatesBySlot(slotType, size, tagsAll, filters)`
  - `args:`
    - `slotType: 'engine' | 'shield' | 'turret' | 'weapon' | 'thruster' | 'consumables' | 'units'`
    - `size: 'small' | 'medium' | 'large' | 'extralarge'`
    - `tagsAll: string[] // 必填`
    - `filters.races: string[]`
    - `filters.mks: string[]`
    - `filters.tags: string[]`
  - `returns:`
    - `items: FitEquipmentOption[] (按 id 排序)`
    - `raceCountMap: Map<string, number>`
    - `mkCountMap: Map<string, number>`
    - `tagCountMap: Map<string, number>`
  - `example: getEquipmentCandidatesBySlot('turret', 'large', ['standard', 'advanced'], { races: ['argon'], mks: [], tags: ['standard'] })`
  - `constraints: tagsAll 为硬约束（equipment.tags ⊆ tagsAll）；filters.tags 为结果二次过滤（任一命中）`

## Pending

pending:
- []
