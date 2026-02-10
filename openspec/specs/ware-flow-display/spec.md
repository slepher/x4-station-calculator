# Ware Flow Display Specification

## Purpose
Define the UI requirements for displaying ware flow items, including priority indicators and action controls.

## Requirements

### Requirement: Ware flow item display
The system SHALL display ware flow items with priority indication and action controls.

#### Scenario: Display ware flow with priority button
- **WHEN** rendering a ware flow item
- **THEN** the system SHALL display the ware name, net rate, and volume information
- **AND** display a FavoriteButton for operable wares with netRate > 0
- **AND** display a LockButton for all items

#### Scenario: FavoriteButton placement
- **WHEN** rendering action controls
- **THEN** FavoriteButton SHALL appear before LockButton in the action rail
- **AND** both buttons SHALL be horizontally aligned with gap-2 spacing

#### Scenario: Disabled FavoriteButton
- **WHEN** a ware is not operable OR has netRate <= 0
- **THEN** FavoriteButton SHALL be disabled with opacity 0.3
- **AND** SHALL not respond to click events

### Requirement: Action rail layout
The system SHALL provide adequate space for both FavoriteButton and LockButton in the action rail.

#### Scenario: Action rail width
- **WHEN** rendering StationWareFlow
- **THEN** the action rail SHALL have width of w-20 (5rem)
- **AND** use flex row layout with gap-2

#### Scenario: Group header alignment
- **WHEN** rendering StationWareFlowGroup header
- **THEN** the header placeholder SHALL match action rail width of w-20
- **AND** maintain visual alignment with item action rails
