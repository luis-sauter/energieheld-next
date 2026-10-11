"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

export function loadsPortalData(href: ComponentProps<typeof NextLink>["href"]) {
  const pathname = typeof href === "string" ? href.split(/[?#]/, 1)[0] : href.pathname;
  return pathname === "/" || /^\/(reiseziele|mottoreisen|unterkuenfte|unterkuenfte-a-z|suche)(\/|$)/.test(pathname ?? "");
}

// These routes load galleries/search data. A visible link must not start that
// database work in the background, including duplicate desktop/mobile links.
export default function NavigationLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={loadsPortalData(props.href) ? false : props.prefetch} />;
}
