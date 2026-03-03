# Ship Blueprint Storage Specification

## Purpose

Define requirements for persisting ship build configurations (blueprints) to localStorage.

## ADDED Requirements

### Requirement: Ship Blueprint Data Structure
The system SHALL store ship blueprint data with the following structure:
- `id`: unique identifier
- `name`: user-defined name
- `shipId`: reference to the ship
- `connections`: array of slot type configurations, each containing:
  - `slot_type`: the type of slot (e.g., "engine", "thruster")
  - `group`: array of group configurations, each containing:
    - `group`: the group name from ship slot definition
    - `equipment_id`: the equipped item ID (omitted when unequipped)
    - `count`: the actual equipped count
    - `shield` (optional): shield configuration with equipment_id and count

#### Scenario: Blueprint with equipment
- **WHEN** a user equips items on a ship
- **THEN** the blueprint SHALL contain entries for each equipped group with equipment_id and count

#### Scenario: Blueprint without equipment
- **WHEN** a user removes all equipment from a slot group
- **THEN** the blueprint SHALL NOT contain an entry for that group (equipment_id is omitted, not set to null)

### Requirement: Save Ship Blueprint
The system SHALL allow users to save the current ship build configuration as a named blueprint.

#### Scenario: Save to existing blueprint
- **WHEN** user selects a ship, configures equipment on slots, and clicks Save button
- **AND** an active blueprint exists
- **THEN** the system SHALL update the existing blueprint with current ship ID and equipment connections
- **AND** update the lastUpdated timestamp

#### Scenario: Save as new blueprint
- **WHEN** user clicks Save As button and enters a new blueprint name
- **THEN** the system SHALL create a new blueprint with the entered name
- **AND** set it as the active blueprint
- **AND** save ship ID and equipment connections with counts

### Requirement: Load Ship Blueprint
The system SHALL allow users to load a previously saved blueprint.

#### Scenario: Load blueprint with valid ship
- **WHEN** user clicks Load button and selects a saved blueprint
- **AND** the blueprint's ship ID exists in the game data
- **THEN** the system SHALL automatically set the ship class filter based on the ship's class
- **AND** automatically set the race filter based on the ship's race
- **AND** automatically set the type filter based on the ship's type
- **AND** automatically select the ship
- **AND** restore all equipment connections to the slots with correct counts

#### Scenario: Load blueprint with missing ship
- **WHEN** user clicks Load button and selects a blueprint whose ship ID no longer exists
- **THEN** the system SHALL display an error message indicating the ship is no longer available
- **AND** SHALL NOT modify the current ship selection

### Requirement: Delete Ship Blueprint
The system SHALL allow users to delete a saved blueprint.

#### Scenario: Delete blueprint
- **WHEN** user selects a blueprint and confirms deletion
- **THEN** the system SHALL remove the blueprint from localStorage
- **AND** if the deleted blueprint was active, clear the active blueprint state

### Requirement: New Ship Blueprint (Reset)
The system SHALL allow users to start a fresh ship build configuration.

#### Scenario: Create new blueprint
- **WHEN** user clicks New button while having unsaved changes
- **AND** confirms discarding changes
- **THEN** the system SHALL clear the current blueprint
- **AND** clear the active blueprint state

### Requirement: Modify Equipment via Store Interface
The system SHALL provide store methods to modify equipment, which SHALL automatically sync to the blueprint.

#### Scenario: Set equipment (detailed mode)
- **WHEN** user selects equipment for a single slot group via setEquipment()
- **THEN** the system SHALL update the blueprint with equipment_id and count
- **AND** the selectedByConnection computed property SHALL reflect the change

#### Scenario: Set equipment (group mode)
- **WHEN** user selects equipment for multiple slots in the same group via setGroupEquipment()
- **THEN** the system SHALL update all corresponding slot entries in the blueprint
- **AND** the selectedByConnection computed property SHALL reflect all changes

#### Scenario: Remove equipment
- **WHEN** user removes equipment (equipmentId = null) from a slot group
- **THEN** the system SHALL remove the group entry from the blueprint entirely
- **AND** the selectedByConnection computed property SHALL return null for that slot

#### Scenario: Set shield
- **WHEN** user configures shield via setShield() or setGroupShield()
- **THEN** the system SHALL add or update the shield property in the blueprint group

### Requirement: Dirty State Detection
The system SHALL track whether the current configuration has unsaved changes.

#### Scenario: Detect unsaved changes
- **WHEN** user modifies equipment connections after loading a blueprint
- **THEN** the system SHALL mark the current state as dirty
- **AND** indicate unsaved changes in the UI

#### Scenario: Clear dirty state after save
- **WHEN** user saves the current configuration
- **THEN** the system SHALL clear the dirty state
