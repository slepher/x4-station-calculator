# User Save Map Store POI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize save-archive POI category derivation in `useSaveStore` so the save detail panel and map workbench consume the same grouped, counted, and flattened data.

**Architecture:** Move the five-tab filtering rules out of `SaveDetailPanel.vue` into `useSaveStore.ts` as shared derived helpers and computed state. Keep archive loading in the store, then refactor both the save detail panel and map save UI to read those store-derived structures instead of recalculating from raw `archive.sectors`.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest

---

### Task 1: Lock the shared POI derivation contract with a failing store test

**Files:**
- Create: `tests/unit/user-save-map/save-poi-derivation.spec.ts`
- Modify: `src/store/useSaveStore.ts`

**Step 1: Write the failing test**

Cover one archive with:
- player station
- npc HQ station
- npc non-HQ station
- abandoned ship
- datavault
- erlking vault

Assert:
- player station category includes only `owner === 'player'`
- npc station category matches current detail page logic: `owner !== 'player' && is_headquarter === true`
- abandoned ships/datavaults/erlking vaults pass through directly
- counts are correct
- grouped sector output excludes empty sectors

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/user-save-map/save-poi-derivation.spec.ts`

Expected: FAIL because the shared derivation API does not exist yet.

**Step 3: Write minimal implementation**

Add the store-level types/helpers/computed APIs needed by the test.

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/user-save-map/save-poi-derivation.spec.ts`

Expected: PASS

### Task 2: Move save detail panel to shared store-derived category data

**Files:**
- Modify: `src/components/save/SaveDetailPanel.vue`
- Modify: `src/store/useSaveStore.ts`
- Test: `tests/unit/user-save-map/save-poi-derivation.spec.ts`

**Step 1: Refactor panel to consume store data**

Replace local `groupBySector()` and per-tab computed filters with store-derived category/group/count accessors keyed by the same five tab ids.

**Step 2: Verify the panel still matches current behavior**

Ensure:
- same tab keys
- same filtering rules
- same empty-state behavior
- same rendering fields per tab

**Step 3: Re-run targeted test**

Run: `npm run test:unit -- tests/unit/user-save-map/save-poi-derivation.spec.ts`

Expected: PASS

### Task 3: Switch map save UI to the shared store-derived category data

**Files:**
- Modify: `src/components/empire/MapSaveCategoryMenu.vue`
- Modify: `src/components/empire/MapSaveCoordList.vue`
- Modify: `src/components/empire/MapSaveArchiveList.vue`
- Modify: `src/components/empire/MapSavePanel.vue`
- Modify: `src/components/empire/MapWorkbenchView.vue`
- Modify: `src/store/useSaveStore.ts`

**Step 1: Route archive selection through the store**

Make map archive selection use `saveStore.selectArchive(guid, time)` so the selected archive always has full `sectors` data loaded.

**Step 2: Use shared category counts and grouped POI lists**

Map category menu should read counts from the store-derived category data.

Map coordinate list should read grouped items from the same store-derived category data.

**Step 3: Use shared flattened POI list for overlays**

Build map overlay items from the store-derived flattened category data so map markers align exactly with the detail panel filters.

### Task 4: Validate integration and update change tracking

**Files:**
- Modify: `openspec/changes/user-save-map/tasks.md`

**Step 1: Run targeted test**

Run: `npm run test:unit -- tests/unit/user-save-map/save-poi-derivation.spec.ts`

Expected: PASS

**Step 2: Run build**

Run: `npm run build`

Expected: PASS

**Step 3: Update task tracking**

If the change introduces follow-up implementation work beyond the current checked tasks, sync `openspec/changes/user-save-map/tasks.md` minimally.
