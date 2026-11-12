import { NextResponse, type NextRequest } from "next/server";
import { legacyTravelRedirect, legacyProfileRewrite } from '@/lib/legacy-travel-redirect';
import { updateSession } from "@/lib/supabase/proxy";
import { robotsHeader } from "@/lib/site-seo";

export async function proxy(request: NextRequest) {
  const legacy = ['GET', 'HEAD'].includes(request.method)
    ? legacyTravelRedirect(request.nextUrl.pathname, request.nextUrl.search) : null;
  if (legacy) return NextResponse.redirect(new URL(legacy, request.url), 308);
  const profile = ['GET', 'HEAD'].includes(request.method) ? legacyProfileRewrite(request.nextUrl.pathname) : null;
  if (profile) return NextResponse.rewrite(new URL(profile, request.url));
  const response = await updateSession(request);
  const robots = robotsHeader(request.nextUrl.pathname);
  if (robots) response.headers.set("X-Robots-Tag", robots);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
