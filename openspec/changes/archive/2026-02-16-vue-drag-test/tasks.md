## 1. Setup

- [ ] 1.1 Create `src/components/drag/` directory structure
- [ ] 1.2 Create `src/store/useDragTestStore.ts` with basic state management

## 2. Component Implementation

- [ ] 2.1 Create `DragTestPage.vue` with two draggable zones (Zone A and Zone B)
- [ ] 2.2 Implement vuedraggable integration with event handlers
- [ ] 2.3 Add visual feedback for hover states (border color changes)
- [ ] 2.4 Implement drop status classification (Normal, Duplicated, Auto, Isolate, Locked, Rejected)
- [ ] 2.5 Add test mode exposure via window object

## 3. Store Implementation

- [ ] 3.1 Implement item state management (add, remove, move between zones)
- [ ] 3.2 Implement event recording system (dragstart, dragenter, dragleave, drop, dragend)
- [ ] 3.3 Implement reset functionality for test isolation
- [ ] 3.4 Implement drop status detection logic

## 4. Test Implementation

- [ ] 4.1 Create `tests/e2e/vue-drag-test.spec.ts`
- [ ] 4.2 Implement dispatchEvent-based drag test (Method A)
- [ ] 4.3 Implement mouse API-based drag test (Method B)
- [ ] 4.4 Implement hybrid drag test (Method C)
- [ ] 4.5 Add store state verification tests
- [ ] 4.6 Add event sequence verification tests
- [ ] 4.7 Add hover and rollback behavior tests
- [ ] 4.8 Add drop status classification tests

## 5. Documentation

- [ ] 5.1 Update `openspec/test_experience.md` with successful drag test patterns
