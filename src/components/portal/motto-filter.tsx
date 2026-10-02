"use client";
import { type ReactNode, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { mottoGroup, mottoGroups, type MottoGroup } from "@/lib/motto-presentation";
import { TravelThemeIcon } from "./travel-theme-icon";
import styles from "./motto-filter.module.css";

// Server-rendered cards remain children. Only navigation state is client-side.
export function MottoFilter({ initialGroup, children }: { initialGroup: MottoGroup; children: ReactNode }) {
  const params = useSearchParams();
  const active = params ? mottoGroup(params.get("gruppe") ?? undefined) : initialGroup;
  function select(event: MouseEvent<HTMLAnchorElement>) {
    const link = event.currentTarget;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const group = mottoGroup(link.dataset.mottoGroup);
    if (group !== active) history.pushState(null, "", link.href);
  }
  return <div id="themen" className={styles.filter} data-active-group={active}>
    <nav className={styles.navigation} aria-label="Mottoreisen nach Interesse filtern">
      {mottoGroups.map(group => <a key={group.id} href={group.id === "alle" ? "/mottoreisen#themen" : `/mottoreisen?gruppe=${group.id}#themen`}
        data-motto-group={group.id} aria-current={active === group.id ? "true" : undefined} onClick={select}>
        <TravelThemeIcon slug={group.icon} />{group.label}
      </a>)}
    </nav>
    {children}
    <span className={styles.status} role="status">{mottoGroups.find(group => group.id === active)?.label} ausgewählt</span>
  </div>;
}
