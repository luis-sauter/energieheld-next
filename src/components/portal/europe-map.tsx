"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { INITIAL_MAP_VIEW, MAP_HEIGHT, MAP_WIDTH, clampMapView, zoomMap, type MapLocation } from "@/lib/europe-map";
import { canvasMapLayout, decodeBasicMapPoints, paintMapPins, projectMapPoints } from '@/lib/map-canvas';
import { portalColors } from '@/config/portal-colors';
import styles from "./europe-map.module.css";

export function EuropeMap({ locations, loadBasics = false }: { locations: MapLocation[]; loadBasics?: boolean }) {
  const [view, setView] = useState(INITIAL_MAP_VIEW);
  const [touchActive, setTouchActive] = useState(false);
  const [pinsVisible, setPinsVisible] = useState(false);
  const [basicLocations, setBasicLocations] = useState<MapLocation[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(loadBasics ? 'loading' : 'loaded');
  const [retry, setRetry] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sprite = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const allLocations = useMemo(() => [...locations, ...(loadBasics ? basicLocations : [])], [locations, basicLocations, loadBasics]);
  const points = useMemo(() => projectMapPoints(allLocations), [allLocations]);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const zoomed = view.width < MAP_WIDTH;
  const atDefault = view.x === INITIAL_MAP_VIEW.x && view.y === INITIAL_MAP_VIEW.y && view.width === INITIAL_MAP_VIEW.width;
  const zoom = Math.round(MAP_WIDTH / view.width * 100);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setPinsVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setPinsVisible(true); observer.disconnect(); }
    }, { rootMargin: "400px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pinsVisible || !loadBasics) return;
    const controller = new AbortController();
    void fetch('/api/map-locations', { signal: controller.signal, cache: 'no-store' })
      .then(response => { if (!response.ok) throw Error('Map unavailable'); return response.json(); })
      .then(decodeBasicMapPoints)
      .then(rows => { if (!controller.signal.aborted) { setBasicLocations(rows); setLoadState('loaded'); } })
      .catch(() => { if (!controller.signal.aborted) setLoadState('error'); });
    return () => controller.abort();
  }, [pinsVisible, loadBasics, retry]);
  useEffect(() => {
    const element = canvas.current, map = svg.current;
    if (!pinsVisible || !element || !map) return;
    let frame = 0;
    const paint = () => {
      const { width, height } = map.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const context = element.getContext('2d');
      if (!context) return;
      const pixelWidth = Math.ceil(width * dpr), pixelHeight = Math.ceil(height * dpr);
      if (element.width !== pixelWidth || element.height !== pixelHeight) { element.width = pixelWidth; element.height = pixelHeight; }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const { pinUnit } = canvasMapLayout(view, width, height);
      const color = getComputedStyle(element).getPropertyValue('--portal-orange').trim() || portalColors.orange;
      const key = `${pinUnit}|${dpr}|${color}`;
      if (sprite.current?.key !== key) {
        const image = document.createElement('canvas');
        image.width = Math.ceil(16 * pinUnit * dpr); image.height = Math.ceil(22 * pinUnit * dpr);
        const pen = image.getContext('2d');
        if (!pen) return;
        pen.setTransform(pinUnit * dpr, 0, 0, pinUnit * dpr, 8 * pinUnit * dpr, 21 * pinUnit * dpr);
        const path = new Path2D('M0 0C-2.5-3.5-7-8-7-12a7 7 0 1 1 14 0C7-8 2.5-3.5 0 0Z');
        pen.fillStyle = color; pen.strokeStyle = '#fff6e9'; pen.lineWidth = .9; pen.fill(path); pen.stroke(path);
        pen.beginPath(); pen.arc(0, -12, 2.4, 0, Math.PI * 2); pen.fillStyle = '#fff6e9'; pen.fill();
        sprite.current = { key, canvas: image };
      }
      // One lightweight layer, not tens of thousands of React/SVG nodes. Every
      // in-view location is painted; this is not sampling or a result limit.
      element.dataset.renderedPins = String(paintMapPins(context, sprite.current.canvas, points, view, width, height));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(map); window.addEventListener('resize', schedule); schedule();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', schedule); };
  }, [pinsVisible, points, view]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      // Do not steal ordinary page scrolling: wheel zoom deliberately uses Ctrl.
      if (!event.ctrlKey) return;
      event.preventDefault();
      const matrix = element.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      setView(current => zoomMap(current, event.deltaY > 0 ? 1.15 : 1 / 1.15,
        { x: (point.x - current.x) / current.width, y: (point.y - current.y) / current.height }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const startDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (!zoomed || event.button !== 0 || (event.pointerType === "touch" && !touchActive)) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const previous = drag.current;
    if (!previous || previous.id !== event.pointerId) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    setView(current => clampMapView({ ...current,
      x: current.x - (event.clientX - previous.x) / matrix.a,
      y: current.y - (event.clientY - previous.y) / matrix.d }));
    drag.current = { id: previous.id, x: event.clientX, y: event.clientY };
  };
  return <section className={styles.section} aria-labelledby="locations-title" data-company-map>
    <div className="container">
      <header className={styles.header}>
        <h2 id="locations-title">Unsere Unterkünfte im Überblick</h2>
        <p>Entdecken Sie unsere Unterkünfte und ihre Standorte in Deutschland, Österreich, der Schweiz und Südtirol.</p>
        <a href="/unterkuenfte-a-z" className={styles.link}>Alle Unterkünfte entdecken <span aria-hidden="true">→</span></a>
      </header>
      <div className={styles.frame}>
        <svg ref={svg} className={styles.map} data-touch-active={touchActive} data-zoom={zoom} preserveAspectRatio="xMidYMid slice"
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-labelledby="map-title map-description"
          tabIndex={0} onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={event => {
            if (["+", "=", "-", "Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              if (event.key === "Home") setView(INITIAL_MAP_VIEW);
              else if (["+", "=", "-"].includes(event.key)) setView(current => zoomMap(current, event.key === "-" ? 1.25 : .8));
              else setView(current => clampMapView({ ...current,
                x: current.x + (event.key === "ArrowLeft" ? -.1 : event.key === "ArrowRight" ? .1 : 0) * current.width,
                y: current.y + (event.key === "ArrowUp" ? -.1 : event.key === "ArrowDown" ? .1 : 0) * current.height }));
            }
          }}>
          <title id="map-title">Unternehmensstandorte in Europa</title>
          <desc id="map-description">{allLocations.length} belegte Standorte veröffentlichter Unterkünfte und aktuell vertretener Werbekunden. {loadBasics && loadState !== 'loaded' ? 'Weitere Kartenstandorte sind noch nicht vollständig geladen. ' : ''}Mit Plus und Minus zoomen, mit Pfeiltasten oder Ziehen verschieben, mit Pos1 zurücksetzen. Keine einzelnen Standortlinks.</desc>
          <image href="/reiseportal/maps/europe.svg" x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} />
        </svg>
        <canvas ref={canvas} className={styles.pins} aria-hidden="true" data-location-count={allLocations.length} />
        <div className={styles.controls} role="group" aria-label="Kartenansicht">
          <button type="button" aria-label="Karte vergrößern" disabled={zoom >= 500} onClick={() => setView(current => zoomMap(current, .8))}>+</button>
          <button type="button" aria-label="Karte verkleinern" disabled={!zoomed} onClick={() => setView(current => zoomMap(current, 1.25))}>−</button>
          <button type="button" aria-label="Karte zurücksetzen" disabled={atDefault} onClick={() => { setView(INITIAL_MAP_VIEW); setTouchActive(false); }}>↺</button>
        </div>
      </div>
      <div className={styles.footnote}>
        {loadBasics && loadState !== 'loaded' && <p role="status" className={styles.status}>
          {loadState === 'error' ? <>Weitere Kartenstandorte konnten nicht geladen werden. <button type="button" onClick={() => { setLoadState('loading'); setRetry(value => value + 1); }}>Erneut laden</button></> : 'Kartenstandorte werden geladen…'}
        </p>}
        <p>Mit + / − zoomen und die Karte ziehen. Am Computer auch mit Strg + Mausrad.</p>
        <button className={styles.touchButton} type="button" aria-pressed={touchActive} onClick={() => setTouchActive(active => !active)}>
          {touchActive ? "Seitenscrollen aktivieren" : "Karte per Touch verschieben"}
        </button>
        <p className={styles.credit}>Karte: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> · Standorte: Betreiberangaben, Bad Birnbach Tourismus, © swisstopo / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a></p>
      </div>
    </div>
  </section>;
}
