---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

**Default announce:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## User Override

If the user explicitly asks not to create a worktree, do not force one.

Examples:
- "不要建 worktree"
- "直接在当前目录改"
- "skip worktree"
- "这次不要隔离工作区"

In that case:
1. Acknowledge the override.
2. State that you will continue in the current workspace without isolation.
3. Skip worktree creation steps.
4. Still inspect git status and avoid overwriting unrelated user changes.

## Directory Selection Process

If there is no explicit user override, follow this priority order:

### 1. Check Existing Directories

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

### 2. Check CLAUDE.md / AGENTS.md

```bash
grep -i "worktree.*director" CLAUDE.md AGENTS.md 2>/dev/null
```

**If preference specified:** Use it without asking.

### 3. Ask User

If no directory exists and no repository guidance preference exists:

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden)
2. ~/.config/superpowers/worktrees/<project-name>/ (global location)

Which would you prefer?
```

## Safety Verification

### For Project-Local Directories (.worktrees or worktrees)

**MUST verify directory is ignored before creating worktree:**

```bash
# Check if directory is ignored (respects local, global, and system gitignore)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:**

Per Jesse's rule "Fix broken things immediately":
1. Add appropriate line to `.gitignore`.
2. Commit the change.
3. Proceed with worktree creation.

**Why critical:** Prevents accidentally committing worktree contents to repository.

### For Global Directory (~/.config/superpowers/worktrees)

No `.gitignore` verification needed because it is outside the repository.

## Creation Steps

### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Create Worktree

```bash
# Determine full path
case $LOCATION in
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/superpowers/worktrees/*)
    path="~/.config/superpowers/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# Create worktree with new branch
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. Verify Clean Baseline

Run tests to ensure the worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** Report failures and ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 5. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| User explicitly says no worktree | Skip creation, continue in current workspace |
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Check CLAUDE.md / AGENTS.md → Ask user |
| Directory not ignored | Add to `.gitignore` + commit |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Skipping ignore verification

- **Problem:** Worktree contents get tracked and pollute git status.
- **Fix:** Always use `git check-ignore` before creating a project-local worktree.

### Assuming directory location

- **Problem:** Creates inconsistency and violates project conventions.
- **Fix:** Follow priority: existing > CLAUDE.md / AGENTS.md > ask.

### Forcing isolation after an explicit user override

- **Problem:** Ignores user instruction and adds unnecessary process friction.
- **Fix:** Treat explicit "no worktree" requests as a valid override and continue safely in place.

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues.
- **Fix:** Report failures and get explicit permission to proceed.

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools.
- **Fix:** Auto-detect from project files (`package.json`, etc.).

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Check .worktrees/ - exists]
[Verify ignored - git check-ignore confirms .worktrees/ is ignored]
[Create worktree: git worktree add .worktrees/auth -b feature/auth]
[Run npm install]
[Run npm test - 47 passing]

Worktree ready at /Users/jesse/myproject/.worktrees/auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## Red Flags

**Never:**
- Create a worktree without verifying it's ignored when using project-local directories.
- Skip baseline test verification.
- Proceed with failing tests without asking.
- Assume directory location when ambiguous.
- Skip CLAUDE.md / AGENTS.md checks.
- Force a worktree after the user explicitly asked not to create one.

**Always:**
- Honor explicit user requests to avoid creating a worktree.
- Follow directory priority: existing > CLAUDE.md / AGENTS.md > ask.
- Verify the directory is ignored for project-local worktree locations.
- Auto-detect and run project setup.
- Verify a clean baseline before implementation when using a worktree.

## Integration

**Called by:**
- **brainstorming** (Phase 4) when design is approved and implementation follows
- **subagent-driven-development** before executing any tasks
- **executing-plans** before executing any tasks
- Any workflow needing isolated workspace

**Pairs with:**
- **finishing-a-development-branch** for cleanup after work completes
