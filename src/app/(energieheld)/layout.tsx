import "@/components/portal/company-profile.css";
import type { CSSProperties, ReactNode } from "react";
import { reiseportal } from "@/config/reiseportal";
import { portalColorVariables } from '@/config/portal-colors';
import { PortalHeader, PortalFooter } from "@/components/portal/chrome";
import { SignedImageRecovery } from '@/components/portal/signed-image-recovery';
import { getPortalAccount } from "@/lib/portal-account-server";

import { getEditorialQueue } from "@/lib/editorial-queue-server";
import {loadPublicNewBadges} from '@/lib/new-badge.server';
import {NewBadgeProvider} from '@/components/portal/new-badge-context';
import type { AccountIdentity } from "@/components/portal/account-menu";

export const dynamic = "force-dynamic";

export default async function ReiseportalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [{ access, hasCompany, user },badges] = await Promise.all([getPortalAccount(),loadPublicNewBadges()]);
  const queue = access === "admin" ? await getEditorialQueue() : undefined;
  let identity: AccountIdentity | undefined;
  if (user) {
    const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    const email = user.email || "";
    const initials = (name || email.split("@")[0]).split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toLocaleUpperCase("de");
    identity = { name, email, initials: initials || "K" };
  }
  const style = {
    ...portalColorVariables,
    "--brand-primary": reiseportal.colors.primary,
    "--brand-accent": reiseportal.colors.accent,
    "--brand-surface": reiseportal.colors.surface,
  } as CSSProperties;
  // This request-time value is serialized for matching server/client badge rendering.
  // eslint-disable-next-line react-hooks/purity -- Async Server Component: capture once per request, not on client rerenders.
  const badgeNow = Date.now();
  return (
    <div className="reiseportal-shell" style={style}>
      <NewBadgeProvider rows={badges} now={badgeNow}>
      <SignedImageRecovery />
      <PortalHeader brand={reiseportal} access={access} hasCompany={hasCompany} identity={identity} taskCounts={queue?.counts} taskError={queue?.error} />
      {children}
      <PortalFooter brand={reiseportal} />
      </NewBadgeProvider>
    </div>
  );
}
