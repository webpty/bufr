// The tests' own rows in the LOCAL database, put in and taken out through
// wrangler. Never --remote: nothing here ever touches the live database.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export function sql(command) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "bufr-db", "--local", "--persist-to", ".wrangler/state", "--json", "--command", command],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0]?.results ?? [];
}

/** Whatever the tests' photos left in the records of fetches and uploads.
    Uploads keep no path, so they are known by the test key's name. */
export const TEST_FOLDER = "2026.11.17 Test";
export function clearTestFetches() {
  sql(`DELETE FROM fetched WHERE path LIKE '%/${TEST_FOLDER}/%'`);
  sql(`DELETE FROM uploads WHERE sender = 'test sender'`);
}
