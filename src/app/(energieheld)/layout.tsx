import type { CSSProperties, ReactNode } from "react";
import { energieheld } from "@/config/energieheld";
import { PortalHeader, PortalFooter } from "@/components/portal/chrome";

export default function EnergieheldLayout({
  children,
}: {
  children: ReactNode;
}) {
  const style = {
    "--brand-primary": energieheld.colors.primary,
    "--brand-accent": energieheld.colors.accent,
    "--brand-surface": energieheld.colors.surface,
  } as CSSProperties;
  return (
    <div style={style}>
      <PortalHeader brand={energieheld} />
      {children}
      <PortalFooter brand={energieheld} />
    </div>
  );
}
