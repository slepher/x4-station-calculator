## 1. Data Types

- [x] 1.1 Add `ShipBlueprintGroup` type to `src/types/x4.ts` (group, equipment_id, count, shield)
- [x] 1.2 Add `ShipBlueprintConnection` type to `src/types/x4.ts` (slot_type, group[])
- [x] 1.3 Add `ShipBlueprint` type to `src/types/x4.ts` (id, name, shipId, connections, lastUpdated)
- [x] 1.4 Add `SavedShipBlueprintsState` type to `src/types/x4.ts` (version, activeId, list)
- [x] 1.5 Add `ConnectionValue` type for selectedByConnection view (equipmentId, count)

## 2. Store Implementation - Data Layer

- [x] 2.1 Add `blueprint` ref to useShipBuildStore (ShipBlueprint | null)
- [x] 2.2 Add `savedBlueprints` ref (SavedShipBlueprintsState)
- [x] 2.3 Add `activeBlueprintId` ref (string | null)
- [x] 2.4 Add `lastSavedSnapshot` ref for dirty check
- [x] 2.5 Implement localStorage persistence functions (loadBlueprintsFromStorage, saveBlueprintsToStorage)

## 3. Store Implementation - selectedByConnection Computed

- [x] 3.1 Convert selectedByConnection from ref to computed
- [x] 3.2 Implement blueprint to selectedByConnection conversion logic
- [x] 3.3 Handle slot_type + group lookup from ship data for count values
- [x] 3.4 Handle shield mapping in selectedByConnection

## 4. Store Implementation - Equipment Modification Methods

- [x] 4.1 Implement `setEquipment(slotType, group, equipmentId, count)` method
- [x] 4.2 Implement `setGroupEquipment(slotType, group, equipmentId, count)` method for batch update
- [x] 4.3 Implement `setShield(slotType, group, equipmentId, count)` method
- [x] 4.4 Implement `setGroupShield(slotType, group, equipmentId, count)` method for batch update
- [x] 4.5 Handle equipmentId = null as "remove entry" logic (delete from blueprint, not set null)
- [x] 4.6 Auto-update dirty state after modifications

## 5. Store Implementation - CRUD Operations

- [x] 5.1 Implement `saveBlueprint()` method (update existing active blueprint)
- [x] 5.2 Implement `saveAsBlueprint(name: string)` method (create new blueprint)
- [x] 5.3 Implement `loadBlueprint(id: string)` method:
  - Auto-set selectedClass from ship class
  - Auto-set selectedRaces from ship race
  - Auto-set selectedTypes from ship type
  - Auto-set selectedShipId
  - Restore blueprint to store
- [x] 5.4 Implement `deleteBlueprint(id: string)` method
- [x] 5.5 Implement dirty state tracking with snapshot mechanism
- [x] 5.6 Export `isDirty` computed property
- [x] 5.7 Remove old applyConnectionAssignment and applyGroupAssignment (or refactor to use new methods)

## 6. UI Components

- [x] 6.1 Create `LoadShipBlueprintModal.vue` component:
  - Display list of saved blueprints
  - Show blueprint name, ship ID, lastUpdated
  - Add delete button for each blueprint
  - Support selecting and loading a blueprint
- [x] 6.2 Add i18n keys for LoadShipBlueprintModal (en.json, zh-CN.json)

## 7. ShipBuildView Integration

- [x] 7.1 Update handleNew() to check dirty state in ship-build view
- [x] 7.2 Update handleSave() to call shipBuildStore.saveBlueprint() in ship-build view
- [x] 7.3 Update handleSaveAs() to open SmartSaveDialog in ship-build view
- [x] 7.4 Update handleLoad() to open LoadShipBlueprintModal in ship-build view

## 8. SmartSaveDialog Updates

- [x] 8.1 Extend SmartSaveDialog to support storeType 'ship-build'
- [x] 8.2 Implement save logic for ship-build store type (call saveAsBlueprint)

## 9. View Component Updates

- [x] 9.1 Update ShipBuildFitCandidate.vue binding for selectedByConnection format change (handled by store watch)
- [x] 9.2 Update ShipBuildFitCandidateHangar.vue binding
- [x] 9.3 Update ShipBuildFitCandidateNebula.vue binding
- [x] 9.4 Update ShipBuildFitCandidateTactical.vue binding
- [x] 9.5 Update any other components using selectedByConnection

## 10. Build Validation

- [x] 10.1 Run `npm run build` to verify no compile errors
- [x] 10.2 Fix any build errors if they occur
