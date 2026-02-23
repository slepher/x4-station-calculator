---
name: x4-db-fixtures
description: "Generate versioned localStorage-ready db fixtures from tests/seeds/*.yaml. Use when the user asks to build or update test DB JSON fixtures from one or more seeds."
---

# X4 Db Fixtures

## Overview

Generate localStorage-ready JSON fixtures from `tests/seeds/*.yaml` by running a script that loads seeds into the target store, then exports a single consolidated db file.

## Inputs / Outputs (MANDATORY)

Inputs:
- One or more seed files under `tests/seeds/*.yaml`
- User may specify a subset or “all seeds”

Outputs:
- `tests/fixtures/db.json` (current active db)
- Versioned snapshots under `tests/fixtures/db/db-N.json`

## Versioning Rules (MANDATORY)

- `db.json` format: `{ vsn: <number>, <db-key1>: <value>, ... }`
- Current version lives in `tests/fixtures/db.json`.
- On generation, always report the current `vsn` to the user.
- Only bump version if the user explicitly requests it.
- If version is bumped:
  1. Move the previous `db.json` to `tests/fixtures/db/db-<prevVsn>.json`.
  2. Write the new `db.json` with `vsn = prevVsn + 1`.

## Script Path (MANDATORY)

- Always generate and run `scripts/db_fixture.tsx`.
- The script must read the specified seeds, apply them to the target store, then export a consolidated db JSON in one pass.

## Workflow (MANDATORY)

1. Resolve seed set:
   - If user lists seeds, use only those.
   - If user says “all”, include all files under `tests/seeds/`.
2. Determine target store(s) from the selected seed(s).
   - If multiple stores are implied, generate a combined db with all stores.
3. Read `tests/fixtures/db.json` to determine current `vsn` and report it.
4. Ask whether to bump version if not explicitly requested.
5. Generate `scripts/db_fixture.tsx`:
   - Load specified seeds.
   - Add seed data via the store’s standard “add” logic.
   - Export to a single mock-db JSON payload.
6. Execute `scripts/db_fixture.tsx` to write `tests/fixtures/db.json`.
7. If bumping version, move old `db.json` to `tests/fixtures/db/db-<prevVsn>.json`.
8. Report:
   - seeds used
   - store used
   - final `vsn`
   - files written/moved

## Constraints

- No manual editing of `tests/fixtures/db.json`.
- No direct manipulation of localStorage; always export via store logic.
- Only bump version on explicit user request.

## Resources (optional)

Create only the resource directories this skill actually needs. Delete this section if no resources are required.

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: `fill_fillable_fields.py`, `extract_form_field_info.py` - utilities for PDF manipulation
- DOCX skill: `document.py`, `utilities.py` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Codex for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Codex's process and thinking.

**Examples from other skills:**
- Product management: `communication.md`, `context_building.md` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Codex should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Codex produces.

**Examples from other skills:**
- Brand styling: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Not every skill requires all three types of resources.**
