# Default Ship Blueprint Presets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four non-persistent default ship presets (空配/低配/中配/高配) to ship blueprint load flow, with deterministic auto-fit rules and immediate dirty state after loading.

**Architecture:** Keep preset generation and rule logic inside `useShipBuildStore` so UI remains thin. Expose a loadable blueprint list API that merges virtual presets with persisted blueprints. Loading a preset creates editable in-memory blueprint, does not persist, and sets unsaved state baseline.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Playwright

---

### Task 1: Add failing unit tests for preset behavior

**Files:**
- Modify: `tests/unit/ship-build-storage/ship-build-storage.spec.ts`

**Step 1: Write failing tests**
- Add tests for:
  - `getLoadableBlueprintsForShip` returns four preset items for selected ship.
  - preset items are marked non-deletable and non-storage.
  - loading a preset sets `isDirty=true` and remains editable.
  - deleting a preset id has no effect on persisted storage.

**Step 2: Run tests to verify failure**
- Run: `pnpm exec vitest run tests/unit/ship-build-storage/ship-build-storage.spec.ts`
- Expected: FAIL on missing store API / behavior mismatch.

**Step 3: Commit**
```bash
git add tests/unit/ship-build-storage/ship-build-storage.spec.ts
git commit -m "test(ship-build): add failing tests for default blueprint presets"
```

### Task 2: Implement preset generation and loading in store

**Files:**
- Modify: `src/store/useShipBuildStore.ts`
- Modify: `src/types/x4.ts`

**Step 1: Add types for loadable item metadata**
- Add a type for load-modal items that includes `isDefaultPreset` and `deletable` markers while keeping compatibility with existing `ShipBlueprint` rendering.

**Step 2: Implement preset builder helpers**
- Add deterministic selection helpers:
  - race-first fallback,
  - mk preference per preset level,
  - engine class priority by `purposePrimary`,
  - mining turret preference by `slotTags`.
- Add U-slot drone allocation rules for mine/trade cases.

**Step 3: Add public APIs**
- Add `getLoadableBlueprintsForShip(shipId)`.
- Extend `loadBlueprint(id)` to support preset ids and build ephemeral blueprint.
- Guard `deleteBlueprint(id)` against preset ids.

**Step 4: Preserve dirty behavior for preset load**
- After loading preset, ensure active blueprint id is null and dirty baseline marks unsaved state.

**Step 5: Run tests**
- Run: `pnpm exec vitest run tests/unit/ship-build-storage/ship-build-storage.spec.ts`
- Expected: PASS for new tests.

**Step 6: Commit**
```bash
git add src/store/useShipBuildStore.ts src/types/x4.ts
git commit -m "feat(ship-build): add default virtual ship presets"
```

### Task 3: Update load modal to use loadable list

**Files:**
- Modify: `src/components/LoadShipBlueprintModal.vue`

**Step 1: Switch list source**
- Replace `getBlueprintsForShip` with `getLoadableBlueprintsForShip`.

**Step 2: Update delete visibility**
- Hide/disable delete action for preset items.

**Step 3: Keep existing load flow**
- Keep same confirm flow and call `loadBlueprint(id)` for both storage and presets.

**Step 4: Add minimal display fallback**
- Ensure preset rows render valid timestamps/equipment summary without null errors.

**Step 5: Run tests**
- Run unit test suite that covers modal/store interaction as needed.

**Step 6: Commit**
```bash
git add src/components/LoadShipBlueprintModal.vue
git commit -m "feat(ship-ui): show default virtual presets in load modal"
```

### Task 4: Verify with targeted regression tests

**Files:**
- Modify if needed: `tests/e2e/ship-level-blueprint/ship-level-blueprint.spec.ts`

**Step 1: Add/adjust e2e assertion**
- Assert load modal includes four preset names.
- Assert preset rows have no delete button.

**Step 2: Run targeted tests**
- Run:
  - `pnpm exec vitest run tests/unit/ship-build-storage/ship-build-storage.spec.ts`
  - `pnpm exec playwright test tests/e2e/ship-level-blueprint/ship-level-blueprint.spec.ts`

**Step 3: Commit**
```bash
git add tests/e2e/ship-level-blueprint/ship-level-blueprint.spec.ts
git commit -m "test(ship-build): verify default presets in load modal"
```
