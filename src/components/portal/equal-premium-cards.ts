"use client";

// Measure the current natural content, not a fixed/clipped text allowance.
// Banner rows and Basic cards retain their own height. No per-card observers.
export function equalPremiumCards(root: HTMLElement | null) {
  if (!root) return;
  let frame = 0, width = -1, active = true;
  const measure = () => {
    frame = 0;
    root.style.setProperty("--premium-card-height", "0px");
    const cards = root.querySelectorAll<HTMLElement>(".listing-row--premium");
    const height = Math.ceil(Math.max(0, ...Array.from(cards, card => card.getBoundingClientRect().height)));
    root.style.setProperty("--premium-card-height", `${height}px`);
  };
  const schedule = () => {
    if (active && !frame) frame = requestAnimationFrame(measure);
  };
  const resize = new ResizeObserver(() => {
    const next = root.getBoundingClientRect().width;
    if (next !== width) { width = next; schedule(); }
  });
  resize.observe(root);
  const content = new MutationObserver(schedule);
  content.observe(root, { childList: true, subtree: true, characterData: true });
  void document.fonts.ready.then(schedule);
  schedule();
  return () => {
    active = false;
    resize.disconnect(); content.disconnect(); cancelAnimationFrame(frame);
    root.style.removeProperty("--premium-card-height");
  };
}
