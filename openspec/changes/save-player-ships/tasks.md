## 1. Rust archive facts

- [x] 1.1 Extend `rust-parser/src/model.rs` with player ship, cargo, assignment, and order-summary archive types plus `SectorData.player_ships`, set Rust archive schema to v11, and verify Rust serialization tests cover the new fields.
- [x] 1.2 Extend `rust-parser/src/core.rs` to collect every `owner=player` `ship_*` component with identity, macro/class, sector, and real `<cargo ware="..." v="..."/>` facts, and verify the Rust/WASM parser with a fixture cut from `save_009.xml`.
- [x] 1.3 Collect subordinate groups and connection references, resolve commander kind/id/role at archive finalization, and verify Rust tests distinguish station assignment, ship assignment, no assignment, and an unresolved reference.
- [x] 1.4 Parse default order separately from ordered non-default commands with available state/failure/target facts, and verify Rust tests cover default `Wait`, dock/fly wait queues, and economic orders.

## 2. TypeScript archive contract and persistence

- [x] 2.1 Mirror the v11 player ship archive types in `src/types/saveArchive.ts`, update only `CURRENT_PARSER_VERSION` in `src/workers/saveParser.post.ts`, and verify versioning tests accept v11, reject v10, keep legacy parser v3, and keep post-process v13.
- [x] 2.2 Rebuild the checked-in WASM with `npm run build-rust` after the Rust edits and verify `tests/unit/save-import/save-parser.spec.ts` reads player ship facts from the Rust parser.
- [x] 2.3 Verify the existing `archive_data` IndexedDB save/restore and post-process pass-through preserve `SectorData.player_ships`; add only a focused regression test if current coverage does not observe the new collection.

## 3. Player ship availability

- [x] 3.1 Add a pure classifier in `src/store/logic/playerShipAvailability.ts` for assignment, activity, repeat status, availability, and reason codes, and verify `tests/unit/save-import/player-ship-availability.spec.ts` covers station/ship assignment and unresolved commanders.
- [x] 3.2 Classify explicit trade/mining/salvage or confirmed repeat behavior as unavailable, default `Wait` with an empty non-default queue as immediately available, wait-only dock/fly commands as reclaimable, and unknown active orders as unknown; verify each branch in the focused unit test.
- [x] 3.3 Expose the derived player ship state from the existing save-domain store using selected archive data, retain sector and ship class for filtering, and verify an available L-class ship can be selected by sector without a docking requirement.

## 4. Change verification

- [x] 4.1 Run the Rust parser test suite and the targeted save-import/player-ship availability Vitest files, and verify all new parser, versioning, persistence, and classification scenarios pass.
- [x] 4.2 Run `npx openspec validate save-player-ships --strict` and verify the change artifacts and implemented behavior remain aligned with no presenter or Vue changes.
