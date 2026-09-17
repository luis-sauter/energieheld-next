"use client";

import { useState } from "react";
import Image from "next/image";
import type { PortalImage } from "@/types/portal";

export function ImageGallery({
  images,
  isDemo = true,
  controls,
}: {
  images: PortalImage[];
  isDemo?: boolean;
  controls?: React.ReactNode[];
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const current = images[selected] ?? images[0];
  if (!current) return null;
  return (
    <div className="gallery">
      <div className="gallery-main">
        {failed[current.src] ? (
          <p>Bild nicht verfügbar</p>
        ) : (
          <Image
            src={current.src}
            alt={current.alt}
            unoptimized={!isDemo}
            onError={() =>
              setFailed((previous) => ({ ...previous, [current.src]: true }))
            }
            fill
            sizes="(max-width: 900px) 100vw, 70vw"
            priority
          />
        )}
        <span className="image-caption">
          {isDemo ? "Symbolbild" : "Unternehmensbild"} · {selected + 1} /{" "}
          {images.length}
        </span>
      </div>
      {controls?.[selected] && (
        <div className="gallery-edit-actions">{controls[selected]}</div>
      )}
      <div className="gallery-thumbs" aria-label="Bilderauswahl">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            aria-label={`Bild ${index + 1}: ${image.alt}`}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
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
                  setFailed((previous) => ({ ...previous, [image.src]: true }))
                }
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
