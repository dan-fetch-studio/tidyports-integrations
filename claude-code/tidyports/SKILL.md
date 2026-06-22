---
name: tidyports
description: Drive local dev servers from Claude Code via the `tidy-ports` CLI — deploy one as a public preview link, see what's running on which port/branch/worktree, kill a stray server, or grab a collision-free port. Use when the user wants to share / ship / deploy / "give me a preview link" for a dev server; asks what's running on their ports or which dev server is on a port; wants to kill or stop a server on a port; or hits a port collision (EADDRINUSE / "address already in use") across parallel agents or git worktrees.
---

# TidyPorts — share, see, and kill local dev servers

Drives the `tidy-ports` CLI so you can deploy, inspect, and stop local dev servers
without the user leaving the chat. These are the same commands the TidyPorts menu-bar
app runs, so anything you do here shows up there too.

**First, check it's installed:** run `command -v tidy-ports`. If it's missing, tell the
user TidyPorts isn't installed and stop — don't guess at alternatives.

All commands are agent-friendly: prefix with `TP_NO_COLOR=1`, no interactive prompts on
the read paths, and the result (URL / data) is printed on **stdout** while progress goes
to **stderr**.

## Share a dev server as a public link (deploy)

`tidy-ports deploy [path]` deploys the web project to Vercel and prints a **public** URL
on stdout. It runs **off-machine** on Vercel's edge — nothing is served from the user's
laptop, so it scales and a flood is Vercel's problem, not theirs.

**Safety — every time, no exceptions:**
- A production deploy is **world-readable**. **Confirm with the user before deploying**,
  and say plainly what's about to go public.
- **Never deploy a project with secrets in the client bundle.** If you're unsure whether
  it's safe, ask rather than deploy.
- For a private, Vercel-login-gated link instead, use `tidy-ports deploy --preview`.

Example — user: "share this" / "give me a preview link":
1. Confirm: "This will deploy `<dir>` to a public URL on Vercel — go ahead?"
2. On yes: `tidy-ports deploy` (add a `path` arg to deploy a specific dir).
3. Hand them the URL from stdout.

## See what's running

- `tidy-ports ls` — every listening dev port with owner, git branch, uptime, and idle
  hints (human-readable). Use it to answer "what's running?", "which server is on :3001?",
  "which worktree is serving this?".
- `tidy-ports json` — the full structured snapshot; use when you need to parse fields.

## Kill a stray server

- **One port:** `tidy-ports portless kill <port>`.
- **The whole detected dev stack:** `tidy-ports stop` (it confirms first; add `-y` to skip).

If which server to kill is ambiguous, run `tidy-ports ls` first and confirm with the user.

## Avoid port collisions (parallel agents / worktrees)

When two agents or worktrees spin up servers, they collide on the same port and the
process crashes with `EADDRINUSE` — and an agent often can't tell that apart from a real
bug. Before starting a dev server, claim a stable free port for this worktree:

```sh
PORT=$(tidy-ports alloc web) || exit 1   # collision-free, sticky to this worktree
```

Wire `$PORT` into the launch command (e.g. `PORT=$PORT pnpm dev`). The assignment is
stable, so the same worktree keeps the same port and siblings get different ones.
