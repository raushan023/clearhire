import { getToken } from "./session";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function errorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.status === 503 &&
    /resume|storage/i.test(error.message)
  )
    return "Resume storage is not configured in this environment. Please try again after storage is available.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
const base = (import.meta.env?.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
type Options = {
  method?: string;
  body?: unknown;
  raw?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  public?: boolean;
  download?: boolean;
};
async function request<T>(path: string, options: Options = {}): Promise<T> {
  const token = options.public ? null : getToken();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      signal: options.signal,
      headers: {
        ...(options.body !== undefined && !options.raw
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body:
        options.body === undefined
          ? undefined
          : options.raw
            ? (options.body as BodyInit)
            : JSON.stringify(options.body),
      credentials: "omit",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "Unable to reach ClearHire. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      errors?: Record<string, unknown>;
    };
    if (response.status === 401 && token && token === getToken())
      window.dispatchEvent(new Event("clearhire:unauthorized"));
    const fields = Object.fromEntries(
      Object.entries(payload.errors ?? {})
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [
          k,
          (v as unknown[]).filter((x): x is string => typeof x === "string"),
        ]),
    );
    const defaults: Record<number, string> = {
      400: "Please check your input.",
      401: "Please log in to continue.",
      403: "You do not have permission to access this resource.",
      404: "This resource is unavailable or private.",
      409: "The current state has changed. Refresh and try again.",
      413: "The file exceeds the upload limit.",
      415: "This file or content encoding is not supported.",
      503: "This service is currently unavailable.",
    };
    throw new ApiError(
      response.status,
      payload.message ||
        defaults[response.status] ||
        "The request failed. Please try again.",
      fields,
    );
  }
  if (options.download) return (await response.blob()) as T;
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
export const http = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  send: <T = void>(
    path: string,
    method: string,
    body?: unknown,
    options: Options = {},
  ) => request<T>(path, { ...options, method, body }),
};
export async function downloadFile(path: string, filename: string) {
  const blob = await request<Blob>(path, { download: true });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function searchQuery(
  values: URLSearchParams | Record<string, string | number | undefined>,
): string {
  const params =
    values instanceof URLSearchParams
      ? values
      : new URLSearchParams(
          Object.entries(values)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        );
  return params.size ? `?${params.toString()}` : "";
}
