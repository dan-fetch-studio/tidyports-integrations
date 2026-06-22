# TidyPorts MCP server

Exposes the `tidy-ports` CLI as **structured, safety-gated tools** over the
[Model Context Protocol](https://modelcontextprotocol.io), so **any** MCP client —
Claude Code, Cursor, Claude Desktop, Windsurf, Zed — can share / see / kill local dev
servers natively, not just Claude Code.

Where the [Claude Code skill](../claude-code/) *advises* the model how to shell out, this
server gives it **typed tools with structured results** and **enforces the deploy safety
in code** — a public deploy is refused unless the caller explicitly confirms.

## Tools

| Tool | What it does |
|---|---|
| `list_servers` | Listening dev servers — port, process, branch, owner, idle. Read-only. |
| `deploy` | Deploy a project to a **public, off-machine** Vercel URL. **Refuses unless `confirmed: true`** (or `preview: true` for a private, login-gated link). |
| `kill_port` | Stop the server on a given port. |
| `alloc_port` | A stable, collision-free port for this worktree (dodges parallel-agent `EADDRINUSE`). |

The deploy guard is real enforcement: with no `confirmed`/`preview`, the tool returns a
refusal instead of deploying — the model cannot make something world-readable without the
user agreeing first.

## Install

Requires the `tidy-ports` CLI on your `PATH` (install TidyPorts first) and Node ≥ 18.

```sh
cd integrations/mcp
npm install
```

Then register it with your client, pointing at the absolute path to `server.js`:

**Claude Code** (`.mcp.json` in your project, or `claude mcp add`):
```json
{
  "mcpServers": {
    "tidyports": { "command": "node", "args": ["/ABS/PATH/TidyPorts/integrations/mcp/server.js"] }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`) / **Claude Desktop** (`claude_desktop_config.json`) use
the same `mcpServers` shape.

Restart the client and the four `tidyports.*` tools appear in its tool list (and can be
permissioned there). Once published to npm this becomes `"command": "npx", "args":
["-y", "@tidyports/mcp"]` — no clone required.

## Skill vs. MCP

- **Skill** — cheapest on-ramp, Claude Code only, *advises* the model. Start here.
- **MCP** — portable across clients, structured I/O, *enforces* the deploy safety. The
  platform layer. See [docs/roadmap.md](../../docs/roadmap.md).
