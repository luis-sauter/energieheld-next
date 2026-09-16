"use client";

import { useState } from "react";
import Image from "next/image";
import type { PortalImage } from "@/types/portal";

export function ImageGallery({ images }: { images: PortalImage[] }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="gallery">
      <div className="gallery-main">
        <Image
          src={images[selected].src}
          alt={images[selected].alt}
          fill
          sizes="(max-width: 900px) 100vw, 70vw"
          priority
        />
        <span className="image-caption">
          Symbolbild · {selected + 1} / {images.length}
        </span>
      </div>
      <div className="gallery-thumbs" aria-label="Bilderauswahl">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            aria-label={`Bild ${index + 1}: ${image.alt}`}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <Image src={image.src} alt="" width={150} height={90} />
          </button>
        ))}
      </div>
    </div>
  );
}
