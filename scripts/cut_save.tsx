import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()

const args = process.argv.slice(2)
const SAVE_PATH = args[0] || path.join(ROOT, 'save.json')
const OUTPUT_SAVE_PATH = args[1] || path.join(ROOT, 'tests/fixtures/save.json')

const SECTOR_MACROS = new Set([
  // binding.yaml groups
  'cluster_100_sector001_macro',
  'cluster_24_sector001_macro',
  'cluster_715_sector001_macro',
  'cluster_48_sector001_macro',
  'cluster_601_sector001_macro',
  // binding.yaml coverage
  'cluster_106_sector001_macro',
  'cluster_26_sector001_macro',
  'cluster_740_sector001_macro',
  'cluster_27_sector001_macro',
  'cluster_31_sector001_macro',
  // 诺皮利奥的财富
  'cluster_04_sector001_macro',
  'cluster_04_sector002_macro',
  // 野蛮疾驰
  'cluster_112_sector001_macro',
  'cluster_112_sector002_macro',
  // erlking_vaults
  'cluster_500_sector001_macro',
  'cluster_501_sector001_macro',
  'cluster_503_sector001_macro'
])

interface PlayerStation {
  code: string
  name: string
  [key: string]: unknown
}

interface Sector {
  player_stations?: Record<string, PlayerStation>
  [key: string]: unknown
}

interface SaveMeta {
  filename: string
  time: string
  guid: string
  [key: string]: unknown
}

interface SaveData {
  meta: SaveMeta
  sectors: Record<string, Sector>
  isCompatible?: boolean
  isValid?: boolean
  [key: string]: unknown
}

const main = async () => {
  const raw = await readFile(SAVE_PATH, 'utf8')
  const saveData: SaveData = JSON.parse(raw)
  
  const originalSectors = saveData.sectors || {}
  const filteredSectors: Record<string, Sector> = {}
  
  for (const [macro, sector] of Object.entries(originalSectors)) {
    if (SECTOR_MACROS.has(macro)) {
      filteredSectors[macro] = sector
    }
  }
  
  const filteredSave: SaveData = {
    meta: saveData.meta,
    sectors: filteredSectors
  }
  
  await writeFile(OUTPUT_SAVE_PATH, JSON.stringify(filteredSave, null, 2), 'utf8')
  console.log('Created:', OUTPUT_SAVE_PATH)
  console.log('Filtered sectors:', Object.keys(filteredSectors).length, '/', Object.keys(originalSectors).length)
  
  console.log('\n=== Summary ===')
  SECTOR_MACROS.forEach(macro => {
    if (filteredSectors[macro]) {
      const s = filteredSectors[macro]
      const playerCount = Object.keys(s.player_stations || {}).length
      console.log(`${macro}: player_stations=${playerCount}`)
    } else {
      console.log(`${macro}: NOT FOUND`)
    }
  })
}

main().catch(console.error).then(() => process.exit(0))