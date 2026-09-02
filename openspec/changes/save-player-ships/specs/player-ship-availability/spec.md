## Purpose

Define a reusable domain classification for player ships so later planning can distinguish ships already committed to assignments or economic work from ships that are immediately usable, reclaimable after a wait-only command, or unsafe to classify.

## ADDED Requirements

### Requirement: Assignment and activity are independent classifications
The system SHALL derive assignment and activity as separate facts. Assignment SHALL distinguish station, ship, none, and unknown; activity SHALL distinguish economic, repeat, wait-only, idle, and unknown without using physical docking as a prerequisite.

#### Scenario: Station assignment and trade activity are both retained
- **WHEN** a ship is assigned to a station and has a station trade routine
- **THEN** the derived state reports both station assignment and economic activity

#### Scenario: Sector location does not imply activity
- **WHEN** an unassigned ship is located in a station's sector but has no economic or queued command
- **THEN** its activity is derived from its orders rather than from proximity or docking

### Requirement: Assigned and economic ships are unavailable
The system SHALL classify a ship as unavailable when it has a valid station or ship commander assignment, an explicit economic default or queued order, or an explicitly confirmed repeat-order behavior.

#### Scenario: Station trader is unavailable
- **WHEN** a ship has a valid station commander assignment with a trade, mining, salvage, defence, build-storage trade, or equivalent role
- **THEN** the ship is unavailable regardless of its current physical position

#### Scenario: Unassigned automatic trader is unavailable
- **WHEN** an unassigned ship has an explicit trade, mining, or salvage routine
- **THEN** the ship is unavailable

#### Scenario: Confirmed repeat orders are unavailable
- **WHEN** the archived order facts explicitly confirm repeat-order behavior
- **THEN** the ship is unavailable

### Requirement: Idle and wait-only ships remain distinguishable
The system SHALL classify an unassigned ship with default `Wait` and no non-default commands as immediately available. It SHALL classify an unassigned ship whose non-default commands contain only non-economic wait-like navigation, such as dock-and-wait or fly-and-wait, as reclaimable.

#### Scenario: Default hold-position ship is immediately available
- **WHEN** an unassigned ship has default `Wait` and no active or queued non-default orders
- **THEN** the ship is immediately available

#### Scenario: Dock-and-wait ship is reclaimable
- **WHEN** an unassigned ship has only dock-and-wait commands and no trade command
- **THEN** the ship is reclaimable

#### Scenario: Fly-and-wait ship is reclaimable
- **WHEN** an unassigned ship has only fly-and-wait commands and no trade command
- **THEN** the ship is reclaimable

### Requirement: Ambiguous facts do not produce a free-ship claim
The system SHALL classify a ship as unknown when assignment references cannot be resolved, order facts are incomplete, or an unrecognized order could represent committed work. It SHALL NOT infer availability merely because no recognized economic order was found.

#### Scenario: Broken commander reference remains unknown
- **WHEN** a ship has an unresolved commander reference
- **THEN** its availability is unknown

#### Scenario: Unrecognized active order remains unknown
- **WHEN** an unassigned ship has an active order that is neither a known economic order nor a known wait-only order
- **THEN** its availability is unknown

### Requirement: Candidate filtering can use sector and ship class
The derived player ship state SHALL retain current sector and ship class so downstream consumers can filter candidates by sector and size without requiring the ship to be docked at a station.

#### Scenario: L transport in the same sector remains a candidate
- **WHEN** an available L-class transport is in the requested sector but is not physically docked at the target station
- **THEN** sector-based candidate filtering can include it

