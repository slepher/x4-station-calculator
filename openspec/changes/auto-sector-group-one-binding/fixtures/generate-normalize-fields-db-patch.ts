import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FIXTURE_DIR = join(import.meta.dirname!, '../../../../tests/fixtures')
const PATCH_DIR = join(import.meta.dirname!, '../../../../tests/e2e/auto-sector-group-one-binding/fixtures')

interface DbJson {
  vsn: number
  x4_save_bindings: {
    version: number
    list: Array<Record<string, unknown>>
  }
  [key: string]: unknown
}

interface PatchOutput {
  $target: string
  $delete: string[]
  $append: Record<string, unknown[]>
}

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

function generatePatch() {
  const dbPath = join(FIXTURE_DIR, 'db.json')
  const db = JSON.parse(readFileSync(dbPath, 'utf8')) as DbJson

  const bindings = db.x4_save_bindings.list
  const bindingIndex = bindings.findIndex(b => b.gameGuid === GAME_GUID)

  if (bindingIndex === -1) {
    console.error(`Binding with gameGuid ${GAME_GUID} not found`)
    process.exit(1)
  }

  const modified = structuredClone(bindings[bindingIndex])
  modified.appliedAutoGroupArchiveTime = 1345095294
  modified.prefJumpRange = 2
  modified.bridgeSearchJumpRange = 5
  modified.prefThreshold = 500

  const patch: PatchOutput = {
    $target: 'db.json',
    $delete: [`x4_save_bindings.list.${bindingIndex}`],
    $append: {
      'x4_save_bindings.list': [modified]
    }
  }

  writeFileSync(join(PATCH_DIR, 'normalize-fields-db.patch.json'), JSON.stringify(patch, null, 2), 'utf8')
  console.log('Generated normalize-fields-db.patch.json')
  console.log(`  modified binding at index ${bindingIndex}`)
  console.log(`  fields: appliedAutoGroupArchiveTime=${modified.appliedAutoGroupArchiveTime}, prefJumpRange=${modified.prefJumpRange}, bridgeSearchJumpRange=${modified.bridgeSearchJumpRange}, prefThreshold=${modified.prefThreshold}`)
}

generatePatch()
