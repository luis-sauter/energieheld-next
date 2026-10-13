import Image from "next/image";
import { travelThemes } from "@/data/reiseportal-discovery";
import { discoveryAudienceShortcuts, discoveryShortcutHref } from "@/lib/discovery-shortcuts";
import { ThemeScroller } from "./theme-scroller";
import { TravelThemeIcon } from "./travel-theme-icon";

// The same server-rendered links and existing motion controller on home/profiles.
// No profile-dependent taxonomy query, route prefetch or copied slider logic.
export function TravelQuicklinks({ className = "" }: { className?: string }) {
  const discoveryAudiences = discoveryAudienceShortcuts();
  return <nav className={className} aria-label="Schnell zu Mottoreisen und Mit wem?" data-travel-quicklinks>
    <ThemeScroller count={travelThemes.length + discoveryAudiences.length} label="Mottoreisen" compact>
      {discoveryAudiences.map((entry) => <a key={`audience:${entry.slug}`} href={discoveryShortcutHref("audience", entry.slug)} data-theme-image>
        <Image src={entry.image} alt="" fill sizes="(max-width: 640px) 45vw, (max-width: 1100px) 23vw, 200px" loading="lazy" />
        <span className="travel-quicklink-icon" aria-hidden="true"><TravelThemeIcon slug={entry.icon} /></span><span>{entry.label}</span>
      </a>)}
      {travelThemes.map((entry) => <a key={entry.slug} href={discoveryShortcutHref("theme", entry.slug)} data-theme-image>
        <Image src={`/reiseportal/redesign/mottoreisen/${entry.slug}.webp`} alt="" fill sizes="(max-width: 640px) 45vw, (max-width: 1100px) 23vw, 200px" loading="lazy" />
        <span className="travel-quicklink-icon" aria-hidden="true"><TravelThemeIcon slug={entry.slug} /></span>
        <span>{entry.title}</span>
      </a>)}
    </ThemeScroller>
  </nav>;
}
