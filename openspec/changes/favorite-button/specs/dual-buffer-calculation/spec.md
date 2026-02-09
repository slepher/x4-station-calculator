## ADDED Requirements

### Requirement: Buffer time configuration
The system SHALL support configurable buffer hours for primary and secondary products through StationSettings.

#### Scenario: Default buffer values
- **WHEN** StationSettings is initialized
- **THEN** primaryProductBufferHours SHALL default to 12.0
- **AND** secondaryProductBufferHours SHALL default to 2.0

#### Scenario: Custom buffer configuration
- **WHEN** user adjusts buffer sliders in settings
- **THEN** the system SHALL update the respective buffer hours value
- **AND** recalculate ware flow analysis

### Requirement: Priority-based buffer calculation
The system SHALL calculate buffer volume based on ware priority level: Level 2 uses primary buffer, Level 1 uses secondary buffer, Level 0 uses zero buffer.

#### Scenario: Primary product buffer
- **WHEN** a ware has priority level 2 AND netRate > 0
- **THEN** bufferVolume SHALL equal netRate * primaryProductBufferHours * unitVolume

#### Scenario: Secondary product buffer
- **WHEN** a ware has priority level 1 AND netRate > 0
- **THEN** bufferVolume SHALL equal netRate * secondaryProductBufferHours * unitVolume

#### Scenario: No buffer for level 0
- **WHEN** a ware has priority level 0
- **THEN** bufferVolume SHALL be 0 regardless of netRate

### Requirement: Total occupied volume calculation
The system SHALL calculate totalOccupiedVolume as the sum of consumption volume and priority-based buffer volume.

#### Scenario: Calculate total occupied volume
- **WHEN** analyzing ware flow
- **THEN** totalOccupiedVolume SHALL equal (totalOccupiedConsumptionCount * unitVolume) + bufferVolume

#### Scenario: Negative net rate handling
- **WHEN** a ware has netRate <= 0
- **THEN** bufferVolume SHALL be 0
- **AND** totalOccupiedVolume SHALL only include consumption volume
