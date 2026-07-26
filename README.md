# TidyPorts integrations

Let your coding agent see and control the local dev servers it starts.

If you run Claude Code, Cursor or Codex across several git worktrees, each one starts dev
servers you never typed a command for. Ports collide, and an agent that hits `EADDRINUSE`
often can't tell a port conflict from a bug — so it "fixes" working code instead.

These integrations give the agent a way to look, rather than guess.

| | |
|---|---|
| [`mcp/`](mcp/) | An [MCP](https://modelcontextprotocol.io) server — typed tools for any MCP client (Claude Code, Cursor, Claude Desktop, Windsurf, Zed). |
| [`claude-code/`](claude-code/) | A Claude Code skill, if you'd rather it shelled out to the CLI directly. |

## Tools

| Tool | What it does |
|---|---|
| `list_servers` | Listening dev servers: port, process, branch, owner, idle. Read-only. |
| `kill_port` | Stop the server on a given port. |
| `alloc_port` | A stable, collision-free port for this worktree — the fix for parallel agents fighting over `:3000`. |
| `free_port` | A port nothing is listening on right now, to bind immediately. |

## Install

```sh
npm install -g @tidyports/mcp
```

Then register it with your client, pointing at the installed `tidyports-mcp` binary. For
Claude Code:

```sh
claude mcp add tidyports -- tidyports-mcp
```

### It needs the TidyPorts app

These are a thin layer over the `tidy-ports` CLI, which ships inside
[TidyPorts](https://tidyports.app) — a free macOS menu-bar app that shows every dev server
running on your Mac and which agent started it.

```sh
brew install --cask dan-fetch-studio/tap/tidyports
```

Or download it from [tidyports.app/download](https://tidyports.app/download). macOS 15+.

## Licence

The integrations here are MIT (see [LICENSE](LICENSE)). The TidyPorts app itself is
source-available under its own licence.
