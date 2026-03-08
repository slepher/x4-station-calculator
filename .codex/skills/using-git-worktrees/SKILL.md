---
name: using-git-worktrees
description: Use before any implementation to enforce isolated git worktree setup with hard fail-close gates
---

# Using Git Worktrees (Project Local Override)

## Scope
- This is the project-local override skill.
- When this file exists, DO NOT read or use `~/.codex/.../using-git-worktrees/SKILL.md`.

## Hard Gate (Fail-Close)
No code edits, no formatting, no test runs that may write files until all checks below pass.

### Mandatory Pre-Edit Checks (must print results)
```bash
git rev-parse --abbrev-ref HEAD
pwd
git worktree list
```

### Block Conditions
Stop immediately if any condition is true:
- Branch is `develop` or `main`.
- `pwd` is repo primary working directory (not a worktree path).
- Current path is not present in `git worktree list` entries.

If blocked: create/switch to a worktree first.

## Directory Selection Priority
1. Use existing `.worktrees/` if present.
2. Else use existing `worktrees/`.
3. Else check `CLAUDE.md` / `AGENTS.md` for preference.
4. Else ask user.

## Safety Verification (project-local dirs only)
Before creating worktree in `.worktrees/` or `worktrees/`:
```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```
If not ignored:
1. Add ignore rule to `.gitignore`.
2. Commit that change.
3. Continue.

## Create Worktree
```bash
project=$(basename "$(git rev-parse --show-toplevel)")
# example
# git worktree add .worktrees/<branch-name> -b <branch-name>
```

After creation, `cd` into worktree and rerun mandatory pre-edit checks.

## Baseline Setup
Run setup by project type (Node/Rust/Python/Go), then run a minimal baseline test command.
If baseline fails, report and ask before implementation.

## Required Worktree-Ready Report
Before implementation, report:
- worktree path
- branch name
- pre-edit checks output summary
- baseline test result summary

## Red Flags
Never:
- Edit files before passing pre-edit checks.
- Continue in `develop`/`main` for feature work.
- Skip ignore verification for project-local worktree dirs.
