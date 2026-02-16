## ADDED Requirements

### Requirement: Drag Test Page Component
The system SHALL provide an isolated drag test page component with two draggable zones for testing purposes.

#### Scenario: Component renders with two zones
- **WHEN** the drag test page is mounted
- **THEN** it SHALL display Zone A and Zone B, each containing draggable items

#### Scenario: Zone A contains initial items
- **WHEN** the drag test page is mounted
- **THEN** Zone A SHALL contain at least 3 draggable items with unique IDs

#### Scenario: Zone B starts empty
- **WHEN** the drag test page is mounted
- **THEN** Zone B SHALL be empty and ready to receive items

### Requirement: Drag Event Recording
The system SHALL record all drag events in the test store for verification.

#### Scenario: Record drag start event
- **WHEN** a drag operation starts
- **THEN** the system SHALL record a "dragstart" event with the item ID

#### Scenario: Record drag add event
- **WHEN** an item is added to a zone
- **THEN** the system SHALL record an "add" event with the item ID and target zone

#### Scenario: Record drag end event
- **WHEN** a drag operation ends
- **THEN** the system SHALL record a "dragend" event

### Requirement: Store State Management
The system SHALL maintain item positions in the test store and update them on successful drag operations.

#### Scenario: Move item from Zone A to Zone B
- **WHEN** an item is dragged from Zone A to Zone B
- **THEN** the item's zone property SHALL be updated from "A" to "B"

#### Scenario: Item removed from source zone
- **WHEN** an item is successfully moved to another zone
- **THEN** the item SHALL be removed from the source zone's item list

#### Scenario: Item added to target zone
- **WHEN** an item is successfully dropped in a target zone
- **THEN** the item SHALL be added to the target zone's item list

### Requirement: Hover State Detection
The system SHALL detect and record hover state during drag operations.

#### Scenario: Record hover enter
- **WHEN** a dragged item enters a drop zone
- **THEN** the system SHALL record a "dragenter" event with the zone ID

#### Scenario: Record hover leave
- **WHEN** a dragged item leaves a drop zone without dropping
- **THEN** the system SHALL record a "dragleave" event with the zone ID

#### Scenario: Visual feedback on hover
- **WHEN** a dragged item hovers over a valid drop zone
- **THEN** the drop zone SHALL display a visual indicator (e.g., highlighted border)

### Requirement: Drop Status Classification
The system SHALL support multiple drop status types to simulate real-world drag scenarios.

#### Scenario: Normal drop status
- **WHEN** dragging an item to a zone that does not contain the item
- **THEN** the zone SHALL display "Normal" status (blue border)

#### Scenario: Duplicated drop status
- **WHEN** dragging an item to a zone that already contains the same item
- **THEN** the zone SHALL display "Duplicated" status (red border) and reject the drop

#### Scenario: Auto node promotion
- **WHEN** dragging an item to a zone that has an auto-generated placeholder of the same item
- **THEN** the zone SHALL display "Auto" status initially, then "Manual" when entering the grid area

#### Scenario: Isolated node connection
- **WHEN** dragging an item to a zone that has an isolated placeholder of the same item
- **THEN** the zone SHALL display "Isolate" status initially, then "Connect" when entering the grid area

#### Scenario: Locked group with matching lineage
- **WHEN** dragging an item to a locked zone where the item's lineage matches
- **THEN** the zone SHALL display "Locked" status (amber border) but allow the drop

#### Scenario: Locked group with rejected lineage
- **WHEN** dragging an item to a locked zone where the item's lineage does not match
- **THEN** the zone SHALL display "Rejected" status (red border with 🚫) and reject the drop

### Requirement: Hover and Rollback Behavior
The system SHALL support hover state changes and rollback when drag is cancelled.

#### Scenario: Hover over zone then drag out
- **WHEN** dragging an item into a zone (hover state active)
- **AND** then moving the item out of the zone without dropping
- **THEN** the zone SHALL revert to its original state
- **AND** the item SHALL remain in its original zone

#### Scenario: Cancel drag operation
- **WHEN** dragging an item and pressing Escape key
- **THEN** the item SHALL return to its original position
- **AND** all hover states SHALL be cleared

### Requirement: Test Helper Methods
The system SHALL expose helper methods for E2E testing via window object.

#### Scenario: Expose store for testing
- **WHEN** the page is loaded with test mode enabled
- **THEN** the drag test store SHALL be accessible via `window.dragTestStore`

#### Scenario: Expose event history
- **WHEN** the test queries event history
- **THEN** the store SHALL provide a method to retrieve all recorded events

#### Scenario: Reset state for testing
- **WHEN** a test needs to reset the state
- **THEN** the store SHALL provide a method to clear all items and events

### Requirement: Event Sequence Verification
The system SHALL emit events in a predictable sequence for testing verification.

#### Scenario: Successful drop event sequence
- **WHEN** an item is successfully dragged from Zone A to Zone B
- **THEN** the event sequence SHALL be: `dragstart` → `dragenter` → `dragover` → `drop` → `dragend`

#### Scenario: Cancelled drag event sequence
- **WHEN** an item is dragged but cancelled (Escape key or dropped outside)
- **THEN** the event sequence SHALL be: `dragstart` → `dragend` (no drop event)

#### Scenario: Hover and leave event sequence
- **WHEN** an item is dragged into a zone and then moved out
- **THEN** the event sequence SHALL be: `dragstart` → `dragenter` → `dragleave` → `dragend`
