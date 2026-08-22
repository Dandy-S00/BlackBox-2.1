export function normalizeGatewayEndpoint(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter your private gateway HTTPS address.");
  let url: URL;
  try { url = new URL(trimmed); } catch { throw new Error("Enter a valid gateway URL, for example https://gateway.example.com."); }
  if (url.protocol !== "https:") throw new Error("The gateway endpoint must use HTTPS.");
  if (!url.hostname || url.hostname === "localhost" || url.hostname === "127.0.0.1") throw new Error("Use a publicly reachable gateway hostname, not localhost.");
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
