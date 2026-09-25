import "@/components/portal/company-profile.css";
import type { CSSProperties, ReactNode } from "react";
import { reiseportal } from "@/config/reiseportal";
import { PortalHeader, PortalFooter } from "@/components/portal/chrome";

export default function EnergieheldLayout({
  children,
}: {
  children: ReactNode;
}) {
  const style = {
    "--brand-primary": reiseportal.colors.primary,
    "--brand-accent": reiseportal.colors.accent,
    "--brand-surface": reiseportal.colors.surface,
  } as CSSProperties;
  return (
    <div style={style}>
      <PortalHeader brand={reiseportal} />
      {children}
      <PortalFooter brand={reiseportal} />
    </div>
  );
}
