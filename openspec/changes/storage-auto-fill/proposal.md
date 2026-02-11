# Storage Auto-Fill Proposal

## Summary
Implement Phase 4 of the auto-fill algorithm to automatically generate storage modules based on station ware flow analysis.

## Problem
Currently, the auto-fill process handles industry (Phase 1), workforce (Phase 2), and supply (Phase 3), but leaves storage (Phase 4) empty. Users must manually calculate and add storage, which is tedious and error-prone.

## Solution
Reuse the existing `analyzeWareFlow` logic to calculate the net production/consumption of all wares.
Calculate required volume based on a user-configurable buffer time (default 1 hour).
Automatically add appropriate storage modules (Container, Solid, Liquid) to fill the requirement.
Support "Dual Calculation" for independent AutoSupply storage.

## Impact
- Significantly reduces user effort in station planning.
- Ensures adequate storage for smooth station operation.
