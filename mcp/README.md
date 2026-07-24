# TidyPorts MCP server

Exposes the `tidy-ports` CLI as **structured tools** over the
[Model Context Protocol](https://modelcontextprotocol.io), so **any** MCP client (Claude
Code, Cursor, Claude Desktop, Windsurf, Zed) can see and kill local dev servers natively,
not just Claude Code.

Where the [Claude Code skill](../claude-code/) *advises* the model how to shell out, this
server gives it **typed tools with structured results**.

## Tools

| Tool | What it does |
|---|---|
| `list_servers` | Listening dev servers: port, process, branch, owner, idle. Read-only. |
| `kill_port` | Stop the server on a given port. |
| `alloc_port` | A stable, collision-free port for this worktree (dodges parallel-agent `EADDRINUSE`). |
| `free_port` | A port that nothing is listening on right now, to bind immediately. |

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

Restart the client and the `tidyports.*` tools appear in its tool list (and can be
permissioned there). Once published to npm this becomes `"command": "npx", "args":
["-y", "@tidyports/mcp"]`, no clone required.

## Skill vs. MCP

- **Skill**: cheapest on-ramp, Claude Code only, *advises* the model. Start here.
- **MCP**: portable across clients, structured I/O. The platform layer. See
  [docs/roadmap.md](../../docs/roadmap.md).
