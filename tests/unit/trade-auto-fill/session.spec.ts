import { describe, expect, it } from 'vitest'
import { useNpcTradeStore } from '@/store/useNpcTradeStore'
import type { TradeReady } from '@/store/logic/tradeAutoFill'

const result = (qty = 100): TradeReady => ({ status: 'ready', targets: qty === 0 ? [] : [{ wareId: 'energycells', targetQty: 20 }, { wareId: 'hullparts', targetQty: qty }], accounts: [], stations: [] })
const session = () => { const s = useNpcTradeStore(); s.setBindingGameGuid('g'); s.observeContext('a'); return s }
const fill = (s: ReturnType<typeof session>, r = result()) => { s.requestFill('a', 'button'); return s.applyFill(s.pendingFill!.id, 'a', r) }

describe('trade fill session', () => {
  it('defaults off and preserves same binding session but resets when binding changes', () => {
    const s = session(); expect(s.autoFillEnabled).toBe(false)
    s.setAutoFillEnabled(true); fill(s); s.setBindingGameGuid('g')
    expect(s.autoFillEnabled).toBe(true); expect(s.lastFill).not.toBeNull()
    s.setBindingGameGuid('new')
    expect(s.autoFillEnabled).toBe(false); expect(s.lastFill).toBeNull(); expect(s.fillUndo).toBeNull(); expect(s.pendingFill).toBeNull()
    expect(s.targets).toHaveLength(2)
  })
  it('atomically replaces without accumulating and preserves valid primary and sorting', () => {
    const s = session(); s.addWare('hullparts'); s.rankMode = 'composite'; s.sortMetric = 'targetTotal'
    expect(fill(s)).toBe(true); expect(s.primaryWareId).toBe('hullparts')
    fill(s, result(200)); expect(s.targets).toHaveLength(2); expect(s.targets[1]!.targetQty).toBe(200)
    expect([s.rankMode, s.sortMetric]).toEqual(['composite', 'targetTotal'])
    fill(s, { ...result(), targets: [{ wareId: 'energycells', targetQty: 20 }] }); expect(s.primaryWareId).toBe('energycells')
    fill(s, result(0)); expect(s.targets).toEqual([]); expect(s.primaryWareId).toBeNull()
  })
  it('undo restores targets, primary and attribution once and leaves the checkbox enabled', () => {
    const s = session(); s.setAutoFillEnabled(true); s.addWare('input'); s.updateTargetQty('input', 3)
    fill(s); s.undoFill('a')
    expect(s.targets).toEqual([{ wareId: 'input', targetQty: 3 }]); expect(s.primaryWareId).toBe('input'); expect(s.lastFill).toBeNull()
    expect(s.autoFillEnabled).toBe(true); expect(s.fillUndo).toBeNull(); s.undoFill('a'); expect(s.targets[0]!.wareId).toBe('input')
  })
  it('manual deletes, edits and adds persist and invalidate undo without disabling automatic mode', () => {
    const s = session(); s.setAutoFillEnabled(true); fill(s)
    s.removeWare('hullparts'); s.updateTargetQty('energycells', 7); s.addWare('input'); s.updateTargetQty('input', 0)
    expect(s.targets).toEqual([{ wareId: 'energycells', targetQty: 7 }, { wareId: 'input', targetQty: null }])
    expect(s.autoFillEnabled).toBe(true); expect(s.lastFill!.adjusted).toBe(true); expect(s.pendingFill).toBeNull(); expect(s.fillUndo).toBeNull()
  })
  it('discards a result when a newer action, edit, context or binding has superseded its request', () => {
    const s = session(); s.requestFill('a', 'button'); const old = s.pendingFill!.id
    s.requestFill('a', 'button'); expect(s.applyFill(old, 'a', result())).toBe(false)
    const request = s.pendingFill!.id; s.addWare('input'); expect(s.applyFill(request, 'a', result())).toBe(false)
    s.requestFill('a', 'button'); const switchRequest = s.pendingFill!.id; s.observeContext('b'); expect(s.applyFill(switchRequest, 'a', result())).toBe(false)
    expect(s.targets).toEqual([{ wareId: 'input', targetQty: null }]); expect(s.fillUndo).toBeNull()
  })
  it('deduplicates automatic context observation while a button always creates a new action', () => {
    const s = session(); s.setAutoFillEnabled(true); const id = s.pendingFill!.id
    s.observeContext('a'); expect(s.pendingFill!.id).toBe(id)
    s.requestFill('a', 'button'); expect(s.pendingFill!.id).toBeGreaterThan(id)
    s.setAutoFillEnabled(false); expect(s.pendingFill!.source).toBe('button')
    s.setAutoFillEnabled(true); s.setAutoFillEnabled(false); expect(s.pendingFill).toBeNull()
  })
  it('retains targets on unavailable results and invalidates undo permanently across a context round trip', () => {
    const s = session(); fill(s); s.requestFill('a', 'button')
    s.rejectFill(s.pendingFill!.id, 'a', { status: 'unavailable', reason: 'loading' })
    expect(s.targets).toHaveLength(2); expect(s.fillFailure!.result.reason).toBe('loading')
    s.observeContext('b'); s.observeContext('a'); s.undoFill('a'); expect(s.targets).toHaveLength(2); expect(s.fillUndo).toBeNull()
  })
})
