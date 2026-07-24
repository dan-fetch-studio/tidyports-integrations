#!/usr/bin/env node
// TidyPorts MCP server — exposes the `tidy-ports` CLI as structured tools for any MCP
// client (Claude Code, Cursor, Claude Desktop, …). Unlike the Claude Code *skill* (which
// advises the model how to shell out), these tools take typed inputs and return
// structured results. Thin wrapper — the CLI does the work.
//
// Phase 1 ships TidyPorts as a free local utility, so publishing is not exposed here:
// the `deploy` handler below is kept intact but is NOT registered, so no agent can
// discover or call it. Re-register it in phase 2 when publishing returns.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

// Shell `tidy-ports` with a clean, parseable environment. Throws a friendly error when
// the CLI is missing; otherwise surfaces the CLI's own stderr as the reason.
async function tidyPorts(args, { timeout = 180_000 } = {}) {
  try {
    const { stdout } = await run("tidy-ports", args, {
      env: { ...process.env, TP_NO_COLOR: "1" },
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error("`tidy-ports` is not on PATH — install TidyPorts first.");
    }
    const detail = (err.stderr || err.message || "").toString().trim();
    throw new Error(detail || `tidy-ports ${args.join(" ")} failed`);
  }
}

const asText = (s) => ({ content: [{ type: "text", text: s }] });
const asJson = (o) => asText(JSON.stringify(o, null, 2));

const server = new McpServer({ name: "tidyports", version: "0.1.0" });

// see — what's listening, structured (not scraped from human output).
server.registerTool(
  "list_servers",
  {
    title: "List local dev servers",
    description:
      "List the local dev servers currently listening — port, process, git branch, owner, and an idle hint. Read-only. Use it to answer 'what's running?', 'which server is on :3001?', or 'which worktree is serving this?'.",
    inputSchema: {},
  },
  async () => {
    const snap = JSON.parse(await tidyPorts(["json"]));
    const servers = (snap.listeners || []).map((l) => ({
      port: l.port,
      process: l.comm,
      branch: l.branch || null,
      owner: l.owner || null,
      idle: !!l.idle,
      cwd: l.cwd || null,
    }));
    return asJson({ servers });
  }
);

// share — deploy off-machine. NOT REGISTERED in phase 1 (see the file header): TidyPorts
// launches as a free local utility with no publishing surface, so this tool is withheld
// from the advertised tool list and an agent cannot discover or call it. The definition
// and its safety gate are kept verbatim so phase 2 is a single `server.registerTool(...)`
// call away. The safety gate is ENFORCED, not merely advised: a public production deploy
// is refused unless confirmed:true, so the model cannot make something world-readable
// without the user agreeing first.
// eslint-disable-next-line no-unused-vars
const deployTool = {
  name: "deploy",
  config: {
    title: "Deploy a web project (public, off-machine)",
    description:
      "Deploy a web project to Vercel and return a public URL that runs OFF the user's machine (nothing served from their laptop). A production deploy is world-readable: set confirmed:true ONLY after the user has explicitly agreed to make it public, and never deploy a project with secrets baked into the client bundle. For a private, Vercel-login-gated link, pass preview:true instead.",
    inputSchema: {
      path: z.string().optional().describe("Project directory to deploy (default: current directory)"),
      preview: z.boolean().optional().describe("Private, Vercel-login-gated preview instead of a public production deploy"),
      confirmed: z.boolean().optional().describe("Set true ONLY after the user has confirmed a PUBLIC deploy"),
    },
  },
  handler: async ({ path = ".", preview = false, confirmed = false }) => {
    if (!preview && !confirmed) {
      return asText(
        "Refused: a production deploy is PUBLIC and world-readable. Confirm with the user " +
          "that they want this public, then call deploy again with confirmed:true. For a " +
          "private link, pass preview:true (Vercel-login-gated). Also verify the project has " +
          "no secrets baked into the client bundle before deploying."
      );
    }
    const args = ["deploy", path];
    if (preview) args.push("--preview");
    const url = await tidyPorts(args);
    return asJson({ url, public: !preview });
  },
};
void deployTool; // referenced so linters don't strip the phase-2 definition

// kill — stop one dev server by port.
server.registerTool(
  "kill_port",
  {
    title: "Kill the server on a port",
    description: "Stop whatever dev server is listening on the given local port (frees it).",
    inputSchema: { port: z.number().int().min(1).max(65535).describe("The local port to free") },
  },
  async ({ port }) => {
    await tidyPorts(["portless", "kill", String(port)]);
    return asText(`Stopped the server on :${port}.`);
  }
);

// collisions — a sticky, collision-free port for this worktree.
server.registerTool(
  "alloc_port",
  {
    title: "Get a collision-free port",
    description:
      "Return a stable free port assigned to this git worktree, so parallel agents/worktrees don't collide on the same port (EADDRINUSE). Wire the returned port into the dev server's launch command.",
    inputSchema: { service: z.string().optional().describe("Service name to allocate for (default: web)") },
  },
  async ({ service = "web" }) => {
    const port = Number(await tidyPorts(["alloc", service]));
    return asJson({ service, port });
  }
);

// free_port — a collision-free port to use RIGHT NOW, before binding. Stateless
// sibling of alloc_port: no sticky per-worktree assignment, just the first port
// in the range that nothing is currently listening on.
server.registerTool(
  "free_port",
  {
    title: "Get a free port to bind now",
    description:
      "Return a single TCP port that is NOT currently in use, so you can bind a server without an EADDRINUSE collision. Stateless — for a STABLE port that's remembered per worktree across restarts, use alloc_port instead.",
    inputSchema: {
      range: z
        .string()
        .regex(/^\d+-\d+$/, "range must look like START-END, e.g. 3000-3999")
        .optional()
        .describe("Port range to search, e.g. 8000-8099 (default 3000-3999)"),
    },
  },
  async ({ range }) => {
    const args = ["free-port"];
    if (range) args.push("--range", range);
    const port = Number(await tidyPorts(args));
    return asJson({ port });
  }
);

await server.connect(new StdioServerTransport());
