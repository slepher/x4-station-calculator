# Ware Priority Specification

## Purpose
Define the priority levels and resolution logic for wares to determine their importance in the station's production and storage planning.

## Requirements

### Requirement: Priority levels definition
The system SHALL support three priority levels for ware items: Level 0 (No Demand - hollow star), Level 1 (Secondary Product - half-hollow star), and Level 2 (Primary Product - solid star).

#### Scenario: Display priority button for producible ware
- **WHEN** a ware has netRate > 0 and is operable
- **THEN** the system SHALL display a FavoriteButton component

#### Scenario: Priority button states
- **WHEN** priority level is 0
- **THEN** the button SHALL display a hollow star icon

- **WHEN** priority level is 1
- **THEN** the button SHALL display a half-hollow star icon

- **WHEN** priority level is 2
- **THEN** the button SHALL display a solid star icon

### Requirement: Identity detection
The system SHALL determine ware identity based on module configuration: Planned identity when ware exists in plannedModules outputs, Auto identity when ware only exists in autoIndustryModules outputs.

#### Scenario: Detect planned ware
- **WHEN** a ware ID exists in any plannedModules outputs list
- **THEN** the system SHALL identify it as isPlanned = true

#### Scenario: Detect auto ware
- **WHEN** a ware ID only exists in autoIndustryModules outputs and not in plannedModules
- **THEN** the system SHALL identify it as isAuto = true

### Requirement: Priority resolution logic
The system SHALL resolve the final priority level using a three-step cascade: auto-correction first, then manual override lookup, finally default identity-based assignment.

#### Scenario: Auto-correction for planned ware
- **WHEN** a ware is planned AND user override is 0
- **THEN** the system SHALL return level 1 (auto-correct to secondary)

#### Scenario: Auto-correction for auto ware
- **WHEN** a ware is auto AND user override is 2
- **THEN** the system SHALL return level 1 (auto-correct to secondary)

#### Scenario: Manual override takes precedence
- **WHEN** a manual override exists for the ware AND passes auto-correction
- **THEN** the system SHALL return the override value

#### Scenario: Default identity assignment
- **WHEN** no manual override exists AND auto-correction not triggered
- **THEN** planned wares SHALL default to level 2, auto wares SHALL default to level 0

### Requirement: State toggle behavior
The system SHALL implement different toggle behaviors based on ware identity: planned wares toggle between 2 and 1, auto wares toggle between 0 and 1.

#### Scenario: Toggle planned ware
- **WHEN** user clicks FavoriteButton on a planned ware at level 2
- **THEN** the system SHALL set level to 1 and store override

- **WHEN** user clicks FavoriteButton on a planned ware at level 1
- **THEN** the system SHALL set level to 2 and remove override

#### Scenario: Toggle auto ware
- **WHEN** user clicks FavoriteButton on an auto ware at level 0
- **THEN** the system SHALL set level to 1 and store override

- **WHEN** user clicks FavoriteButton on an auto ware at level 1
- **THEN** the system SHALL set level to 0 and remove override

### Requirement: Priority persistence
The system SHALL persist priority overrides to LocalStorage and restore them on application load.

#### Scenario: Save override
- **WHEN** user sets a priority override
- **THEN** the system SHALL save it to LocalStorage immediately

#### Scenario: Load overrides
- **WHEN** application initializes
- **THEN** the system SHALL load priority overrides from LocalStorage
