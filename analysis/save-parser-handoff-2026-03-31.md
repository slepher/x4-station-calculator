# Save Parser Handoff

Date: 2026-03-31
Workspace: `/home/slepher/project/x4-station-calculator/worktrees/user-save`
Current HEAD before this note: `5ec140d`

## Stable baseline

The last known good commit for the reusable save parser / CLI work is:

- `5ec140d` `Add reusable save parser CLI and worker support`

That baseline includes:

- reusable parser logic in `src/workers/saveParser.worker.ts`
- CLI proxy in `scripts/extract_save.tsx`
- `stream` shim for browser build
- `meta.filename` and `meta.parser_version = "v1"`
- build passing
- `tests/unit/save-import/save-parser.spec.ts` passing

## Problem being investigated

The parser was too slow on large saves.

Observed timings before parser replacement:

- `save_005.xml.gz` end-to-end extraction: about `40s`
- `save_002.xml` profile with `sax-js`: about `18.8s`

## Profiling findings on sax-js

Profile script:

- `analysis/tmp_scripts/profile_save_parser.ts`

Command used:

```bash
npm exec tsx analysis/tmp_scripts/profile_save_parser.ts save_002.xml
```

Representative result with `sax-js`:

- file size: `438.1MB`
- total: `18816.6ms`
- decode: `227.0ms`
- feed: `14924.7ms`
- sax_write: `14899.1ms`
- on_open_tag: `1085.3ms`
- on_close_tag: `472.3ms`
- open_tag_count: `6525902`
- close_tag_count: `6525902`

Conclusion:

- real bottleneck was `sax.write()` path
- decode / I/O / logging are not significant
- optimizing current JS callbacks alone has limited upside

## What was tried and reverted

### Parser hot-path optimization

Tried:

- replacing repeated `isAtTags(...)` checks with state/depth flags

Result:

- harder to maintain
- measurable gain was too small

Current status:

- this hot-path rewrite was reverted

## sax-wasm exploration

The user requested trying the stronger replacement option instead of small optimizations.

Installed:

- `sax-wasm`

Integration status right now:

- baseline `src/workers/saveParser.worker.ts` is back on `sax`
- exploratory `sax-wasm` version now lives in `src/workers/saveParserWasm.worker.ts`
- `scripts/extract_save.tsx` was updated to feed bytes directly
- `analysis/tmp_scripts/profile_save_parser.ts` was updated accordingly
- `tests/unit/save-import/save-parser.spec.ts` passes
- `npm run build` passes
- build emits a wasm asset:
  - `dist/assets/sax-wasm-*.wasm`

## sax-wasm result

Command used:

```bash
npm exec tsx analysis/tmp_scripts/profile_save_parser.ts save_002.xml
```

Observed result with `sax-wasm`:

- total: `28824.3ms`
- feed: `27665.6ms`
- sax_write: `27629.8ms`
- on_open_tag: `1228.7ms`
- on_close_tag: `667.8ms`
- open_tag_count: `9241263`
- close_tag_count: `9241263`

Compared to `sax-js`, `sax-wasm` is significantly slower in this project.

## Shallow explanation for why sax-wasm was slower

Likely reasons:

1. `sax-wasm` emits heavier tag objects than this project needs.
2. There is high-frequency WASM -> JS callback overhead for millions of open/close events.
3. Input chunks are copied into WASM memory.
4. Event counts were higher than with `sax-js` on the same file:
   - `sax-js`: `6525902`
   - `sax-wasm`: `9241263`

This suggests the event model is not a good fit for the current usage pattern.

## saxes exploration (2026-03-31)

Tried `saxes` parser as suggested. Result:

- `saxes` was ~57% slower than `sax-js`
- Reverted to `sax-js`

## Rust WASM with quick-xml (2026-03-31) - SUCCESS

Built a custom Rust WASM parser using `quick-xml` streaming library.

### Implementation

- `rust-parser/Cargo.toml` - Rust project with quick-xml, serde, serde_json
- `rust-parser/src/lib.rs` - Streaming XML parser using quick-xml events
- `src/wasm/save_parser.js` - wasm-pack generated JS glue (target: web)
- `src/wasm/save_parser_bg.wasm` - Compiled WASM (~120KB)
- `src/workers/saveParserRust.worker.ts` - Worker wrapper for WASM parser

### Build command

```bash
cd rust-parser && wasm-pack build --target web --release --out-dir ../src/wasm
```

### Performance Results (save_002.xml, 437MB)

| Parser | Time | Stations |
|--------|------|----------|
| **Rust WASM (quick-xml)** | **5.05s** | 1419 |
| sax-js | 16.4s | 1419 |
| sax-wasm | 28.8s | (incorrect counts) |
| saxes | ~29s | - |

**Rust WASM is 3.25x faster than sax-js**

### Test scripts

- `scripts/testWasmDirect.ts` - Direct WASM test (Node.js)
- `scripts/testSaxParser.ts` - sax-js comparison test

### Current status (UPDATED 2026-03-31 22:00)

- ✅ Rust WASM parser working
- ✅ Performance verified (3x speedup: 7s vs 20s on 437MB file)
- ✅ Full feature parity with sax-js (stations, sectors, modules, datavaults, abandoned ships)
- ✅ Worker integration complete (`saveParserRust.worker.ts`)
- ✅ Web UI updated to use Rust WASM parser (`SaveUploadPanel.vue`)
- ✅ CLI tool with `--wasm` flag (`scripts/extract_save.tsx`)
- ✅ Simplified parser - no external config dependency (raw attribute extraction only)

### Changes made

1. **`src/workers/saveParserSimplified.worker.ts`** - New simplified sax-js parser (no config needed)
2. **`rust-parser/src/lib.rs`** - Complete rewrite with full feature extraction
3. **`src/workers/saveParserRust.worker.ts`** - Updated for simplified API
4. **`src/components/save/SaveUploadPanel.vue`** - Now uses Rust WASM parser
5. **`scripts/extract_save.tsx`** - CLI with `--wasm` flag

### Performance comparison (save_002.xml, 437MB)

| Parser | Time | Output |
|--------|------|--------|
| sax-js | ~20s | 152 sectors, 1419 stations |
| **Rust WASM** | **~7s** | 152 sectors, 1419 stations (identical) |

### Next steps (completed)

## Important files

- `src/workers/saveParser.worker.ts`
- `src/workers/saveParserWasm.worker.ts`
- `scripts/extract_save.tsx`
- `tests/unit/save-import/save-parser.spec.ts`
- `analysis/tmp_scripts/profile_save_parser.ts`
- `analysis/save-parser-handoff-2026-03-31.md`

## Important commands

Baseline test:

```bash
/home/slepher/project/x4-station-calculator/worktrees/user-save/node_modules/.bin/vitest run tests/unit/save-import/save-parser.spec.ts
```

Build:

```bash
npm run build
```

Profile:

```bash
npm exec tsx analysis/tmp_scripts/profile_save_parser.ts save_002.xml
```
