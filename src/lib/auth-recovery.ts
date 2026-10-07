import type { SupabaseClient } from "@supabase/supabase-js";

export const recoveryLinkError = "Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.";
export const recoveryRequestMessage = "Wenn zu dieser E-Mail-Adresse ein Konto besteht, haben wir Ihnen einen Link zum Zurücksetzen des Passworts geschickt. Bitte prüfen Sie auch Ihren Spam-Ordner.";

// Only allow known portal hosts. Never trust a caller-supplied redirect/next URL.
export function authRedirectUrl(origin: string | null, path: "/auth/confirm" | "/auth/recovery") {
  if (!origin) throw new Error("Missing portal origin");
  const url = new URL(origin);
  const allowed = ["das-reiseportal.com", "www.das-reiseportal.com", "startling-choux-aaa598.netlify.app", "feature-portal-frontend--startling-choux-aaa598.netlify.app"];
  const immutable = /^[a-f0-9]{24}--startling-choux-aaa598\.netlify\.app$/.test(url.hostname);
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (!local && (url.protocol !== "https:" || url.port || (!allowed.includes(url.hostname) && !immutable))) ||
      (local && !["http:", "https:"].includes(url.protocol))) throw new Error("Invalid portal origin");
  return new URL(path, url.origin).href;
}

export function authCallbackOrigin(request: { url: string; headers: Headers }) {
  // Netlify can normalize request.url to the branch alias. Keep callbacks on
  // the actual incoming host so the SSR cookies stay on the same QA deploy.
  const host = request.headers.get("host");
  const url = new URL(request.url);
  const candidate = host ? `${url.protocol}//${host}` : url.origin;
  try { return new URL(authRedirectUrl(candidate, "/auth/confirm")).origin; }
  catch { return new URL(authRedirectUrl(new URL(request.url).origin, "/auth/confirm")).origin; }
}

export function validateRecoveryEmail(form: FormData) {
  const input = form.get("email");
  const email = typeof input === "string" ? input.trim() : "";
  return { email, error: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : "Bitte geben Sie eine gültige E-Mail-Adresse ein." };
}

export function validateNewPassword(form: FormData) {
  const password = form.get("password");
  const confirmation = form.get("password_confirmation");
  if (typeof password !== "string" || password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  if (password !== confirmation) return { error: "Die Passwörter stimmen nicht überein." };
  return { password };
}

export function hasRecentRecovery(claims: Record<string, unknown> | undefined, now = Date.now()) {
  // These are cryptographically verified getClaims results, never decoded client data.
  return Boolean(claims?.sub && Array.isArray(claims.amr) && claims.amr.some((entry) =>
    entry?.method === "recovery" && typeof entry.timestamp === "number" &&
    entry.timestamp <= now / 1000 && entry.timestamp > now / 1000 - 1800));
}

export async function validRecoverySession(client: SupabaseClient) {
  const { data, error } = await client.auth.getClaims();
  if (error || !hasRecentRecovery(data?.claims)) return false;
  // Also reject sessions revoked at Auth, rather than relying on an unexpired JWT alone.
  const user = await client.auth.getUser();
  return !user.error && Boolean(user.data.user && user.data.user.id === data?.claims.sub);
}
