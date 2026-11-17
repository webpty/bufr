// The one cookie the page sets, named after the project.

const NAME = "bufr";

export function readSession(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === NAME) return rest.join("=") || null;
  }
  return null;
}

function cookie(value: string, expires: string, secure: boolean): string {
  return [`${NAME}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", secure ? "Secure" : "", `Expires=${expires}`].filter(Boolean).join("; ");
}

export const setSession = (id: string, expiresAt: Date, secure: boolean) => cookie(id, expiresAt.toUTCString(), secure);

export const clearSession = (secure: boolean) => cookie("", "Thu, 01 Jan 1970 00:00:00 GMT", secure);
