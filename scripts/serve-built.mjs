// Runs the built Worker the way it will run, minus the custom domain.
//
//   node scripts/serve-built.mjs [port]
//
// The Vite dev server is not a fair test. This serves dist/ through wrangler
// dev, with the bufr.cc route taken out of dist's copy of the config: with it
// left in, wrangler presents the Worker as bufr.cc and nothing local reaches
// it. Local data lives in .wrangler/state, the same place `npm run db:local`
// writes to. Secrets come from .dev.vars, which the build copies into dist/bufr: build again after changing it.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const port = process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? "8795";
const built = "dist/bufr/wrangler.json";
const local = "dist/bufr/wrangler-dev.json";

const config = JSON.parse(readFileSync(built, "utf8"));
delete config.routes;
delete config.route;
writeFileSync(local, JSON.stringify(config, null, 2));

spawn("npx", ["wrangler", "dev", "-c", local, "--port", port, "--persist-to", ".wrangler/state"], {
  stdio: "inherit",
});
