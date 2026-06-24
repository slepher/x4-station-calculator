import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import dbFixture from '../../fixtures/db.json' with { type: 'json' }
import validPatch from '../data/fixtures/valid-db.patch.json' with { type: 'json' }
import deletePatch from '../data/fixtures/delete-db.patch.json' with { type: 'json' }
import invalidAppendPatch from '../data/fixtures/invalid-append-db.patch.json' with { type: 'json' }
import { applyFixturePatch, applyFixturePatches, type E2EFixturePatch, type JsonObject } from '../../helper/e2eFixturePatch'

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, '.trae', 'skills', 'x4-e2e-test-doc-details', 'scripts', 'validate_e2e_fixture_patch.py')
const dataDir = path.join(repoRoot, 'tests', 'e2e-skills', 'data', 'fixtures')

describe('x4-e2e-fixtures patch helper and validator', () => {
  it('has required validator and fixture patch data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  it('applies merge and append patches in memory', () => {
    const patched = applyFixturePatch(dbFixture as JsonObject, validPatch as E2EFixturePatch, 'db.json')
    const flow = patched.x4_logic_flow_plans as JsonObject
    const empire = patched.x4_empire_data as JsonObject
    const empires = empire.list as JsonObject[]

    expect(flow.activeId).toBe('fixture-patch-flow')
    expect(empires.some((item) => item.id === 'empire-fixture-patch-alpha')).toBe(true)
  })

  it('applies delete before merge when multiple patches are loaded', () => {
    const patched = applyFixturePatches(dbFixture as JsonObject, [deletePatch as E2EFixturePatch], 'db.json')
    const flow = patched.x4_logic_flow_plans as JsonObject
    expect(patched.vsn).toBeUndefined()
    expect(flow.activeId).toBe('fixture-patch-after-delete')
  })

  it('throws when append target is not an array', () => {
    expect(() => applyFixturePatch(dbFixture as JsonObject, invalidAppendPatch as E2EFixturePatch, 'db.json')).toThrow(/not an array/)
  })

  it('validates patch files against canonical base fixtures', () => {
    const validPath = path.join(dataDir, 'valid-db.patch.json')
    const invalidPath = path.join(dataDir, 'invalid-append-db.patch.json')
    const res = spawnSync('python3', [scriptPath, validPath, invalidPath, '--json'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    })

    const payload = JSON.parse((res.stdout || '{}').trim() || '{}')
    expect(res.status).toBe(1)
    expect(payload.ok).toBe(false)
    expect(payload.results[0].ok).toBe(true)
    expect(payload.results[1].ok).toBe(false)
    expect(payload.results[1].errors[0].error_code).toBe('PATCH_APPLY_FAILED')
  })
})
