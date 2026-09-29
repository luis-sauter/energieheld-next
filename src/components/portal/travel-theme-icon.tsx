export function TravelThemeIcon({ slug }: { slug: string }) {
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icon = slug === "wellnessangebote" ? <><path d="M12 21c-4-3-6-6-6-10 3 0 5 1 6 4 1-3 3-4 6-4 0 4-2 7-6 10Z" /><path d="M12 15c-2-3-2-6 0-9 2 3 2 6 0 9ZM4 17c-1-1-2-3-2-5M20 17c1-1 2-3 2-5" /></>
    : slug === "familienurlaub" ? <><circle cx="8" cy="7" r="2" /><circle cx="16" cy="7" r="2" /><path d="M3 19v-5a5 5 0 0 1 10 0v5M11 19v-5a5 5 0 0 1 10 0v5M7 20v-5m10 5v-5" /></>
    : slug === "wanderurlaub" ? <><path d="m2 20 7-12 4 6 2-3 7 9H2Z" /><path d="m7 13 2-2 2 2" /></>
    : slug === "romantik-zu-zweit" ? <path d="M12 21 3.5 12.5a5 5 0 0 1 7-7L12 7l1.5-1.5a5 5 0 0 1 7 7L12 21Z" />
    : slug === "campingurlaub" ? <><path d="M2 20 12 4l10 16H2ZM12 4v16M8 20l4-7 4 7" /></>
    : slug === "radwandern" ? <><circle cx="5" cy="17" r="3" /><circle cx="19" cy="17" r="3" /><path d="m5 17 4-9 4 9h6l-5-9H9m4 9-4-9m4-3h3" /></>
    : slug === "urlaub-am-wasser" ? <><path d="M2 15c2 0 2 2 5 2s3-2 5-2 2 2 5 2 3-2 5-2M2 20c2 0 2 2 5 2s3-2 5-2 2 2 5 2 3-2 5-2" /><circle cx="17" cy="6" r="3" /><path d="M2 11h8" /></>
    : <><path d="M5 21V4m0 1c4-2 7 2 11 0v7c-4 2-7-2-11 0M3 21h5" /><circle cx="18" cy="18" r="2" /></>;
  return <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" {...shared}>{icon}</svg>;
}
