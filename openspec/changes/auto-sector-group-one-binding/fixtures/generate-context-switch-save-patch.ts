import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FIXTURE_DIR = join(import.meta.dirname!, '../../../../tests/fixtures')
const PATCH_DIR = join(import.meta.dirname!, '../../../../tests/e2e/auto-sector-group-one-binding/fixtures')

const ALT_GUID = 'X9Y8Z7W6-V5U4-3210-TSRQ-PONMLKJIHGFE'

interface SaveMeta {
  guid: string
  time: number
  playerName: string
  version: string
  filename: string
  parser_version: string
  post_processor_version?: string
  source: string
}

interface SaveJson {
  meta: SaveMeta
  sectors: Record<string, unknown>
  [key: string]: unknown
}

interface PatchOutput {
  $target: string
  $merge: {
    meta: Partial<SaveMeta>
  }
}

function generatePatch() {
  const savePath = join(FIXTURE_DIR, 'save', 'save.json')
  const save = JSON.parse(readFileSync(savePath, 'utf8')) as SaveJson

  const patch: PatchOutput = {
    $target: 'save.json',
    $merge: {
      meta: {
        guid: ALT_GUID,
        time: 999999999,
        filename: 'context_switch_save',
        source: 'fixture-patch'
      }
    }
  }

  writeFileSync(join(PATCH_DIR, 'context-switch-save.patch.json'), JSON.stringify(patch, null, 2), 'utf8')
  console.log('Generated context-switch-save.patch.json')
  console.log(`  alt guid: ${ALT_GUID}`)
  console.log(`  alt time: 999999999`)
  console.log(`  alt filename: context_switch_save`)
  console.log(`  patch size: ${JSON.stringify(patch).length} bytes`)
}

generatePatch()
