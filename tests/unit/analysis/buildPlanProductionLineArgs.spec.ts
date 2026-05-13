import { describe, expect, it } from 'vitest'
import {
  parseBuildPlanProductionLineArgs,
  renderBuildPlanProductionLineHelp,
} from '../../../analysis/scripts/build-plan/buildPlanProductionLineArgs'

describe('buildPlanProductionLineArgs', () => {
  it('keeps json disabled by default', () => {
    const parsed = parseBuildPlanProductionLineArgs([])

    expect(parsed.json).toBe(false)
  })

  it('supports both --index=2 and --index 2 forms', () => {
    const equalsForm = parseBuildPlanProductionLineArgs(['--index=2'])
    const splitForm = parseBuildPlanProductionLineArgs(['--index', '2'])

    expect(equalsForm.index).toBe(2)
    expect(splitForm.index).toBe(2)
  })

  it('supports split-form file argument and help aliases', () => {
    const parsed = parseBuildPlanProductionLineArgs(['--file', 'tmp/export.json', '-h'])

    expect(parsed.file).toBe('tmp/export.json')
    expect(parsed.help).toBe(true)
  })

  it('enables json mode only when the flag is explicitly present', () => {
    const jsonFlag = parseBuildPlanProductionLineArgs(['--json'])
    const compactJson = parseBuildPlanProductionLineArgs(['--json=compact'])

    expect(jsonFlag.json).toBe(true)
    expect(compactJson.json).toBe('compact')
  })

  it('renders help text with both supported argument forms', () => {
    const help = renderBuildPlanProductionLineHelp()

    expect(help).toContain('--index <N>')
    expect(help).toContain('--index=<N>')
    expect(help).toContain('--file <path>')
    expect(help).toContain('--help, -h')
  })
})
