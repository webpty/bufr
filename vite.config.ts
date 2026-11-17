import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// The number at the foot of the settings page, kept in package.json and
// raised with the commit that goes out: Workers Builds clones shallow, so a
// count from the repository could not go up.
const VERSION = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

// The Cloudflare plugin goes last: it reads wrangler.toml, bundles the Worker
// from `main`, and writes dist/bufr/wrangler.json pointing at the page.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  define: { __VERSION__: JSON.stringify(VERSION) },
  // Its own port, so a browser does not wear another site's icon.
  server: { port: 5197, strictPort: true, watch: { ignored: ["**/.wrangler/**"] } },
});
