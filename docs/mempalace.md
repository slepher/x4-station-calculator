# MemPalace Integration

This project can use MemPalace as a local memory layer for Codex work. The runtime for the app does not depend on MemPalace. It is a developer-side tool for recalling prior decisions, bug investigations, test discoveries, and design context.

## Local plugin

This machine uses a home-local Codex plugin at `/home/slepher/plugins/mempalace-x4`.

Key files:

- Plugin manifest: `/home/slepher/plugins/mempalace-x4/.codex-plugin/plugin.json`
- MCP config: `/home/slepher/plugins/mempalace-x4/.mcp.json`
- Hooks: `/home/slepher/plugins/mempalace-x4/hooks.json`
- Marketplace entry: `/home/slepher/.agents/plugins/marketplace.json`

The plugin points to the dedicated venv Python:

```bash
/home/slepher/.venvs/mempalace/bin/python -m mempalace.mcp_server
```

## Palace location

MemPalace defaults to:

```bash
~/.mempalace/palace
```

Unless you override `MEMPALACE_PALACE_PATH` or change `~/.mempalace/config.json`, use that as the canonical local palace path.

## Recommended project workflow

Use one wing for this repository:

```bash
x4-station-calculator
```

Initial setup:

```bash
/home/slepher/.venvs/mempalace/bin/python -m mempalace init /home/slepher/project/x4-station-calculator --yes
scripts/mempalace_mine.sh --agent slepher
```

Re-index after meaningful doc or code changes:

```bash
scripts/mempalace_mine.sh --agent slepher
```

This wrapper reads room `paths` from `/home/slepher/project/x4-station-calculator/mempalace.yaml` and only mines those directories. It avoids the upstream `mempalace mine <project-dir>` behavior that scans the whole repository.

Examples:

```bash
scripts/mempalace_mine.sh --dry-run --limit 20
scripts/mempalace_mine.sh --room frontend --agent slepher
scripts/mempalace_mine.sh --room openspec --dry-run
```

Search examples:

```bash
/home/slepher/.venvs/mempalace/bin/python -m mempalace search "station flow cache" --wing x4-station-calculator
/home/slepher/.venvs/mempalace/bin/python -m mempalace search "Playwright drag flaky" --wing x4-station-calculator
/home/slepher/.venvs/mempalace/bin/python -m mempalace search "workforce bug root cause" --wing x4-station-calculator
```

Wake-up context for this project:

```bash
/home/slepher/.venvs/mempalace/bin/python -m mempalace wake-up --wing x4-station-calculator
```

## What to save

Good memory candidates:

- design decisions and why they were made
- bug root causes and stable reproductions
- test sedimentation and locator knowledge
- file and function anchors that future work will revisit
- OpenSpec decisions that are easy to lose across sessions

Avoid saving:

- trivial progress chatter
- noisy command output with no enduring value
- duplicate summaries that do not add retrieval value

## High-value source areas in this repo

When re-indexing, the highest-value material is usually under:

- `/home/slepher/project/x4-station-calculator/openspec`
- `/home/slepher/project/x4-station-calculator/docs`
- `/home/slepher/project/x4-station-calculator/guide`
- `/home/slepher/project/x4-station-calculator/tests`
- `/home/slepher/project/x4-station-calculator/.trae/skills`

## Hook behavior

The home-local plugin includes:

- a `Stop` hook that periodically blocks stop after enough user exchanges and asks for a MemPalace save checkpoint
- a `PreCompact` hook that blocks compaction until durable context is saved

These hooks prompt the workflow. They do not write to MemPalace automatically.
