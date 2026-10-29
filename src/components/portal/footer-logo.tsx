import { portalIdentity } from '@/config/portal-identity';

// Recolor the original contours in the browser; the approved source stays intact.
// Separating the blue/orange ink also removes the JPEG's neutral background.
export function FooterLogo() {
 return <svg viewBox="0 0 1600 533" width="1600" height="533" role="img" aria-label="DAS Reiseportal.com – 15 Jahre">
  <defs><filter id="footer-logo-ink" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
   <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -3 0 3 0 0" result="whiteInk"/>
   <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 .56  0 0 0 0 0  2 0 -2 0 0" result="orangeInk"/>
   <feMerge><feMergeNode in="whiteInk"/><feMergeNode in="orangeInk"/></feMerge>
  </filter></defs>
  <circle cx="1295" cy="162" r="69" fill="white"/>
  <image href={portalIdentity.logo.src} width="1600" height="533" filter="url(#footer-logo-ink)"/>
 </svg>;
}
