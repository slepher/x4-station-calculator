## 1. Setup and Configuration

- [x] 1.1 Create mock data generator TypeScript file
- [x] 1.2 Set up configuration reading from x4-station-calculator.config.json
- [x] 1.3 Define TypeScript interfaces matching the application types

## 2. Core Logic Extraction

- [x] 2.1 Extract industry module generation logic from StationModuleList
- [x] 2.2 Extract supply module generation logic from StationModuleList
- [x] 2.3 Extract ware flow generation logic from StationWareFlowDashboard
- [x] 2.4 Extract workforce calculation logic from StationWorkforce
- [x] 2.5 Extract construction calculation logic from StationConstruction

## 3. Mock Data Generation

- [x] 3.1 Implement function to generate industryModules based on config
- [x] 3.2 Implement function to generate supplyModules based on config
- [x] 3.3 Implement function to generate wareFlows based on module connections
- [x] 3.4 Implement function to generate stationWorkforce based on modules
- [x] 3.5 Implement function to generate stationConstructions based on modules

## 4. Integration and Testing

- [x] 4.1 Create main function to coordinate all data generation
- [x] 4.2 Implement command-line interface for the generator
- [x] 4.3 Test the generator with sample configurations
- [x] 4.4 Verify generated data matches UI component logic