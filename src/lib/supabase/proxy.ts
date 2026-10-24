import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  // Match the SDK's default storage key, including chunked session cookies.
  // With no session to refresh, do not load the auth SDK into this request.
  // Protected pages/actions still perform their own verified authorization.
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  if (!request.cookies.getAll().some(({ name }) => name === storageKey || name.startsWith(`${storageKey}.`)))
    return response;

  const { createServerClient } = await import("@supabase/ssr");

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        const previousResponse = response;
        response = NextResponse.next({ request });
        previousResponse.cookies.getAll().forEach((cookie) =>
          response.cookies.set(cookie),
        );
        previousResponse.headers.forEach((value, name) => {
          if (["cache-control", "expires", "pragma"].includes(name)) {
            response.headers.set(name, value);
          }
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}
