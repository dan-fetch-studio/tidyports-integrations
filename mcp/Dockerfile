# Dockerfile for Glama's MCP introspection checks.
#
# Worth being clear about what this image is and isn't. TidyPorts inspects local dev
# servers on macOS, so the TOOLS cannot function in a Linux container — they shell out to
# the `tidy-ports` CLI, which ships inside the macOS app and depends on lsof, ps and
# process ancestry there.
#
# Introspection is a different question, and the one these checks ask: the server starts,
# speaks MCP over stdio, and reports its tool schemas without touching the CLI. Calling a
# tool in here returns a clear error pointing at the download, which is the same thing it
# does on a Mac without the app installed.
FROM node:22-alpine

WORKDIR /app

# Install with the lockfile so the image matches what npm publishes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server.js ./

# stdio transport: no port to expose, no daemon to supervise.
ENTRYPOINT ["node", "server.js"]
