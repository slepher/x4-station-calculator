import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const mapPath = path.resolve(__dirname, '../src/assets/map.json')

async function main() {
  const raw = await readFile(mapPath, 'utf8')
  const formatted = `${JSON.stringify(JSON.parse(raw), null, 2)}\n`

  if (raw === formatted) {
    console.log(`Already formatted: ${mapPath}`)
    return
  }

  await writeFile(mapPath, formatted, 'utf8')
  console.log(`Formatted: ${mapPath}`)
}

main().catch(error => {
  console.error('Failed to format map.json')
  console.error(error)
  process.exitCode = 1
})
