#!/usr/bin/env node
// tidyports-guard — run your dev command through this, and when it can't bind,
// the error says who is holding the port instead of just naming it.
//
//   tidyports-guard npm run dev
//
// Why a wrapper and not a plugin: "address already in use" is not a JavaScript
// problem. Vite, Next, Rails, Flask, Puma and Go all report it differently and a
// framework plugin would only ever cover one of them. Watching the child's
// stderr for the message is ugly in the abstract and works everywhere in
// practice, which is the right trade for a thing you only notice when it fires.
//
// Rules it holds to, because a wrapper around your dev loop has to be boring:
//   - stdout stays inherited, so the child still sees a TTY and keeps its colour
//     and its interactive keys. Only stderr is intercepted, and every chunk is
//     written straight through before it is even looked at.
//   - the child's exit code and terminating signal are reproduced exactly.
//   - signals are forwarded, so ctrl-c still stops your dev server.
//   - nothing is ever added on success, and it gives up quietly if the CLI is
//     not installed.

import { spawn, spawnSync } from "node:child_process";
import { portFrom } from "./detect.js";

const argv = process.argv.slice(2);

if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
  process.stderr.write(
    "usage: tidyports-guard <command> [args...]\n" +
      "\n" +
      "Runs the command and, if it fails to bind a port, names what is holding it.\n" +
      "  tidyports-guard npm run dev\n" +
      "  tidyports-guard flask run\n",
  );
  process.exit(argv.length === 0 ? 1 : 0);
}

/* TP_PORCELAIN is the CLI's own "no prompt, machine-readable" flag. Without it
   `who` would offer an interactive choice — correct when a person runs it, wrong
   here, where it would sit waiting for an answer underneath a dev server that
   has already died. */
function whoHolds(port) {
  const res = spawnSync("tidy-ports", ["who", port], {
    encoding: "utf8",
    env: { ...process.env, TP_PORCELAIN: "1" },
    timeout: 5000,
  });
  if (res.error || res.status === null) return null; // not installed, or hung
  const out = (res.stdout || "").trim();
  return out || null;
}

let reported = false;

/* stderr arrives in whatever chunks the pipe hands over, and there is no promise
   a line survives whole — a message split mid-sentence used to be missed
   silently, which is the worst kind of miss, because short errors usually do
   arrive intact and it looks like it works. So matching runs against a rolling
   tail rather than a single chunk.

   Bounded, because a dev server can log for hours: only the last few KB are
   kept, which is far more than any one bind error, and the buffer is released
   the moment there is nothing left to look for. The patterns never cross a
   newline, so rejoining chunks cannot invent a match that wasn't there. */
const TAIL_MAX = 8192;
let tail = "";

/* Two forms of the same answer, and which one you get depends on whether the
   thing that failed is still running.

   A process that cannot bind usually dies — node, rails, flask — and then the
   terminal is free, you are sitting looking at the error, and the useful thing
   is the choice `who` offers a person: take this other port, stop it, leave it.
   But not everything dies. Vite prints "Port 5173 is in use" and carries on at
   5174, and putting a prompt under a live dev server means competing with its
   output for the same terminal.

   So detection starts a short timer instead of deciding immediately. If the
   child is gone before it fires, the terminal belongs to us and `who` runs
   interactively. If it is still alive, the plain lines print and no prompt ever
   appears. Exactly one of the two happens. */
const SETTLE_MS = 400;

let pending = null;

// Can a person answer? `who` makes the same check itself, but it would see the
// pipe we hand it and never prompt, so the decision has to be made out here.
function canPrompt() {
  return Boolean(
    process.stdout.isTTY && !process.env.TP_PORCELAIN && !process.env.CI,
  );
}

function printPlain(port) {
  const answer = whoHolds(port);
  if (!answer) {
    // No CLI, so there is nothing useful to add. Say so once, briefly, rather
    // than leaving the reader wondering what this wrapper is even for.
    process.stderr.write(
      `\n[tidyports] :${port} is taken. Install TidyPorts to see what is holding it: https://tidyports.app\n`,
    );
    return;
  }
  process.stderr.write(`\n[tidyports] ${answer}\n`);
}

function explain(chunk) {
  if (reported) return;
  tail = (tail + chunk).slice(-TAIL_MAX);
  const port = portFrom(tail);
  if (!port) return;
  reported = true;
  tail = "";

  if (!canPrompt()) {
    printPlain(port);
    return;
  }
  // Hold briefly to see whether the child is dying. `unref` so a wrapper around
  // a long-lived server is never the reason the process stays up.
  const timer = setTimeout(() => {
    pending = null;
    printPlain(port);
  }, SETTLE_MS);
  timer.unref?.();
  pending = { port, timer };
}

const child = spawn(argv[0], argv.slice(1), {
  stdio: ["inherit", "inherit", "pipe"],
  shell: false,
});

child.stderr.on("data", (buf) => {
  process.stderr.write(buf); // through first, always, unaltered
  explain(buf.toString());
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}

child.on("error", (err) => {
  const why = err.code === "ENOENT" ? `command not found: ${argv[0]}` : err.message;
  process.stderr.write(`tidyports-guard: ${why}\n`);
  process.exit(127);
});

child.on("close", (code, signal) => {
  /* The child is gone, so the terminal is ours and the prompt can't collide with
     anything. Skipped on a signal: ctrl-c means you wanted out, and answering a
     question is not what you asked for. stdio is inherited so `who` sees a real
     tty and offers its own choice — including the second confirmation before it
     stops anything. */
  if (pending) {
    clearTimeout(pending.timer);
    const { port } = pending;
    pending = null;
    if (signal) {
      printPlain(port);
    } else {
      process.stderr.write("\n");
      const res = spawnSync("tidy-ports", ["who", port], { stdio: "inherit" });
      // No CLI to be interactive with, so fall back to saying what we can.
      if (res.error) printPlain(port);
    }
  }

  // Reproduce how the child ended, so this is invisible to anything upstream:
  // a shell, a CI step, or an agent reading the exit status.
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
