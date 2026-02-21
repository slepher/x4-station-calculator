---
name: x4-bug
description: "Track and manage bugs for X4 project. Invoke when a bug is discovered during development or testing to record, reproduce, and verify fixes."
---

# X4 Bug Tracking

This skill handles bug tracking and management for the X4 Station Calculator project.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Trigger

- A bug is discovered during development or testing
- User reports a bug
- Test fails and needs bug tracking

## Purpose

Record, reproduce, and verify bug fixes with proper documentation.

## Target Resolution Priority (MANDATORY)

When target descriptions are ambiguous or conflicting:
- First apply `x4-user-workflow` change resolver.
- If an explicit abbreviation token resolves uniquely, that resolved change is the final target.
- If user prose describes a different change than the resolved abbreviation result, abbreviation result takes precedence.

## Bug Tracking File (`bugs.md`)

### Location

`openspec/changes/<change-name>/bugs.md`

### Content Format

```markdown
## Bug: [Bug Name]
- **ID**: BUG-001
- **Description**: [Detailed description]
- **Steps to Reproduce**: [Step-by-step instructions]
- **Expected Behavior**: [What should happen]
- **Actual Behavior**: [What actually happens]
- **Status**: [New | Confirmed | Fixed | Verified]
- **Related Test**: [Link to test_tasks.md item]
```

## Bug Workflow

### Step 1: Record Bug

When a bug is reported or discovered:
1. Add bug entry to `bugs.md`
2. Assign a unique ID (BUG-001, BUG-002, etc.)
3. Set status to `New`

### Step 2: Generate Reproduction Test

1. Add reproduction test to `test_tasks.md`
2. Link the test to the bug via `**Related Test**` field
3. Include `**Bug现状**` to describe current broken behavior

### Step 3: Update UI Knowledge (If Web Integration Test)

**If the reproduction test is a Web Integration Test**, **YOU MUST** update `ui_knowledge.md`:
- Add locators and flows for the new test steps
- Follow the same scope limitation rules as defined in `x4-ff` skill

### Step 4: Run Reproduction Test

```bash
npm run test:unit           # For unit tests
npx playwright test         # For E2E tests
```

- If test fails as expected: Bug is `Confirmed`
- If test passes unexpectedly: Re-evaluate bug description

### Step 5: Fix Bug

- Implement the fix
- Update bug status to `Fixed`

### Step 6: Verify Fix

- Run reproduction test again
- If test passes: Bug is `Verified`
- If test still fails: Continue fixing

## Unrelated Bug Handling

If a reported bug is unrelated to any existing change:

1. Create a new change: `fix-<bug-name>`
2. The new change should contain:
   - `bugs.md` (with the bug entry)
   - `test_tasks.md` (with reproduction test)
   - `ui_knowledge.md` (if Web Integration Test)
3. Follow standard workflow for the fix

## Sync Rules (MANDATORY)

### test_tasks.md → ui_knowledge.md Sync

Whenever `test_tasks.md` is updated with new Web Integration Tests:
1. **YOU MUST** update `ui_knowledge.md` to include:
   - Locators for new elements
   - Flows for new actions
   - Data bindings for new test data

### Sync Scope

- Only add content for elements/actions explicitly required by the new tests
- Do NOT document unrelated UI elements
- Follow the **Scope Limitation** rule from `x4-ff` skill

## Status Transitions

```
New → Confirmed → Fixed → Verified
  ↓         ↓         ↓
  └─────────┴─────────┘──→ Rejected (if not a bug)
```

## Example

### bugs.md
```markdown
## Bug: Hull Parts Not Calculating Correctly
- **ID**: BUG-001
- **Description**: When adding Hull Parts production line, the total output is calculated as 0
- **Steps to Reproduce**:
  1. Drag Hull Parts to a new production line
  2. Observe the output calculation
- **Expected Behavior**: Output should show 1176 units
- **Actual Behavior**: Output shows 0 units
- **Status**: New
- **Related Test**: test_tasks.md - "Hull Parts Output Calculation"
```

### test_tasks.md (addition)
```markdown
## Unit Tests
- [ ] Hull Parts Output Calculation
  - **目标**: Verify Hull Parts production output is calculated correctly
  - **步骤**:
    1. Create a production line with Hull Parts module
    2. Check the output calculation
  - **Bug现状**: Output shows 0 instead of expected value
  - **期待结果**: Output should match module's defined output (1176)
```

## Constraints

- **Always run reproduction test** before marking bug as `Confirmed`
- **Always run reproduction test** after fix to mark as `Verified`
- **Always sync `ui_knowledge.md`** when adding Web Integration Tests to `test_tasks.md`
