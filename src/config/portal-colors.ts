import type { CSSProperties } from 'react';

// Release 1 palette supplied by the user. Orange/white primary buttons are an
// explicit design decision: 2.337:1 contrast, not WCAG AA for normal-size text.
export const portalColors = {
  orange: '#F7902F',
  blue: '#13237F',
  basalt: '#435152',
  'light-orange': '#FDF1E4',
  'light-gray': '#F4F4F4',
  white: '#FFFFFF',
} as const;

export const portalColorVariables = Object.fromEntries(
  Object.entries(portalColors).map(([name, value]) => [`--portal-${name}`, value]),
) as CSSProperties;
