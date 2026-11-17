import { SecretKeyBook } from "./adapters/keys";
import { R2PhotoStore } from "./adapters/r2";
import { Buffer } from "./domain/buffer";
import { handle } from "./http";

export interface Env {
  PHOTOS: R2Bucket;
  KEYS?: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, new Buffer(new R2PhotoStore(env.PHOTOS)), new SecretKeyBook(env.KEYS));
  },
} satisfies ExportedHandler<Env>;
