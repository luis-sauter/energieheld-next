"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { PortalImage } from "@/types/portal";

export function scheduleGalleryAdvance(advance: () => void) {
  const timer = window.setTimeout(advance, 2000);
  return () => window.clearTimeout(timer);
}

export function galleryAutoplayEnabled(autoplay: boolean, reducedMotion: boolean, paused: boolean, imageCount: number) {
  return autoplay && !reducedMotion && !paused && imageCount > 1;
}

export function ImageGallery({
  images,
  isDemo = true,
  controls,
  detailControls,
  thumbnailControls,
  addControl,
  autoplay = true,
  activeIndex,
  onSelectIndex,
}: {
  images: PortalImage[];
  isDemo?: boolean;
  controls?: React.ReactNode[];
  detailControls?: React.ReactNode[];
  thumbnailControls?: React.ReactNode[];
  addControl?: React.ReactNode;
  autoplay?: boolean;
  activeIndex?: number;
  onSelectIndex?: (index: number) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const paused = hovered || focused || touching;
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
    if (!galleryAutoplayEnabled(autoplay, reducedMotion, paused, images.length)) return;
    return scheduleGalleryAdvance(() => setSelected((index) => (index + 1) % images.length));
  }, [autoplay, reducedMotion, paused, images.length, selected, interaction]);
  function select(index: number) {
    const next = (index + images.length) % images.length;
    setSelected(next);
    onSelectIndex?.(next);
    setInteraction((value) => value + 1);
  }
  const selectedIndex = Math.min(activeIndex ?? selected, images.length - 1);
  const current = images[selectedIndex] ?? images[0];
  if (!current) return null;
  return (
    <div className="gallery" onPointerDown={() => { setTouching(true); setInteraction(value => value + 1); }}
      onPointerUp={() => setTouching(false)} onPointerCancel={() => setTouching(false)} onPointerLeave={() => setTouching(false)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}>
      <div className="gallery-main" data-has-thumbs={images.length > 1 || undefined}>
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
        {images.length > 1 && <div className="gallery-thumbs" aria-label="Bilderauswahl">
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
                    loading="lazy"
                    width={150}
                    height={90}
                    unoptimized={!isDemo}
                    onError={() =>
                      setFailed((previous) => ({ ...previous, [image.src]: true }))
                    }
                  />
                )}
              </button>
            );
            return thumbnailControls ? (
              <div className="gallery-thumbnail" key={image.src}>
                {thumbnail}
                <div className="thumbnail-edit-actions">{thumbnailControls[index]}</div>
              </div>
            ) : thumbnail;
          })}
        </div>}
      </div>
      {controls?.[selectedIndex] && (
        <div className="gallery-edit-actions">{controls[selectedIndex]}</div>
      )}
      {detailControls?.[selectedIndex] && (
        <div className="gallery-detail-controls">{detailControls[selectedIndex]}</div>
      )}
      {addControl && <div className="gallery-add-action">{addControl}</div>}
    </div>
  );
}
