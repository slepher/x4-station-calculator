## ADDED Requirements

### Requirement: Archive player ship facts
The save import SHALL include every component owned by the player whose class is a ship class, organized under its current sector. Each record SHALL preserve the stable component identity, ship code/name when present, macro, class, and cargo facts required by downstream consumers.

#### Scenario: Player ship is stored in its sector
- **WHEN** the imported save contains a player-owned `ship_*` component in a known sector
- **THEN** the archive contains one player ship record under that sector with its identity, macro, class, and cargo facts
- **AND** a real `<cargo ware="missilecomponents" v="281"/>` node is archived as ware `missilecomponents` with amount `281`

#### Scenario: Non-player ship is excluded
- **WHEN** the imported save contains a ship not owned by the player
- **THEN** that ship is not included in the player ship collection

### Requirement: Preserve assignment facts through connection resolution
The save import SHALL resolve commander and subordinate connection facts into an assignment result without treating every commander as a station. The result SHALL distinguish assignment to a station, assignment to another ship, no assignment, and an unresolved reference, and SHALL preserve the assignment role when present.

#### Scenario: Station subordinate is resolved
- **WHEN** a player ship's subordinate group connects to a player station commander and declares an assignment role
- **THEN** the archived ship identifies the station commander and preserves that role

#### Scenario: Fleet subordinate is not classified as station-assigned
- **WHEN** a player ship's commander connection resolves to another ship
- **THEN** the archived ship identifies a ship commander rather than a station commander

#### Scenario: Broken commander reference is retained as unresolved
- **WHEN** assignment facts reference a commander that cannot be resolved in the imported archive
- **THEN** the archived assignment is marked unresolved instead of being reported as unassigned

### Requirement: Preserve default behavior separately from queued commands
The save import SHALL store the default order separately from non-default active and queued orders. Each captured order SHALL preserve its order type and available state, failure, and target-reference facts so downstream logic can classify economic, repeat, and wait-only activity without inferring from display text.

#### Scenario: Default Wait is separated from the queue
- **WHEN** a player ship has a default `Wait` order and no non-default orders
- **THEN** the archive reports `Wait` as the default order and an empty command queue

#### Scenario: Dock and trade commands retain their sequence
- **WHEN** a player ship has non-default dock, wait, or trade orders
- **THEN** the archive preserves those orders in command-queue order independently of the default order

### Requirement: Player ship schema is versioned by the Rust archive parser
Archives containing player ship facts SHALL use Rust archive parser schema version 11. Consumers SHALL reject older archive schema versions as current data while leaving the legacy TypeScript XML parser version and post-process version unchanged.

#### Scenario: Version 11 archive is accepted
- **WHEN** an archive is produced with Rust archive parser schema version 11 and the current post-process version
- **THEN** current-version validation accepts the archive

#### Scenario: Version 10 archive requires re-import
- **WHEN** a stored archive still uses Rust archive parser schema version 10
- **THEN** current-version validation rejects it and requires re-import from the source save
