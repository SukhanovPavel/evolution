import type { Profile, Preferences } from "@/domain/schemas";
export type Envelope<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string } };
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export type TransportOptions = {
  baseUrl?: string;
  getAccessToken?: () => Promise<string | null>;
};
export function createApiTransport({
  baseUrl = "",
  getAccessToken,
}: TransportOptions = {}) {
  return async function request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    const token = await getAccessToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/v1/${path}`,
      {
        ...options,
        headers,
        cache: "no-store",
        credentials: token ? "omit" : "same-origin",
      },
    );
    let body: Envelope<T>;
    try {
      body = await response.json();
    } catch {
      throw new ApiError("INVALID_RESPONSE", response.status);
    }
    if (!response.ok || body.error)
      throw new ApiError(body.error?.code ?? "REQUEST_FAILED", response.status);
    return body.data as T;
  };
}
export const request = createApiTransport();
export const api = {
  me: () => request<Profile>("me"),
  preferences: () => request<Preferences | null>("preferences"),
  saveProfile: (profile: Profile) =>
    request<Profile>("me", { method: "PATCH", body: JSON.stringify(profile) }),
  onboarding: (profile: Profile, preferences: Preferences) =>
    request("onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ profile, preferences }),
    }),
};
