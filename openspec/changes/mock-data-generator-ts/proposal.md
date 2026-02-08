## Why

Currently, the X4 Station Calculator lacks an effective mock data generator that can produce realistic test data based on the existing UI logic. We need a TypeScript-based mock data generator that leverages the same logic as the actual UI components to create consistent and realistic test data for development and testing purposes.

## What Changes

- Create a TypeScript-based mock data generator that replicates the logic from existing UI components
- Generate industryModules, supplyModules, wareFlows, stationWorkforce, and stationConstructions using the same algorithms as StationModuleList, StationWareFlowDashboard, StationWorkforce, and StationConstruction components
- Integrate with the existing mock_modules configuration in x4-station-calculator.config.json
- Generate mock data for each group of modules defined in the configuration

## Capabilities

### New Capabilities
- `mock-data-generator`: A TypeScript-based mock data generator that uses the same business logic as the UI components to create realistic test data

### Modified Capabilities
- None

## Impact

- New mock data generation utility in the project
- Enhanced testing capabilities with realistic data sets
- Improved development workflow with consistent mock data
- Utilizes the same logic as the actual UI components for consistency