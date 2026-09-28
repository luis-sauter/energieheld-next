"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { PortalImage } from "@/types/portal";

export function ImageGallery({
  images,
  isDemo = true,
  controls,
  detailControls,
  thumbnailControls,
  addControl,
  autoplay = true,
}: {
  images: PortalImage[];
  isDemo?: boolean;
  controls?: React.ReactNode[];
  detailControls?: React.ReactNode[];
  thumbnailControls?: React.ReactNode[];
  addControl?: React.ReactNode;
  autoplay?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [interaction, setInteraction] = useState(0);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!autoplay || reducedMotion || paused || images.length < 2) return;
    const timer = window.setTimeout(() => setSelected((index) => (index + 1) % images.length), 8000);
    return () => window.clearTimeout(timer);
  }, [autoplay, reducedMotion, paused, images.length, selected, interaction]);
  function select(index: number) {
    setSelected((index + images.length) % images.length);
    setInteraction((value) => value + 1);
  }
  const selectedIndex = Math.min(selected, images.length - 1);
  const current = images[selectedIndex] ?? images[0];
  if (!current) return null;
  return (
    <div className="gallery" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}>
      <div className="gallery-main">
        {failed[current.src] ? (
          <p>Bild nicht verfügbar</p>
        ) : (
          <a className="gallery-open" href={current.src} target="_blank" rel="noopener noreferrer"
            aria-label={`Bild ${selectedIndex + 1} in voller Größe öffnen`}><Image
            src={current.src}
            alt={current.alt}
            unoptimized={!isDemo}
            onError={() =>
              setFailed((previous) => ({ ...previous, [current.src]: true }))
            }
            fill
            sizes="(max-width: 900px) 100vw, 70vw"
            priority
          /></a>
        )}
        {images.length > 1 && <div className="gallery-navigation" aria-label="Galerie steuern">
          <button type="button" aria-label="Vorheriges Bild" onClick={() => select(selectedIndex - 1)}>‹</button>
          <button type="button" aria-label="Nächstes Bild" onClick={() => select(selectedIndex + 1)}>›</button>
        </div>}
        <span className="image-caption">
          {isDemo ? "Symbolbild" : "Unternehmensbild"} · {selectedIndex + 1} /{" "}
          {images.length}
        </span>
      </div>
      {controls?.[selectedIndex] && (
        <div className="gallery-edit-actions">{controls[selectedIndex]}</div>
      )}
      {detailControls?.[selectedIndex] && (
        <div className="gallery-detail-controls">{detailControls[selectedIndex]}</div>
      )}
      <div className="gallery-thumbs" aria-label="Bilderauswahl">
        {images.map((image, index) => {
          const thumbnail = (
            <button
              key={image.src}
              type="button"
              aria-label={`Bild ${index + 1}: ${image.alt}`}
              aria-pressed={selectedIndex === index}
              onClick={() => select(index)}
            >
              {failed[image.src] ? (
                <span>Bild {index + 1}</span>
              ) : (
                <Image
                  src={image.src}
                  alt=""
                  width={150}
                  height={90}
                  unoptimized={!isDemo}
                  onError={() =>
                    setFailed((previous) => ({
                      ...previous,
                      [image.src]: true,
                    }))
                  }
                />
              )}
            </button>
          );
          return thumbnailControls ? (
            <div className="gallery-thumbnail" key={image.src}>
              {thumbnail}
              <div className="thumbnail-edit-actions">
                {thumbnailControls[index]}
              </div>
            </div>
          ) : (
            thumbnail
          );
        })}
        {addControl}
      </div>
    </div>
  );
}
