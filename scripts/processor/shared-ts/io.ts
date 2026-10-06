import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function readJson<T = any>(path: string): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T }
  catch (error) { throw new Error(`JSON ${path}: ${error instanceof Error ? error.message : String(error)}`) }
}

export function writeJson(path: string, data: unknown): void {
  const text = JSON.stringify(data, null, 2)
  if (text === undefined) throw new Error(`Cannot serialize JSON: ${path}`)
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  try {
    writeFileSync(temporary, text, 'utf8')
    renameSync(temporary, path)
  } finally { rmSync(temporary, { force: true }) }
}
