- Task: T009
- Contract revision: 1
- Result: T009-A2.md
- Candidate snapshot: HEAD `8b5894bc85a7de3d608efa8db74357d942764519` plus generation-7 planning tree and T009 locator candidate; two owned tooltip specs with scoped tooltip container locators; no source/Unit/helper/fixture/config changes
- Verdict: passed

## Findings

No actionable findings.

## Acceptance

The candidate changes exactly three existing tooltip locators: favorite-tooltip checks are scoped by `.priority-tooltip-container`, and the side lock-tooltip check is scoped by `.lock-tooltip-container`. The input setup, hover/click/mouse-leave actions, and assertions are unchanged, so the repair is minimal and does not weaken the tested behavior.

Across the two owned specs, the fixed English fixture path covers the two-row production branch and one-row consumption-only branch; label, hours, description, active selection, click result, 80px/70px minimum widths, nowrap, left/right placement, click persistence, hidden-on-leave, and non-switchable behavior remain asserted. `No Demand` and `Res` remain separate label and description assertions.

The retained focused run records 8 passed, 0 failed, and 0 skipped through `.last-run.json` and eight per-test trace archives. Every trace embeds the current content of its owned spec, and the traces show port `23209` and the scoped locators used by the affected tests. `git diff --check` is clean. The candidate diff is confined to the two T009-owned specs; no source, fixture, helper, Unit, locale, style, or config change is attributable to this candidate.

## Explanation

T009-A2 corrects only the ambiguous DOM relationship that caused generic Tippy selection to match unrelated mounted tooltip instances. The existing stable product expectations and interaction coverage are preserved, and the focused browser evidence validates the corrected candidate. Other dirty working-tree test files belong to parallel tasks and were outside this review. Final canonical E2E remains T010 scope.
