import type { CSSProperties } from "react";

const paths: Record<string, string> = {
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  leaf: "M20 3C6 2 2 8 5 15s15 7 15-12ZM4 21 15 10",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  heat: "M7 3C1 8 13 11 7 16m5-13c-6 5 6 8 0 13m5-13c-6 5 6 8 0 13M4 21h16",
  bolt: "m13 2-9 12h7l-1 8 10-13h-8l1-7Z",
  home: "m2 11 10-9 10 9M5 9v13h14V9M10 22v-8h4v8",
  window: "M3 2h18v20H3ZM12 2v20M3 12h18",
  check: "m5 12 4 4L19 6",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-5 10 3 3 7-7",
  mail: "M2 4h20v16H2ZM2 4l10 9L22 4",
  phone: "M6 2h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 2-2 4-4 4C9 22 2 15 2 6c0-2 2-4 4-4Z",
  globe:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2c6 6 6 14 0 20-6-6-6-14 0-20",
  menu: "M3 6h18M3 12h18M3 18h18",
};
export function Icon({
  name,
  size = 22,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.home} />
    </svg>
  );
}
