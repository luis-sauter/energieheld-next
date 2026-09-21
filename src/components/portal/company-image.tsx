"use client";
import { useState } from "react";
import Image from "next/image";
import type { PortalImage } from "@/types/portal";

// Signed private URLs bypass the image optimizer's independent public cache.
export function CompanyImage({
  image,
  width = 160,
  height = 120,
}: {
  image: PortalImage;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span>Bild nicht verfügbar</span>;
  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={width}
      height={height}
      unoptimized
      onError={() => setFailed(true)}
      style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }}
    />
  );
}

export function CompanyLogo({
  image,
  initials,
}: {
  image?: PortalImage;
  initials: string;
}) {
  const [failed, setFailed] = useState(false);
  return image && !failed ? (
    <Image
      src={image.src}
      alt={image.alt}
      width={80}
      height={80}
      unoptimized
      onError={() => setFailed(true)}
      style={{ objectFit: "contain", width: "100%", height: "100%" }}
    />
  ) : (
    <>{initials}</>
  );
}
