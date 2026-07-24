# TidyPorts × Claude Code

A [Claude Code](https://claude.com/claude-code) skill so your agent can **see and kill
local dev servers** through the `tidy-ports` CLI, without you leaving the chat.

The menu-bar app answers these for *you*; this skill answers them for the *agent* you're
already working through. Same commands, same state.

## What it does

When you're in Claude Code and say things like:

| You say… | The agent runs… |
|---|---|
| "what's running on my ports?" / "which server is :3001?" | `tidy-ports ls` |
| "kill the server on :3001" | `tidy-ports portless kill 3001` |
| "this keeps hitting EADDRINUSE" | `tidy-ports alloc` for a collision-free port |

## Install

Requires the `tidy-ports` CLI on your `PATH` (install TidyPorts first).

Symlink (or copy) the skill into Claude Code's skills directory:

```sh
# global — available in every project
ln -s "$(pwd)/tidyports" ~/.claude/skills/tidyports

# …or per-project
ln -s "$(pwd)/tidyports" /path/to/your/project/.claude/skills/tidyports
```

That's it. The skill triggers automatically when you ask about listing or killing dev
servers, or when you hit a port collision.

Prefer **structured tools** or use a client other than Claude Code (Cursor, Claude
Desktop)? The same capabilities ship as an MCP server: see [`../mcp/`](../mcp/).
