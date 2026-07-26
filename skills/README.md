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

```sh
npx skills add dan-fetch-studio/tidyports-integrations
```

That installs into whichever agent you use — Claude Code, Cursor, Copilot, Gemini and
others are all supported by the [`skills` CLI](https://github.com/vercel-labs/skills).

To wire it up by hand instead, symlink the skill directory into your agent's skills
folder:

```sh
# global — available in every project
ln -s "$(pwd)/tidyports" ~/.claude/skills/tidyports

# …or per-project
ln -s "$(pwd)/tidyports" /path/to/your/project/.claude/skills/tidyports
```

### It needs the TidyPorts app

The skill drives the `tidy-ports` CLI, which ships inside
[TidyPorts](https://tidyports.app) (free, macOS 15+):

```sh
brew install --cask dan-fetch-studio/tap/tidyports
```
