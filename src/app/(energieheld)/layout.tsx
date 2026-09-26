import "@/components/portal/company-profile.css";
import type { CSSProperties, ReactNode } from "react";
import { reiseportal } from "@/config/reiseportal";
import { PortalHeader, PortalFooter } from "@/components/portal/chrome";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin, type AdminAccess } from "@/lib/admin-review";

export const dynamic = "force-dynamic";

export default async function ReiseportalLayout({
  children,
}: {
  children: ReactNode;
}) {
  let access: AdminAccess = "unauthenticated";
  try {
    access = await checkAdmin(await createClient());
  } catch {
    // Public navigation remains available if account lookup is unavailable.
  }
  const style = {
    "--brand-primary": reiseportal.colors.primary,
    "--brand-accent": reiseportal.colors.accent,
    "--brand-surface": reiseportal.colors.surface,
  } as CSSProperties;
  return (
    <div style={style}>
      <PortalHeader brand={reiseportal} access={access} />
      {children}
      <PortalFooter brand={reiseportal} access={access} />
    </div>
  );
}
