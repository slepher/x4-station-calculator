export type SmartSaveIntent = 'NEW' | 'SAVE_AS'
export type SmartSaveStoreType = 'station' | 'logicFlow' | 'ship-build'

export type SmartSaveStep =
  | { type: 'SAVE' }
  | { type: 'SAVE_AS'; name: string }
  | { type: 'NEW' }

export type SmartSavePlanInput = {
  intent: SmartSaveIntent
  showInput: boolean
  inputName: string
}

export type SmartSavePlanResult =
  | { ok: true; steps: SmartSaveStep[] }
  | { ok: false; reason: 'EMPTY_NAME' }

export function requiresNonEmptyName(input: SmartSavePlanInput): boolean {
  if (input.intent === 'SAVE_AS') return true
  if (input.intent === 'NEW' && input.showInput) return true
  return false
}

export function buildSmartSavePlan(input: SmartSavePlanInput): SmartSavePlanResult {
  const trimmedName = input.inputName.trim()
  const needName = requiresNonEmptyName(input)
  if (needName && !trimmedName) {
    return { ok: false, reason: 'EMPTY_NAME' }
  }

  if (input.intent === 'SAVE_AS') {
    return {
      ok: true,
      steps: [{ type: 'SAVE_AS', name: trimmedName }]
    }
  }

  if (input.showInput) {
    return {
      ok: true,
      steps: [{ type: 'SAVE_AS', name: trimmedName }, { type: 'NEW' }]
    }
  }

  return {
    ok: true,
    steps: [{ type: 'SAVE' }, { type: 'NEW' }]
  }
}

