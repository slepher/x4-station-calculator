## ADDED Requirements

### Requirement: Two-step architecture documentation

The documentation SHALL describe the two-step separation architecture:
- Step 1 (x4_map_processor): Map generation and basic resource data
- Step 2 (x4_resource_processor): Resource calculation with yield/respawn

#### Scenario: Developer understands step separation
- **WHEN** developer reads the architecture documentation
- **THEN** they understand which module handles map generation vs resource calculation
- **AND** they understand the data flow between steps

### Requirement: Version bifurcation documentation

The documentation SHALL clearly describe the version-specific processing logic:
- 8.0 version: regions model (legacy_processor)
- 9.0+ version: resourceareas model (modern_processor)
- Version detection via model_detector.py based on major version number

#### Scenario: Developer understands version differences
- **WHEN** developer reads the version bifurcation documentation
- **THEN** they understand which data model applies to which game version
- **AND** they can trace the processing logic for each version

### Requirement: Algorithm documentation

The documentation SHALL include four algorithm specification documents:
- `solid_estimator.md`: Solid resource estimation algorithm
- `gas_estimator.md`: Gas resource estimation algorithm
- `solid_per_block.md`: Per-block solid resource calculation
- `gas_per_block.md`: Per-block gas resource calculation

Each algorithm document SHALL specify:
- Effective space constraints
- Volume calculation formulas
- Falloff calculation methods
- Rating calculation (where applicable)

#### Scenario: Developer can implement algorithm from documentation
- **WHEN** developer reads an algorithm specification document
- **THEN** they can implement the algorithm without referring to source code
- **AND** the implementation produces correct results

### Requirement: Output data structure documentation

The documentation SHALL define the structure of all output JSON files:
- `regionyields.json` (8.0 only)
- `regions.json` (8.0 only)
- `regionyield_definitions.json` (9.0+ only)
- `resourceareas.json` (both versions)
- `maps.json` sector.resources (both versions)

Each structure definition SHALL include:
- Field names and types
- Field descriptions and sources
- Calculation methods for computed fields

#### Scenario: Developer understands output structure
- **WHEN** developer reads the output structure documentation
- **THEN** they understand each field's meaning and source
- **AND** they can correctly parse the JSON files

### Requirement: Field definition consistency

The documentation SHALL use consistent terminology:
- `total_volume_km3`: Geometric volume before clipping
- `volume_km3`: Effective volume after clipping/capping
- `theoretical_reserve`: Estimated resource amount (8.0 estimator stage)
- `reserve`: Precise resource amount (8.0 per-block stage)
- `theoretical_respawn`: Estimated respawn rate (8.0 estimator stage)
- `respawn`: Precise respawn rate (8.0 per-block stage)

#### Scenario: Developer understands field semantics
- **WHEN** developer reads field definitions
- **THEN** they understand the difference between total_* and actual values
- **AND** they apply correct formulas for calculations

### Requirement: Verification methodology documentation

The documentation SHALL describe the verification workflow:
- Running validation scripts (`solid_sum_weights_replay_v2.py`, `gas_sum_weights_replay.py`)
- Comparing game script output with processor output
- Acceptable error thresholds (< 0.01%)
- Incremental verification for single sectors

#### Scenario: Developer can verify implementation
- **WHEN** developer follows the verification methodology
- **THEN** they can validate that the processor output matches game data
- **AND** they can identify and debug discrepancies