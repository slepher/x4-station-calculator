## Why

The resource processing logic in `scripts/processor` has evolved into a complex dual-version architecture supporting both 8.0 (regions model) and 9.0+ (resourceareas model). The current implementation requires:

1. **Architectural refactoring**: Separate map generation (Step 1) from resource calculation (Step 2)
2. **Modular algorithm implementation**: Create dedicated modules for solid/gas estimator and per-block calculations
3. **Documentation**: Comprehensive documentation for the two-step architecture and algorithms

The current `processor/resource/` module mixes definition parsing with calculation logic. This change separates these concerns and creates dedicated algorithm modules.

## What Changes

### Code Implementation

- **Step 2 module creation**: `scripts/processor/step2_resource/` with estimator/ and per_block/ subdirectories
- **Solid estimator**: `estimator/solid_estimator.py` - volume calculation with 1024km capping
- **Gas estimator**: `estimator/gas_estimator.py` - 64km voxel discretization
- **Solid per-block**: `per_block/solid_per_block.py` - 15×15×3 grid calculation with noise
- **Gas per-block**: `per_block/gas_per_block.py` - grid calculation without noise
- **Shared functions**: `shared.py` - falloff, aggregation, rating calculations

### Documentation

- Architecture documentation (two-step separation)
- Algorithm specifications (four algorithm docs)
- Output data structure definitions

### Field Updates

- `total_volume_km3` / `volume_km3`: Geometric volume before/after clipping
- `theoretical_reserve` / `reserve`: Estimated vs precise resource amounts
- Solid formula: `reserve = volume_km3 × falloff × resourcedensity`
- Gas formula: `reserve = volume_km3 × falloff × resourcedensity / 64³`

## Capabilities

### New Capabilities

- `resource-processor-docs`: Comprehensive documentation for the two-step resource processing architecture
- `step2-resource-module`: Modular resource calculation with estimator and per-block algorithms

### Modified Capabilities

- None

## Impact

### Code Modules

| Module | Path | Status |
|--------|------|--------|
| Step 1 Service | `scripts/processor/step1_map/service.py` | New (独立实现) |
| Step 1 Generator | `scripts/processor/step1_map/generator.py` | New |
| Step 2 Service | `scripts/processor/step2_resource/service.py` | New |
| Solid Estimator | `scripts/processor/step2_resource/estimator/solid_estimator.py` | New |
| Gas Estimator | `scripts/processor/step2_resource/estimator/gas_estimator.py` | New |
| Solid Per-Block | `scripts/processor/step2_resource/per_block/solid.py` | New |
| Gas Per-Block | `scripts/processor/step2_resource/per_block/gas.py` | New |
| Shared Functions | `scripts/processor/step2_resource/shared.py` | New |
| Modern Processor | `scripts/processor/step2_resource/modern_processor.py` | New |
| Map Processor | `scripts/x4_map_processor.py` | Modified |
| Resource Processor | `scripts/x4_resource_processor.py` | New |
| Verify Script | `scripts/processor/verify_resource_blocks.py` | New |

### Entry Scripts

| Script | Purpose |
|--------|---------|
| `scripts/x4_map_processor.py` | Step 1 入口：地图数据生成 |
| `scripts/x4_resource_processor.py` | Step 2 入口：资源计算 |

### Output Files

| File | Output Directory | Description |
|------|------------------|-------------|
| `maps.json` | 输入 json 所在目录 | 包含 sector.regions，不含 sector.resources |
| `resourceareas.json` | 输入 json 所在目录 | 由 Step 2 生成 |
| `resourcearea_blocks.json` | `analysis/resources/` | 方块明细（用于验收） |

### Documentation Files

| File | Purpose |
|------|---------|
| `design.md` | Main design document (architecture, data flow, structures) |
| `solid_estimator.md` | Solid resource estimation algorithm |
| `gas_estimator.md` | Gas resource estimation algorithm |
| `solid_per_block.md` | Per-block solid resource calculation |
| `gas_per_block.md` | Per-block gas resource calculation |