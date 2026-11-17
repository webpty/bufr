import { Buffer } from "./domain/buffer";
import { Refused, type Caller } from "./domain/model";
import type { KeyBook } from "./domain/ports";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Nothing for anyone without a key: no hint of what this is. */
const nothing = () => new Response(null, { status: 404 });

export async function handle(request: Request, buffer: Buffer, keys: KeyBook): Promise<Response> {
  const url = new URL(request.url);
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const found = key ? await keys.find(key) : null;
  if (!found) return nothing();
  const caller: Caller = found;
  const ip = request.headers.get("cf-connecting-ip");

  try {
    const route = url.pathname.slice("/v1/".length).split("/").filter(Boolean);

    if (route.length === 1 && route[0] === "status" && request.method === "GET") {
      return json(await buffer.status(caller, ip));
    }

    if (route.length === 1 && route[0] === "photos") {
      if (request.method === "GET") return json({ photos: await buffer.waiting(caller, ip) });
      if (request.method === "PUT" || request.method === "POST") {
        if (!request.body) throw new Refused(400, "No photo came with it.");
        const photo = await buffer.receive(
          caller,
          {
            path: decodeURIComponent(request.headers.get("x-path") ?? ""),
            sha256: request.headers.get("x-sha256") ?? "",
            modified: request.headers.get("x-modified") ?? undefined,
            update: request.headers.get("x-update") === "1",
            size: Number(request.headers.get("content-length") ?? "NaN"),
          },
          request.body,
        );
        return json(photo, 201);
      }
    }

    if (route.length === 2 && route[0] === "photos") {
      const id = route[1];
      if (!/^[0-9a-f]{64}$/.test(id)) return nothing();
      if (request.method === "GET") {
        const { photo, body } = await buffer.fetch(caller, id);
        return new Response(body, {
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(photo.size),
            "x-sha256": photo.sha256,
          },
        });
      }
      if (request.method === "DELETE") {
        // What the NAS says about the fetch, for the overview: how long it
        // took and how big it was. Optional, so an older fetcher still clears.
        const seconds = request.headers.get("x-seconds");
        const size = request.headers.get("x-size");
        await buffer.done(caller, id, {
          seconds: seconds === null ? undefined : Number(seconds),
          size: size === null ? undefined : Number(size),
        });
        return new Response(null, { status: 204 });
      }
    }
    return nothing();
  } catch (error) {
    // An upload refused before it was read is read off first: answering in
    // the middle of it drops the connection, and Geotag would see a network
    // failure instead of the reason.
    if (request.body && !request.bodyUsed) await request.body.pipeTo(new WritableStream()).catch(() => {});
    if (error instanceof Refused) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "Something went wrong at bufr.cc." }, 500);
  }
}
