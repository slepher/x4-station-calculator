---
name: team-monitor
description: "Auto-spawn agent team and create Windows Terminal split-panes to monitor each subagent. Trigger with /team-monitor <description>."
---

# Team Monitor

Use this skill for `/team-monitor` when user wants to spawn agent team and monitor in split panes.

## Workflow

### 1. Create Team
```
TeamCreate: agent_type="general-purpose", team_name="<unique-name>"
```

### 2. Spawn Agents (wt.exe split-pane)
```
# Single agent
wt.exe -w 0 split-pane -V wsl.exe -e bash -ic "cd \$(pwd) && claude --agent-id <name>@<team> --agent-name <name> --team-name <team>"

# Multiple agents (chain with \;)
wt.exe -w 0 split-pane -V wsl.exe -e bash -ic "cd \$(pwd) && claude --agent-id a1@<team> --agent-name a1 --team-name <team>" \; split-pane -H wsl.exe -e bash -ic "cd \$(pwd) && claude --agent-id a2@<team> --agent-name a2 --team-name <team>"
```

### 3. Send Task
```
SendMessage: recipient="<name>", content="<task>。完成后通知主 agent"<name> 完成""
```

### 4. Report
"Agent 已开始工作，请查看 pane"

## Key Points

- All three flags required: `--agent-id`, `--agent-name`, `--team-name`
- Use `cd \$(pwd)` for working directory
- Chain with `\;` for multiple agents
- Task must require agent to notify when done: "完成后通知主 agent XXX"
- Do NOT verify results yourself

## Agent Notifications

- Agents automatically send `idle_notification` when idle
- Task completion requires explicit notification in task description
- Example: "完成后通知主 agent w1 完成"

## Troubleshooting

### Agent Refuses to Create Files

If an agent refuses due to CLAUDE.md "no unnecessary md files" rule:
1. Confirm with user that the file is explicitly required
2. Delete existing placeholder file if needed
3. Re-send task with explicit user confirmation stated

### Re-sending Tasks

- Only re-send to agents that failed, not all agents
- Check which agents already completed via `idle_notification` before re-sending
- Sending to already-completed agents may cause duplicate work
