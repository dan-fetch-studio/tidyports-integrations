#!/usr/bin/env node
// TidyPorts MCP server — exposes the `tidy-ports` CLI as structured, safety-gated tools
// for any MCP client (Claude Code, Cursor, Claude Desktop, …). Unlike the Claude Code
// *skill* (which advises the model how to shell out), these tools take typed inputs,
// return structured results, and ENFORCE the deploy safety in code: a public deploy is
// refused unless the caller passes confirmed:true. Thin wrapper — the CLI does the work.

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

// share — deploy off-machine. The safety is ENFORCED here, not merely advised: a public
// production deploy is refused unless confirmed:true, so the model cannot make something
// world-readable without the user agreeing first.
server.registerTool(
  "deploy",
  {
    title: "Deploy a web project (public, off-machine)",
    description:
      "Deploy a web project to Vercel and return a public URL that runs OFF the user's machine (nothing served from their laptop). A production deploy is world-readable: set confirmed:true ONLY after the user has explicitly agreed to make it public, and never deploy a project with secrets baked into the client bundle. For a private, Vercel-login-gated link, pass preview:true instead.",
    inputSchema: {
      path: z.string().optional().describe("Project directory to deploy (default: current directory)"),
      preview: z.boolean().optional().describe("Private, Vercel-login-gated preview instead of a public production deploy"),
      confirmed: z.boolean().optional().describe("Set true ONLY after the user has confirmed a PUBLIC deploy"),
    },
  },
  async ({ path = ".", preview = false, confirmed = false }) => {
    if (!preview && !confirmed) {
      return asText(
        "Refused — a production deploy is PUBLIC and world-readable. Confirm with the user " +
          "that they want this public, then call deploy again with confirmed:true. For a " +
          "private link, pass preview:true (Vercel-login-gated). Also verify the project has " +
          "no secrets baked into the client bundle before deploying."
      );
    }
    const args = ["deploy", path];
    if (preview) args.push("--preview");
    const url = await tidyPorts(args);
    return asJson({ url, public: !preview });
  }
);

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

await server.connect(new StdioServerTransport());
