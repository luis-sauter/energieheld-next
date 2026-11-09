import type { CSSProperties } from 'react';

// Approved corporate palette. Buttons use the original orange with white text.
// This explicit user choice does not meet AA for normal text.
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
