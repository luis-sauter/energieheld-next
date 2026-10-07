import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validRecoverySession } from "@/lib/auth-recovery";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/passwort-vergessen?error=recovery";
  if ((token_hash && type === "recovery") || (code && !token_hash && !type)) {
    try {
      const client = await createClient();
      const result = token_hash && type === "recovery"
        ? await client.auth.verifyOtp({ token_hash, type: "recovery" })
        : await client.auth.exchangeCodeForSession(code!);
      if (!result.error && await validRecoverySession(client)) destination = "/passwort-zuruecksetzen";
    } catch {
      // No token, code, credential or provider details in errors/logs.
    }
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
