// Pulling a port number out of "the port is taken", in whichever dialect the
// thing that failed happens to speak.
//
// Separate from guard.js so the table in test.mjs asserts against the patterns
// that actually ship. A regex nobody tests is a regex that quietly stops
// matching the day a framework rewords its error.

/* Ordered most specific first, so a line carrying both an address and a port
   cannot match the looser trailing patterns before the exact one. */
export const PATTERNS = [
  /EADDRINUSE[^\n]*?:(\d{2,5})\b/i, // node: ...address already in use :::3000
  /bind\(2\) for [^\n]*?port (\d{2,5})/i, // puma / rails
  /listen tcp [^\n]*?:(\d{2,5}):[^\n]*?address already in use/i, // go
  /Bind for [^\n]*?:(\d{2,5}) failed: port is already allocated/i, // docker
  /\bport (\d{2,5})\b[^\n]*?(?:is )?(?:already )?in use/i, // vite, flask
  /address already in use[^\n]*?:(\d{2,5})\b/i, // generic, address last
];

// portFrom TEXT — the port as a string, or null when this isn't a bind failure.
// Returning null generously is the point: adding nothing is always safe, and
// guessing a port from an unrelated line would send someone after the wrong
// process.
export function portFrom(text) {
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const port = Number(m[1]);
      if (port > 0 && port < 65536) return String(port);
    }
  }
  return null;
}
