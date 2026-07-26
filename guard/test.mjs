// Two things worth testing here, and they are different in kind.
//
// The table asserts the shipped patterns against the real wording each tool
// uses, including the ones that must NOT match — a false positive sends someone
// after the wrong process, which is worse than saying nothing.
//
// The end-to-end block asserts the wrapper stays invisible: exit codes through,
// stderr unaltered, nothing added when nothing failed. Those are the properties
// that decide whether it is safe to put in front of your dev loop.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { portFrom } from "./detect.js";

const here = dirname(fileURLToPath(import.meta.url));
const GUARD = join(here, "guard.js");
let failures = 0;

function check(ok, label, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  ok   ${label}`);
  }
}

// ---- what each ecosystem actually prints ------------------------------------

const CASES = [
  ["node :::port", "Error: listen EADDRINUSE: address already in use :::3000", "3000"],
  ["node ipv4", "Error: listen EADDRINUSE: address already in use 127.0.0.1:8080", "8080"],
  ["vite", "Port 5173 is in use, trying another one...", "5173"],
  ["flask", "OSError: [Errno 48] Address already in use\nPort 5000 is in use by another program.", "5000"],
  ["puma/rails", 'Address already in use - bind(2) for "127.0.0.1" port 3000 (Errno::EADDRINUSE)', "3000"],
  ["go", "listen tcp :8080: bind: address already in use", "8080"],
  ["docker", "Bind for 0.0.0.0:5432 failed: port is already allocated", "5432"],
  // Must not match: nothing here is a bind failure, and a guess would be wrong.
  ["unrelated warning", "warning: something unrelated happened", null],
  ["a port merely mentioned", "server listening on port 3000", null],
  ["no digits", "Error: address already in use", null],
];

for (const [label, text, want] of CASES) {
  const got = portFrom(text);
  check(got === want, `detect: ${label}`, `got ${got}, want ${want}`);
}

// ---- the wrapper stays out of the way ---------------------------------------

const run = (args, opts = {}) =>
  spawnSync(process.execPath, [GUARD, ...args], { encoding: "utf8", ...opts });

let r = run(["node", "-e", "process.exit(0)"]);
check(r.status === 0, "exit: success passes through", `got ${r.status}`);

r = run(["node", "-e", "process.exit(42)"]);
check(r.status === 42, "exit: custom code passes through", `got ${r.status}`);

r = run(["definitely-not-a-real-command-xyz"]);
check(r.status === 127, "exit: missing command is 127", `got ${r.status}`);

r = run(["node", "-e", "console.error('a normal warning')"]);
check(r.stderr.trim() === "a normal warning", "stderr passes through unaltered", JSON.stringify(r.stderr));
check(!r.stderr.includes("[tidyports]"), "adds nothing when nothing failed");

r = run([]);
check(r.status === 1, "no arguments is a usage error", `got ${r.status}`);
check(r.stderr.includes("usage:"), "no arguments prints usage");

// ---- a real bind failure ----------------------------------------------------

// Hold a port in this process, then ask a child to bind the same one. Port 0
// would be free by definition, so a fixed high port it is; if something else
// already has it the test would still pass for the wrong reason, hence the
// explicit listen check first.
const net = await import("node:net");
const held = net.createServer();
await new Promise((resolve, reject) => {
  held.once("error", reject);
  held.listen(45771, "127.0.0.1", resolve);
});

r = run(["node", "-e", "require('net').createServer().listen(45771,'127.0.0.1')"]);
check(r.status === 1, "bind failure keeps the child's exit code", `got ${r.status}`);
check(r.stderr.includes("[tidyports]"), "bind failure is explained");
check(r.stderr.includes("45771"), "the explanation names the port");

held.close();

console.log(failures ? `\n${failures} failed` : "\nall guard tests passed");
process.exit(failures ? 1 : 0);
