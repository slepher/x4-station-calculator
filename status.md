# Station Binding Feature - Project Status

## Overview
Implementation of the station-binding feature for X4 Station Calculator, allowing users to bind save sectors to empire sectors with coverage range configuration.

## Current Status

### Completed Features

#### 1. Component Architecture
- Split into 3 Vue components:
  - `MapBindingSelectArchive.vue` - Stage 1: Archive selection
  - `MapBindingSectorGroup.vue` - Stage 2: Sector group management
  - `MapBindingStation.vue` - Stage 3: Station binding

#### 2. Data Model
- Unified `BindingDraftState` interface:
  ```typescript
  interface BindingDraftState {
    sectorGroupId: string | null      // Empire sector being edited
    anchorSectorMacro: string | null  // Save sector (anchor)
    jumpRange: number                 // Coverage jump range
    coverage: string[]                // Covered sectors
    excluded: string[]                // Excluded sectors
  }
  ```
- Draft data isolated from store data
- Store only updated on confirm, not during editing

#### 3. UI Features
- **Anchor Sector Display**: Shows bound save sector name
- **Jump Range Control**: 0-5 jumps, extracted to reusable `JumpInput` component
- **Coverage by Jump**: Sectors grouped by jump distance (1跳, 2跳, etc.)
- **Candidate Sectors**: Sectors within range but not in coverage
- **Orange Pills**: Sectors bound to other groups (shown in candidates, not clickable)
- **Menu Highlight**: Current selection highlighted in bind menu

#### 4. Interaction Flow
1. Click "绑定" button → Open bind menu
2. Select save sector from menu → Enter edit mode
3. Adjust jump range → Coverage updates incrementally
4. Click "确认" → Save to store
5. Click "取消" → Discard changes, close edit

#### 5. Key Behaviors
- **Single Edit State**: Only one sector can be edited at a time
- **Jump Inheritance**: Reselecting same anchor preserves previous jump range
- **Incremental Updates**: 
  - Increase jump: Add new sectors only
  - Decrease jump: Remove out-of-range sectors
- **Auto-cancel**: Switching to another sector auto-cancels current edit

### Known Issues

1. **Jump Change Detection**: When initializing edit mode, `updateDraftJumpRange` may receive duplicate calls with same value (3->3), causing "jump unchanged" log. This is a timing issue between `onMenuSectorClick` and `JumpInput` component.

2. **Coverage Update on Init**: When opening edit for already-bound sector, coverage sectors may not display correctly until jump range is manually changed.

### Files Modified

#### Core Components
- `src/components/map/MapBindingPanel.vue` - Main panel orchestration
- `src/components/map/MapBindingSelectArchive.vue` - Archive selection
- `src/components/map/MapBindingSectorGroup.vue` - Sector group management (major refactoring)
- `src/components/map/MapBindingStation.vue` - Station binding
- `src/components/common/JumpInput.vue` - New reusable jump input component

#### Store & Utils
- `src/store/logic/saveBindingUtils.ts` - Coverage calculation utilities
- `src/store/useEmpireStore.ts` - Empire data management

#### Localization
- `src/locales/zh-CN.json` - Chinese translations
- `src/locales/en.json` - English translations

#### Types
- `src/types/x4.ts` - SaveBinding, GroupSaveBinding types
- `src/types/saveArchive.ts` - SaveArchive, PlayerStationEntry types

### Recent Commits

```
e4d94c0 fix: updateDraftJumpRange adds only new sectors when increasing jump
adb7823 fix: updateDraftJumpRange uses draft.anchorSectorMacro
6aad2ce fix: use draft.anchorSectorMacro for coverage/candidate calculation
38018b7 fix: use draft.anchorSectorMacro in config UI
5438ead refactor: consolidate draft state into unified BindingDraftState
71d9395 fix: use draft data when displaying expanded sector
5f51f8b refactor: isolate draft editing from store data
2e44027 feat: enforce single edit state and inherit jump range
be69fe2 feat: add orange pill for other group sectors
04ffbe7 feat: redesign binding config UI with jump-based grouping
```

### Next Steps

1. Fix jump change detection timing issue (3->3 on init)
2. Ensure coverage displays correctly when opening existing binding
3. Add comprehensive tests for edge cases
4. Consider performance optimization for large sector counts

### Architecture Notes

#### Data Flow
```
User Action → Draft State → (Confirm) → Store → localStorage
                ↑                           ↓
           JumpInput                     Display
         (triggers update)              (reads from draft)
```

#### Key Design Decisions
1. **Draft Isolation**: Edit operations only modify draft, not store
2. **Incremental Updates**: Jump range changes only add/remove affected sectors
3. **Orange Pills**: Other group's sectors shown but disabled in candidates
4. **Single Edit**: Prevents multiple concurrent edits for data consistency
