import localFont from 'next/font/local';

// Official Google Fonts Latin WOFF2 snapshots, with OFL licenses in ./fonts.
// Two local files keep both builds and browsers independent of font services.
export const headingFont = localFont({
  src: './fonts/montserrat-latin.woff2',
  variable: '--font-montserrat',
  weight: '700',
  style: 'normal',
  display: 'swap',
  preload: true,
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

export const bodyFont = localFont({
  src: './fonts/quicksand-latin.woff2',
  variable: '--font-quicksand',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  preload: true,
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
  adjustFontFallback: 'Arial',
});
