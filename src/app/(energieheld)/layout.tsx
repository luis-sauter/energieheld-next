import "@/components/portal/company-profile.css";
import type { CSSProperties, ReactNode } from "react";
import { reiseportal } from "@/config/reiseportal";
import { PortalHeader, PortalFooter } from "@/components/portal/chrome";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin, type AdminAccess } from "@/lib/admin-review";
import type { AccountIdentity } from "@/components/portal/account-menu";

export const dynamic = "force-dynamic";

export default async function ReiseportalLayout({
  children,
}: {
  children: ReactNode;
}) {
  let access: AdminAccess = "unauthenticated";
  let identity: AccountIdentity | undefined;
  try {
    const client = await createClient();
    access = await checkAdmin(client);
    if (access !== "unauthenticated") {
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
        const email = user.email || "";
        const initials = (name || email.split("@")[0]).split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toLocaleUpperCase("de");
        identity = { name, email, initials: initials || "K" };
      }
    }
  } catch {
    // Public navigation remains available if account lookup is unavailable.
  }
  const style = {
    "--brand-primary": reiseportal.colors.primary,
    "--brand-accent": reiseportal.colors.accent,
    "--brand-surface": reiseportal.colors.surface,
  } as CSSProperties;
  return (
    <div className="reiseportal-shell" style={style}>
      <PortalHeader brand={reiseportal} access={access} identity={identity} />
      {children}
      <PortalFooter brand={reiseportal} />
    </div>
  );
}
