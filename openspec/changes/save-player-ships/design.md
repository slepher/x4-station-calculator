## Context

See `proposal.md` for motivation. The Rust/WASM parser currently produces the canonical save archive, while TypeScript owns archive validation, persistence, and reusable domain state. X4 assignment is not a single ship attribute: commander components expose subordinate groups and roles, while subordinate ships reference a group through connection nodes. Default behavior and command-queue orders are also distinct branches.

The real `save_009.xml` evidence establishes three constraints:

- a commander reference must be resolved to a component kind before calling it a station assignment;
- default `Wait` is the normal hold-position baseline and is not itself work;
- physical docking is incidental for transport selection, while sector and ship size are useful facts.
- real ship cargo is recorded as `<economylog><cargo ware="..." v="..."/></economylog>`; the parser must read `v` from the cargo node rather than a manufactured nested `<cargo><ware amount="..."/></cargo>` shape.

## Goals / Non-Goals

**Goals:**

- Preserve player ship facts without embedding planner-specific conclusions in the parser.
- Resolve assignment relations faithfully enough to distinguish station, fleet, none, and broken references.
- Give TypeScript one conservative availability classifier for later planner use.
- Keep archive version ownership explicit.

**Non-Goals:**

- No planner recommendation, NPC-order matching, route calculation, or ship allocation.
- No presenter or Vue integration.
- No requirement that a transport be docked at the target station.
- No special case for a particular pier macro; future L/XL station compatibility uses static module `type === "pier"`.

## Decisions

### 1. Rust archives raw ship facts; TypeScript derives business state

Rust adds a sector-level `playerShips` collection containing identity, class/macro, cargo, resolved assignment facts, default order, and non-default command summaries. It does not emit `available: true/false`.

TypeScript store/logic derives `assignment`, `activity`, and `availability`. This keeps XML structure and connection resolution in the parser while allowing availability policy to evolve without rebuilding WASM.

Alternative considered: derive availability in Rust. Rejected because it couples parser schema changes to planner policy and hides the evidence behind a conclusion.

### 2. Resolve commander relations after collecting components and connections

Parsing uses two logical phases within the existing traversal:

1. collect player ships, potential commander components, subordinate groups, roles, and connection references;
2. resolve each ship's commander reference against the collected component index.

The archived assignment carries commander id, commander kind (`station` or `ship`), role, and resolution state. Missing references remain `unknown`; they are not collapsed into `none`.

Alternative considered: inspect only the ship's local `<subordinate>` node. Rejected because the assignment role and commander kind live on the other side of the graph.

### 3. Keep default order and command queue separate

The parser stores at most one default-order summary separately from ordered non-default summaries. Summaries retain stable order ids plus available state, failure, and target references. Display labels are not parsed.

The classifier recognizes small explicit sets:

- economic: trade, mining, salvage/scavenge routines and trade execution;
- wait-only: dock-and-wait and fly/move-and-wait navigation without a trade step;
- idle baseline: default `Wait` with no non-default orders;
- repeat: only when the raw order facts explicitly identify repeat behavior.

Unknown active order ids remain `unknown`. Multiple queued orders alone do not prove repetition.

Alternative considered: flatten default and queued orders into one list. Rejected because default `Wait` would make idle ships look occupied and would lose queue semantics.

### 4. Availability is conservative and reason-bearing

The TypeScript result exposes the three independent dimensions plus a reason code:

| Evidence | Availability |
| --- | --- |
| valid station or ship assignment | `unavailable` |
| explicit economic or confirmed repeat behavior | `unavailable` |
| unassigned, default `Wait`, empty non-default queue | `immediatelyAvailable` |
| unassigned, only wait-like non-economic commands | `reclaimable` |
| unresolved assignment, incomplete facts, or unknown active order | `unknown` |

Downstream code may filter by sector and class. It must not use docking as an availability gate. A later station-compatibility layer may join L/XL ships with static station modules and consider any module whose `type` is `pier`; docking-count metadata is capacity, not compatibility.

Alternative considered: one boolean `available`. Rejected because it cannot distinguish a safe idle ship from a ship requiring command cancellation or one with insufficient evidence.

### 5. Version only the schema that changes

The Rust archive parser schema advances from v10 to v11, and TypeScript's `CURRENT_PARSER_VERSION` advances with it because that constant validates Rust archive output. The legacy TypeScript XML parser remains v3. The post-process version remains v13 unless implementation reveals an actual post-process semantic change.

Existing v10 archives are rejected by current-version validation and can be rebuilt from their source save. No IndexedDB schema/table migration is needed because player ships remain part of the archive body.

Alternative considered: bump every parser-related number. Rejected because the legacy parser and post-process contracts do not change.

### 6. Preserve the existing UI boundary

This change ends at store/logic. Any later page must follow `store -> presenter -> vue`; Vue must not consume the archive/store directly. Deferring UI also avoids prematurely fixing a planner presentation before source-selection behavior is specified.

## Risks / Trade-offs

- **X4 order ids vary across roles or game versions** → keep raw ids, centralize the TypeScript classification sets, and default unknown active orders to `unknown`.
- **Connection references may be incomplete after XML pruning** → update the extraction filter and test unresolved references explicitly.
- **Player fleets can be large** → reuse the streaming traversal and resolve relations through maps rather than rescanning the XML tree.
- **Conservative classification yields fewer free ships** → expose reason codes so later UI can explain and refine unknown cases without changing raw archives.
- **Archive persistence might accidentally omit the new collection** → rely on the existing full `archive_data` body path and cover IndexedDB restore with a focused test; do not add a table or post-process branch without evidence.

## Migration Plan

1. Extend Rust archive schema and parser tests, then rebuild the checked-in WASM output.
2. Update TypeScript archive types and v11 validation; verify the existing archive-body persistence and post-process pass-through retain player ships unchanged.
3. Add the TypeScript availability derivation and focused unit tests.
4. Verify archive import/restore and rejection of v10 archives.

Rollback restores the v10 parser/WASM and TypeScript schema constant together. Stored v11 archives then require re-import after returning to v10.
