import type { Page } from '@playwright/test'

export type FixturePatchTarget = 'db.json' | 'save.json'
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export interface E2EFixturePatch {
  $target: FixturePatchTarget
  $delete?: string[]
  $merge?: JsonObject
  $append?: Record<string, JsonValue[]>
}

export interface LoadDbFixtureWithPatchesOptions {
  base: JsonObject
  patches: E2EFixturePatch[]
  locale?: 'zh-CN' | 'en'
  url?: string
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function pathParts(path: string): string[] {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) throw new Error('Fixture patch path must not be empty')
  return parts
}

function resolveParent(root: JsonValue, path: string): { parent: JsonValue; key: string } {
  const parts = pathParts(path)
  let current: JsonValue = root
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = Number(part)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error(`Fixture patch array index out of range: ${path}`)
      }
      current = current[index]
      continue
    }
    if (isRecord(current)) {
      if (!(part in current)) throw new Error(`Fixture patch path segment not found: ${path}`)
      current = current[part]
      continue
    }
    throw new Error(`Fixture patch path is not traversable: ${path}`)
  }
  return { parent: current, key: parts[parts.length - 1] }
}

function applyDelete(root: JsonValue, paths: string[] | undefined): void {
  for (const path of paths ?? []) {
    const { parent, key } = resolveParent(root, path)
    if (Array.isArray(parent)) {
      const index = Number(key)
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
        throw new Error(`Fixture patch array delete index out of range: ${path}`)
      }
      parent.splice(index, 1)
      continue
    }
    if (isRecord(parent)) {
      if (!(key in parent)) throw new Error(`Fixture patch delete path not found: ${path}`)
      delete parent[key]
      continue
    }
    throw new Error(`Fixture patch delete parent is not object or array: ${path}`)
  }
}

function deepMerge(target: JsonValue, patch: JsonValue): JsonValue {
  if (isRecord(target) && isRecord(patch)) {
    for (const [key, value] of Object.entries(patch)) {
      target[key] = key in target ? deepMerge(target[key], value) : cloneJson(value)
    }
    return target
  }
  return cloneJson(patch)
}

function applyAppend(root: JsonValue, append: Record<string, JsonValue[]> | undefined): void {
  for (const [path, values] of Object.entries(append ?? {})) {
    const { parent, key } = resolveParent(root, path)
    const target = Array.isArray(parent)
      ? parent[Number(key)]
      : isRecord(parent)
        ? parent[key]
        : undefined

    if (!Array.isArray(target)) throw new Error(`Fixture patch append target is not an array: ${path}`)
    for (const value of values) {
      target.push(cloneJson(value))
    }
  }
}

export function applyFixturePatch<T extends JsonObject>(
  base: T,
  patch: E2EFixturePatch,
  expectedTarget?: FixturePatchTarget,
): T {
  if (expectedTarget && patch.$target !== expectedTarget) {
    throw new Error(`Fixture patch target mismatch: expected ${expectedTarget}, got ${patch.$target}`)
  }

  const output = cloneJson(base)
  applyDelete(output, patch.$delete)
  if (patch.$merge) deepMerge(output, patch.$merge)
  applyAppend(output, patch.$append)
  return output as T
}

export function applyFixturePatches<T extends JsonObject>(
  base: T,
  patches: E2EFixturePatch[],
  expectedTarget?: FixturePatchTarget,
): T {
  return patches.reduce((current, patch) => applyFixturePatch(current, patch, expectedTarget), cloneJson(base))
}

async function setLanguage(page: Page, locale: 'zh-CN' | 'en'): Promise<void> {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(locale)
}

export async function loadDbFixtureWithPatches(
  page: Page,
  options: LoadDbFixtureWithPatchesOptions,
): Promise<JsonObject> {
  const patched = applyFixturePatches(options.base, options.patches, 'db.json')
  delete patched.vsn

  await page.goto(options.url ?? '/')
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, patched)

  await page.reload()
  await setLanguage(page, options.locale ?? 'zh-CN')
  return patched
}
