import "@/components/portal/company-profile.css";
import type { CSSProperties, ReactNode } from "react";
import { reiseportal } from "@/config/reiseportal";
import { PortalHeader, PortalFooter } from "@/components/portal/chrome";
import { getPortalAccount } from "@/lib/portal-account-server";

import type { AccountIdentity } from "@/components/portal/account-menu";

export const dynamic = "force-dynamic";

export default async function ReiseportalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { access, hasCompany, user } = await getPortalAccount();
  let identity: AccountIdentity | undefined;
  if (user) {
    const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    const email = user.email || "";
    const initials = (name || email.split("@")[0]).split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toLocaleUpperCase("de");
    identity = { name, email, initials: initials || "K" };
  }
  const style = {
    "--brand-primary": reiseportal.colors.primary,
    "--brand-accent": reiseportal.colors.accent,
    "--brand-surface": reiseportal.colors.surface,
  } as CSSProperties;
  return (
    <div className="reiseportal-shell" style={style}>
      <PortalHeader brand={reiseportal} access={access} hasCompany={hasCompany} identity={identity} />
      {children}
      <PortalFooter brand={reiseportal} />
    </div>
  );
}
