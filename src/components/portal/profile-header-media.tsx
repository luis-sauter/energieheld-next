"use client";
import { PortalVideo } from "./portal-video";
import { useState, type ReactNode } from "react";
import type { Listing } from "@/types/portal";

export function ProfileHeaderMedia({ video, name, gallery }: { video?: Listing["video"]; name: string; gallery: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return video && !failed ? <PortalVideo {...video} name={`Video von ${name}`} onError={() => setFailed(true)} /> : gallery;
}
