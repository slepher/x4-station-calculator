## Context

The X4 Station Calculator currently lacks a robust mock data generator that follows the same business logic as the actual UI components. We need to create a TypeScript-based mock data generator that can generate realistic test data based on the existing UI component logic. This generator should use the same algorithms as StationModuleList, StationWareFlowDashboard, StationWorkforce, and StationConstruction components to ensure consistency between mock data and real application behavior.

The generator will pull data from the mock_modules configuration in x4-station-calculator.config.json and create corresponding industryModules, supplyModules, wareFlows, stationWorkforce, and stationConstructions data.

## Goals / Non-Goals

**Goals:**
- Create a TypeScript-based mock data generator that mirrors the UI component logic
- Generate realistic test data for development and testing purposes
- Ensure consistency between mock data and real application behavior
- Support all data types required by the UI components
- Integrate with the existing mock_modules configuration

**Non-Goals:**
- Modify existing UI component logic
- Create new UI components
- Implement runtime data generation for production use
- Handle real game data processing

## Decisions

1. **Technology Choice**: Use TypeScript to maintain consistency with the existing codebase
2. **Logic Reuse**: Extract and reuse the same business logic from existing components rather than duplicating algorithms
3. **Configuration Source**: Use the mock_modules array in x4-station-calculator.config.json as the source of truth for mock data generation
4. **Modular Approach**: Create separate functions for generating each type of data (industryModules, supplyModules, etc.) to allow for flexibility
5. **Integration Method**: Export functions that can be used both programmatically and via command-line interface

## Risks / Trade-offs

[Risk: Logic duplication] → Mitigation: Carefully extract the business logic from existing components into reusable utility functions
[Risk: Maintenance overhead] → Mitigation: Keep the mock data generator in sync with UI component changes by having clear documentation
[Risk: Performance impact] → Mitigation: Optimize for generation speed since mock data is primarily for development/testing