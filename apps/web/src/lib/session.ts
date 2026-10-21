import type { Role } from "./types";
const key = "clearhire.accessToken";
let memoryToken: string | null = null;
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(key) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}
export function setToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(key, token);
    else sessionStorage.removeItem(key);
  } catch {
    /* Per-tab memory is sufficient when storage is disabled. */
  }
}
export function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function loginDestination(role: Role, from?: string): string {
  const base = `/${role}`;
  return typeof from === "string" &&
    (from === base ||
      from.startsWith(base + "/") ||
      from.startsWith(base + "?"))
    ? from
    : base;
}
