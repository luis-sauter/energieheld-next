"use client";
import { useState, type ReactNode } from "react";
import type { Listing } from "@/types/portal";

export function ProfileHeaderMedia({ video, name, gallery }: { video?: Listing["video"]; name: string; gallery: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return video && !failed ? <video className="profile-video" src={video.src} poster={video.poster}
    controls playsInline preload="metadata" aria-label={`Video von ${name}`} onError={() => setFailed(true)} /> : gallery;
}
