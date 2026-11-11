type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

// The poster is the initial visual. Never compete with the initial page load,
// or download decorative motion for a hidden hero or a constrained connection.
export function observeHeroPlayback(element: Element, update: (active: boolean) => void,
  browser: Window & Pick<typeof globalThis, 'IntersectionObserver'> = window, page: Document = document,
  connection = (navigator as Navigator & { connection?: Connection }).connection) {
  const motion = browser.matchMedia('(prefers-reduced-motion: reduce)');
  let loaded = page.readyState === 'complete';
  let visible = !browser.IntersectionObserver;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = false;
  const sync = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const state = !loaded ? 'waiting-load' : !visible ? 'offscreen' : page.hidden ? 'hidden' :
      motion.matches ? 'reduced-motion' : connection?.saveData ? 'save-data' :
      ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '') ? 'slow-connection' : 'ready';
    element.setAttribute('data-hero-playback', state);
    const allowed = state === 'ready';
    if (!allowed) {
      if (active) update(false);
      active = false;
    } else if (!active) {
      timer = setTimeout(() => { active = true; element.setAttribute('data-hero-playback', 'playing'); update(true); }, 1500);
    }
  };
  const onLoad = () => { loaded = true; sync(); };
  const observer = browser.IntersectionObserver ? new browser.IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }) : undefined;
  observer?.observe(element);
  browser.addEventListener('load', onLoad);
  page.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  connection?.addEventListener('change', sync);
  sync();
  return () => {
    if (timer) clearTimeout(timer);
    observer?.disconnect();
    browser.removeEventListener('load', onLoad);
    page.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
    connection?.removeEventListener('change', sync);
  };
}
