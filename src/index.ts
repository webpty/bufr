// Three ways in. /v1/ is the API for keys (Geotag and the NAS: photos, and Geotag's sync lists), /api/ is the
// API behind the page, and everything else is the page itself, whose
// assets binding hands back index.html for any path it does not know.

import { D1Ledger } from "./adapters/d1";
import { SecretKeyBook } from "./adapters/keys";
import { R2ListStore, R2PhotoStore } from "./adapters/r2";
import { Buffer } from "./domain/buffer";
import { Lists } from "./domain/lists";
import type { Env } from "./env";
import { handle } from "./http";
import { handlePage } from "./page";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/v1/")) {
      return handle(request, new Buffer(new R2PhotoStore(env.PHOTOS), new D1Ledger(env.DB)), new SecretKeyBook(env.KEYS), new Lists(new R2ListStore(env.PHOTOS)));
    }
    if (pathname.startsWith("/api/")) return handlePage(request, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
