// Focus and scroll only inside the media library, never the background page.
export function revealMediaDetails(container: HTMLElement, heading: HTMLElement, reducedMotion: boolean) {
    const top = Math.max(0, container.scrollTop + heading.getBoundingClientRect().top - container.getBoundingClientRect().top - 24);
    heading.focus({ preventScroll: true });
    container.scrollTo({ top, behavior: reducedMotion ? 'instant' : 'smooth' });
}
export function restoreMediaGrid(container: HTMLElement, trigger: HTMLElement | null, top: number) {
    container.scrollTo({ top, behavior: 'instant' });
    trigger?.focus({ preventScroll: true });
}
