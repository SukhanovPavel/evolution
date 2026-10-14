export function appOrigin(fallback: string) {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) return new URL(fallback).origin;
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("INVALID_APP_URL");
  return url.origin;
}
