# Suspect Notes

## 2026-03-29: `FUN_14075c250 -> +0x1c8/+0x1f0 -> FUN_14075ff10` runtime link confirmed

### Confirmed by live breakpoints

- Breakpoints hit in this exact order:
  - `FUN_14075bd20`
  - `FUN_14075c250`
  - `FUN_14073f750`
  - `call [rax+0x1c8]`
  - `call [rax+0x1f0]`
  - `FUN_14075ff10`

- Concrete callsites observed inside `FUN_14075c250`:
  - `0x14075c8f9`: `call [rax+0x1c8]`
  - `0x14075c91b`: `call [rax+0x1f0]`
  - `0x14075c99b`: `call FUN_14075ff10`

### Confirmed parameter forwarding

- `+0x1c8` returned:
  - `rax = 0x0000021b5856fa20`
  - immediately stored to `[rsp+0x30]`
  - later observed at `FUN_14075ff10` entry as:
    - `rdx = 0x0000021b5856fa20`

- `+0x1f0` returned:
  - `eax = 0x619`
  - moved into `r12d`
  - later observed at `FUN_14075ff10` callsite / entry as:
    - `r8d = 0x619`

- `FUN_14075ff10` entry observed:
  - `rcx = aggregation/map context`
  - `rdx = resource key from +0x1c8`
  - `r8 = contribution from +0x1f0`
  - extra arguments still arrive via stack / xmm state

### Practical consequence

- The runtime second-stage and third-stage path is connected inside `FUN_14075c250`.
- The Python split
  - `prepare_region_runtime_for_dispatch(...)`
  - legacy candidate-node aggregation
  is now explicitly contradicted by live runtime evidence.

## 2026-03-28: Current solid second-stage path is likely mis-modeled

### Confirmed by runtime debug

- The runtime second-stage chain hit in this order:
  - `FUN_14075bd20`
  - `FUN_14075c250`
  - `FUN_14073f750`
  - `FUN_14093bf90`
  - field virtual `+0x1f0`
  - `FUN_14075ff10`

- This means the second stage is running its own query / occupancy path at runtime.
- It is not simply consuming pre-stage candidate results as an already-computed input blob.

### Confirmed runtime parameter shape

- At `FUN_14075bd20`:
  - `rcx`: manager / dispatch owner object
  - `rdx`: compiled region runtime object
  - `r8`: stack-based float/query data block
  - `r9`: `0`

- At `FUN_14075ff10`:
  - `rcx`: aggregation/map context
  - `rdx`: resource key from field virtual `+0x1c8`
  - `r8`: integer contribution from field virtual `+0x1f0`
  - additional stack arguments are also present, so this path carries more state than the current Python simplification

### Current suspicion

- The Python path
  - `prepare_region_runtime_for_dispatch(...)`
  - old candidate-node aggregation
  previously assumed a direct handoff from precomputed tile results into second-stage aggregation.

- Runtime evidence now contradicts that assumption.

- Therefore, the current extra tile hits may be caused by path mis-modeling, not just by a bad formula or a missing clamp.

### Strong suspects

1. The current Python implementation is stitching the wrong stages together.
2. The old candidate-node aggregation input may not correspond to the real second-stage runtime input.
3. The path currently treated as solid second-stage replay may actually be a different region-processing path, or a richer path than the current Python model captures.

### Practical impact

- Do not treat
  - the old candidate-node handoff path
  as a proved C++ chain.

- Do not continue tuning per-field contribution formulas on top of this assumption until the second-stage input source is re-established from runtime evidence.

### Immediate next step

- Rebuild the second-stage model from:
  - `FUN_14075bd20`
  - `FUN_14075c250`
  - field virtual `+0x1f0`
  - `FUN_14075ff10`

- Do not use old candidate-node handoff as the authoritative source for this stage.
- The current mainline should be described as:
  - `prepare_region_runtime_for_dispatch(...)`
  - `replay_region_runtime_14075BD20(...)`
