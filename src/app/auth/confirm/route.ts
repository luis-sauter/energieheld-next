import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authCallbackOrigin } from "@/lib/auth-recovery";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/login?error=confirmation";
  // This endpoint only confirms registration emails, not recovery or email changes.
  if ((token_hash && (type === "email" || type === "signup")) || (code && !token_hash && !type)) {
    try {
      const supabase = await createClient();
      const result = token_hash && (type === "email" || type === "signup")
        ? await supabase.auth.verifyOtp({ token_hash, type })
        : await supabase.auth.exchangeCodeForSession(code!);
      if (!result.error) {
        if (token_hash) destination = "/firma?willkommen=1";
        else {
          const { data, error } = await supabase.auth.getClaims();
          if (!error && data?.claims.amr?.some((entry) => typeof entry !== "string" && entry.method === "email/signup")) destination = "/firma?willkommen=1";
        }
      }
    } catch {
      // Use the same understandable error page for expired links and network errors.
    }
  }
  const response = NextResponse.redirect(new URL(destination, authCallbackOrigin(request)));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
