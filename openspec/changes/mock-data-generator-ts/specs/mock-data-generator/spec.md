## ADDED Requirements

### Requirement: Mock Data Generator Core Functionality
The system SHALL provide a TypeScript-based mock data generator that replicates the logic of the UI components to create realistic test data.

#### Scenario: Generate Industry Modules
- **WHEN** the mock data generator is called with module configurations
- **THEN** it SHALL generate industryModules data using the same logic as StationModuleList component
- **AND** the data SHALL include planned and auto-industry modules

#### Scenario: Generate Supply Modules
- **WHEN** the mock data generator is called with module configurations
- **THEN** it SHALL generate supplyModules data using the same logic as StationModuleList component
- **AND** the data SHALL include auto-supply modules

#### Scenario: Generate Ware Flows
- **WHEN** the mock data generator is called with module configurations
- **THEN** it SHALL generate wareFlows data using the same logic as StationWareFlowDashboard component
- **AND** the data SHALL include production and consumption flows between modules

#### Scenario: Generate Workforce Data
- **WHEN** the mock data generator is called with module configurations
- **THEN** it SHALL generate stationWorkforce data using the same logic as StationWorkforce component
- **AND** the data SHALL include workforce breakdown by module type

#### Scenario: Generate Construction Data
- **WHEN** the mock data generator is called with module configurations
- **THEN** it SHALL generate stationConstructions data using the same logic as StationConstruction component
- **AND** the data SHALL include module build costs and materials

### Requirement: Configuration Integration
The system SHALL read mock module configurations from x4-station-calculator.config.json to drive the data generation process.

#### Scenario: Read Mock Modules Configuration
- **WHEN** the mock data generator starts
- **THEN** it SHALL read the mock_modules array from x4-station-calculator.config.json
- **AND** it SHALL process each group of modules defined in the configuration

#### Scenario: Process Multiple Module Groups
- **WHEN** the mock_modules array contains multiple groups
- **THEN** the system SHALL generate separate mock data sets for each group
- **AND** each group SHALL be processed independently

### Requirement: Data Consistency
The system SHALL ensure that generated mock data is consistent with the actual UI component logic.

#### Scenario: Consistent Module Relationships
- **WHEN** generating mock data
- **THEN** the relationships between modules SHALL match those calculated by the UI components
- **AND** the data structures SHALL match the types defined in the application

#### Scenario: Consistent Calculation Logic
- **WHEN** performing calculations for mock data
- **THEN** the same formulas and business rules SHALL be used as in the UI components
- **AND** the resulting values SHALL be consistent with real application behavior