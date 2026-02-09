## 1. Type Definitions and Store State

- [ ] 1.1 Update StationSettings interface - add primaryProductBufferHours and secondaryProductBufferHours with defaults
- [ ] 1.2 Add warePriorityOverrides ref to useStationStore
- [ ] 1.3 Add persistence logic for warePriorityOverrides to LocalStorage

## 2. Priority Logic Implementation

- [ ] 2.1 Implement isPlanned detection - check if ware exists in plannedModules outputs
- [ ] 2.2 Implement isAuto detection - check if ware only exists in autoIndustryModules outputs
- [ ] 2.3 Implement getResolvedLevel function with auto-correction logic
- [ ] 2.4 Implement toggleWarePriority action with identity-based state transitions

## 3. Buffer Calculation Updates

- [ ] 3.1 Modify analyzeWareFlow to accept priority level parameter
- [ ] 3.2 Update buffer volume calculation based on priority level
- [ ] 3.3 Update totalOccupiedVolume calculation to include priority-based buffer

## 4. UI Components

- [ ] 4.1 Create FavoriteButton.vue component with three-state SVG icons
- [ ] 4.2 Add FavoriteButton to StationWareFlow.vue action rail
- [ ] 4.3 Update StationWareFlow.vue action rail width from w-10 to w-20
- [ ] 4.4 Update StationWareFlowGroup.vue header placeholder width to w-20

## 5. Settings Panel

- [ ] 5.1 Add primaryProductBufferHours slider to StationSettings.vue
- [ ] 5.2 Add secondaryProductBufferHours slider to StationSettings.vue
- [ ] 5.3 Add i18n keys for buffer settings labels

## 6. Testing and Verification

- [ ] 6.1 Run unit tests for priority logic
- [ ] 6.2 Run unit tests for buffer calculation
- [ ] 6.3 Verify FavoriteButton renders correctly in all three states
- [ ] 6.4 Verify buffer settings persist and apply correctly
