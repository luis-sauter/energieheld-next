import type { CSSProperties } from 'react';

// Release 1: orange remains the brand accent. White-label primary buttons use
// the unchanged basalt brand color (#435152), with 8.276:1 text contrast.
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
