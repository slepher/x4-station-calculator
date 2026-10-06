import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readJson } from './shared-ts/io'

export interface JsonDifference { file?: string; path: string; kind: string; expected?: unknown; actual?: unknown }

export function compareJson(expected: unknown, actual: unknown, path = '$'): JsonDifference[] {
  if (expected === actual) return []
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const result: JsonDifference[] = []
    if (expected.length !== actual.length) result.push({ path, kind: 'array-length', expected: expected.length, actual: actual.length })
    for (let i = 0; i < Math.min(expected.length, actual.length); i++) result.push(...compareJson(expected[i], actual[i], `${path}[${i}]`))
    return result
  }
  if (expected !== null && actual !== null && typeof expected === 'object' && typeof actual === 'object' && !Array.isArray(expected) && !Array.isArray(actual)) {
    const left = expected as Record<string, unknown>
    const right = actual as Record<string, unknown>
    const result: JsonDifference[] = []
    for (const key of Object.keys(left)) {
      const childPath = `${path}[${JSON.stringify(key)}]`
      if (!Object.hasOwn(right, key)) result.push({ path: childPath, kind: 'missing-field', expected: left[key] })
      else result.push(...compareJson(left[key], right[key], childPath))
    }
    for (const key of Object.keys(right)) if (!Object.hasOwn(left, key)) result.push({ path: `${path}[${JSON.stringify(key)}]`, kind: 'extra-field', actual: right[key] })
    return result
  }
  return [{ path, kind: 'value', expected, actual }]
}

function jsonFiles(root: string, directory = ''): string[] {
  const files: string[] = []
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const relative = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...jsonFiles(root, relative))
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(relative)
  }
  return files.sort()
}

export function compareDirectories(expectedRoot: string, actualRoot: string): JsonDifference[] {
  const expected = jsonFiles(expectedRoot)
  const actual = new Set(jsonFiles(actualRoot))
  const differences: JsonDifference[] = []
  for (const file of expected) {
    if (!actual.delete(file)) differences.push({ file, path: '$', kind: 'missing-file' })
    else differences.push(...compareJson(readJson(join(expectedRoot, file)), readJson(join(actualRoot, file))).map(diff => ({ file, ...diff })))
  }
  for (const file of actual) differences.push({ file, path: '$', kind: 'extra-file' })
  return differences
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [expected, actual] = process.argv.slice(2)
  if (expected === undefined || actual === undefined) { console.error('Usage: tsx scripts/processor/compare.ts <python-output> <ts-output>'); process.exitCode = 1 }
  else {
    try {
      const differences = compareDirectories(expected, actual)
      console.log(JSON.stringify({ differenceCount: differences.length, differences }, null, 2))
      if (differences.length > 0) process.exitCode = 1
    } catch (error) { console.error(String(error)); process.exitCode = 1 }
  }
}
