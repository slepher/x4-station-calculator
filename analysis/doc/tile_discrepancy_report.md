# Investigation Report: Tile Value Discrepancy

## Summary

Investigating tile (0, 0, -256000) which has:
- Save value: 173
- Computed value: 572
- Ratio: 3.31x

## Root Cause Analysis

The tile is **outside the tube**:
- Nearest distance to spline: 71685m
- Tube radius: 22000m
- Query radius: 55425.625m
- Lateral effective radius: 77425.625m (query + tube)

Since 71685 < 77425.625, the tile passes the lateral intersection check.

The radial interval is computed using the distance to a representative point sampled at `lateral_lower`:
- Representative point distance: 77159m
- Radial interval: (0.9879, 1.0)
- Radial weight: 0.0206 (very small, at tube edge)

The computed tile value:
- Profile weight: 0.0238
- Base multiplier: 24000
- Tile value: 572

## Remaining Questions

1. Why is the save value (173) lower than computed (572)?
2. Is there additional filtering or culling in the C++ code?

## Possible Explanations

1. **Different spline geometry**: The save might have been generated with different spline data
2. **Yield variation**: There might be a yield variation factor not captured in our calculation
3. **Tile culling**: Some tiles might be culled before saving if they don't meet certain criteria
4. **Overlapping regions**: The save might include contributions from multiple regions

## Next Steps

1. Verify the spline geometry matches the save data
2. Check if there are any yield variation factors
3. Look for tile culling logic in the C++ code
4. Compare with other tiles to find a pattern

## Total Comparison

- Save total for nebula_2: 610191
- Computed total: 546263
- Ratio: 0.90x

The overall ratio is 0.90x, but individual tiles vary from 0.10x to 1.44x. This suggests systematic errors in our calculation.