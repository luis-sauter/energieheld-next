import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { robotsHeader } from "@/lib/site-seo";

export async function proxy(request: NextRequest) {
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
