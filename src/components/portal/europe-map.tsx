"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { INITIAL_MAP_VIEW, MAP_HEIGHT, MAP_WIDTH, clampMapView, pinTransform, zoomMap, type MapLocation } from "@/lib/europe-map";
import styles from "./europe-map.module.css";

export function EuropeMap({ locations }: { locations: MapLocation[] }) {
  const [view, setView] = useState(INITIAL_MAP_VIEW);
  const [touchActive, setTouchActive] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinId = useId();
  const zoomed = view.width < MAP_WIDTH;
  const atDefault = view.x === INITIAL_MAP_VIEW.x && view.y === INITIAL_MAP_VIEW.y && view.width === INITIAL_MAP_VIEW.width;
  const zoom = Math.round(MAP_WIDTH / view.width * 100);
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
          <desc id="map-description">{locations.length} verifizierte Standorte öffentlicher Unternehmen und aktuell vertretener Werbekunden. Mit Plus und Minus zoomen, mit Pfeiltasten oder Ziehen verschieben, mit Pos1 zurücksetzen. Keine einzelnen Standortlinks.</desc>
          <defs><g id={pinId} fill="var(--portal-orange)" stroke="#fff6e9" strokeWidth=".9">
            <path d="M0 0C-2.5-3.5-7-8-7-12a7 7 0 1 1 14 0C7-8 2.5-3.5 0 0Z" />
            <circle cx="0" cy="-12" r="2.4" fill="#fff6e9" stroke="none" />
          </g></defs>
          <image href="/reiseportal/maps/europe.svg" x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} />
          <g aria-hidden="true">{locations.map(location => <use key={location.id} data-location-id={location.id}
            href={`#${pinId}`} transform={pinTransform(location, view)} />)}</g>
        </svg>
        <div className={styles.controls} role="group" aria-label="Kartenansicht">
          <button type="button" aria-label="Karte vergrößern" disabled={zoom >= 500} onClick={() => setView(current => zoomMap(current, .8))}>+</button>
          <button type="button" aria-label="Karte verkleinern" disabled={!zoomed} onClick={() => setView(current => zoomMap(current, 1.25))}>−</button>
          <button type="button" aria-label="Karte zurücksetzen" disabled={atDefault} onClick={() => { setView(INITIAL_MAP_VIEW); setTouchActive(false); }}>↺</button>
        </div>
      </div>
      <div className={styles.footnote}>
        <p>Mit + / − zoomen und die Karte ziehen. Am Computer auch mit Strg + Mausrad.</p>
        <button className={styles.touchButton} type="button" aria-pressed={touchActive} onClick={() => setTouchActive(active => !active)}>
          {touchActive ? "Seitenscrollen aktivieren" : "Karte per Touch verschieben"}
        </button>
        <p className={styles.credit}>Karte: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> · Standorte: Betreiberangaben / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a></p>
      </div>
    </div>
  </section>;
}
