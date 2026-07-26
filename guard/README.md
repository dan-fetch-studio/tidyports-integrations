# @tidyports/guard

`EADDRINUSE` tells you a port is taken. It never tells you by what.

Put this in front of your dev command and the error answers the actual question:

```
$ tidyports-guard npm run dev

Error: listen EADDRINUSE: address already in use :::3000

[tidyports] :3000 is held by Claude Code, in Ghostty [PID 12345] in acme-web (feature/auth)
To take a different port:  PORT=$(tidy-ports alloc web)
To stop it:                tidy-ports kill --match 3000
```

That last part matters most when an agent is reading it. An agent that hits a port
conflict and can't tell it from a bug will often "fix" working code to get around the
port — usually by editing your app's configuration. Naming the owner is what makes the
conflict legible as a conflict.

## Use it

```bash
npx @tidyports/guard npm run dev
```

Or wire it into the script you already run:

```json
{
  "scripts": {
    "dev": "tidyports-guard vite"
  }
}
```

It needs the [TidyPorts](https://tidyports.app) CLI on your `PATH` to name the owner.
Without it you get a one-line note instead, and nothing else changes.

## What it does to your dev loop

Nothing, by design. It is a wrapper around a command you already run, so it is worth
being precise about what it does not touch:

- **stdout stays a TTY.** Only stderr is intercepted, and every chunk is written through
  before it's even inspected — so your dev server keeps its colour and its interactive
  keys.
- **Exit codes and signals are reproduced exactly**, including the terminating signal, so
  a shell, a CI step or an agent reading the status sees what it would have seen anyway.
- **Ctrl-C still works.** `SIGINT`, `SIGTERM` and `SIGHUP` are forwarded to the child.
- **Nothing is added on success.** The message appears only when a bind actually failed,
  once, and never again for the same run.

## What it understands

The message is different in every ecosystem, so it matches the wording rather than the
language:

| | |
|---|---|
| Node | `listen EADDRINUSE: address already in use :::3000` |
| Vite | `Port 5173 is in use` |
| Flask / Python | `Address already in use` + `Port 5000 is in use` |
| Rails / Puma | `bind(2) for "127.0.0.1" port 3000` |
| Go | `listen tcp :8080: bind: address already in use` |
| Docker | `Bind for 0.0.0.0:5432 failed: port is already allocated` |

Lines that merely mention a port are deliberately ignored. A false positive would send
you after the wrong process, which is worse than staying quiet.

## Tests

```bash
npm test
```

Covers the patterns above — including the ones that must not match — and the wrapper's
behaviour: exit codes, stderr passthrough, and a real bind failure.

## Licence

MIT
