// Everything the page asks the Worker for, in one place, so a failure is
// reported the same way wherever it happens. The Worker answers a failure
// with a key from shared/strings.ts; anything else is "could not be reached".

import type { StringKey } from "../shared/strings";
import type { Me, Overview, SettingsPatch } from "../shared/types";

export class ApiError extends Error {
  constructor(
    readonly key: StringKey,
    readonly status: number,
  ) {
    super(key);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: init.body instanceof Blob ? init.headers : { "content-type": "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError("error.noConnection", 0);
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as ({ error?: StringKey } & T) | null;
  if (!response.ok || body === null) {
    throw new ApiError(body?.error ?? (response.ok ? "error.noConnection" : "error.somethingWentWrong"), response.status);
  }
  return body;
}

export const api = {
  askForCode: (email: string, language: string) =>
    call<{ ok: true }>("/api/sign-in/code", { method: "POST", body: JSON.stringify({ email, language }) }),
  signIn: (email: string, code: string) =>
    call<{ me: Me }>("/api/sign-in/verify", { method: "POST", body: JSON.stringify({ email, code }) }),
  signOut: () => call<void>("/api/sign-out", { method: "POST" }),
  me: () => call<{ me: Me }>("/api/me"),
  saveSettings: (patch: SettingsPatch) => call<{ me: Me }>("/api/me", { method: "PATCH", body: JSON.stringify(patch) }),
  savePhoto: (photo: Blob) =>
    call<{ me: Me }>("/api/me/photo", { method: "PUT", body: photo, headers: { "content-type": photo.type } }),
  removePhoto: () => call<{ me: Me }>("/api/me/photo", { method: "DELETE" }),
  overview: () => call<Overview>("/api/overview"),
};

export const photoUrl = (me: Me) => (me.photo ? `/api/me/photo?v=${encodeURIComponent(me.photo)}` : undefined);
