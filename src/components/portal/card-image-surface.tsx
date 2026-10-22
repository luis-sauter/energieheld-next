"use client";
import { createContext, useContext, useState, type ReactNode, type ComponentProps } from "react";
import Image from "next/image";
import type { PortalImage } from "@/types/portal";
import { imageCropStyle, type ImageCrop } from "@/lib/image-crop";
import dynamic from 'next/dynamic.js';

const CardImageEditor = dynamic(() => import('./card-image-editor').then(module => module.CardImageEditor));

type SavedImage = { image: PortalImage; assetId: string; crop: ImageCrop };
const Context = createContext<{ value: SavedImage | null; saved: (value: SavedImage) => void } | null>(null);

// Server-rendered card copy stays unchanged; only the admin image needs local state.
export function CardImageSurface({ children, className = "accommodation-card" }: { children: ReactNode; className?: string }) {
  const [value, saved] = useState<SavedImage | null>(null);
  return <Context.Provider value={{ value, saved }}><article className={className}>{children}</article></Context.Provider>;
}
export function CardImagePhoto({ image, crop, sizes, initials, fit = "cover" }: { image?: PortalImage; crop?: ImageCrop; sizes?: string; initials?: string; fit?: "cover" | "contain" }) {
  const context = useContext(Context);
  const current = context?.value?.image ?? image, frame = context?.value?.crop ?? crop;
  if (!current) return <span aria-hidden="true">{initials}</span>;
  return <Image src={current.src} alt={current.alt} fill loading="lazy" unoptimized={/^https?:\/\//.test(current.src)}
    sizes={sizes ?? "(max-width: 700px) calc(100vw - 48px), 430px"} style={frame ? imageCropStyle(frame) : { objectFit: fit }} />;
}
export function CardImageEditButton(props: ComponentProps<typeof CardImageEditor>) {
  const context = useContext(Context);
  return <CardImageEditor {...props} image={context?.value?.image ?? props.image} crop={context?.value?.crop ?? props.crop}
    assetId={context?.value?.assetId ?? props.assetId} onSaved={context?.saved} />;
}
