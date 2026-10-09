"use client";
import { useRef, useState } from "react";
import { externalVideoEmbed } from "@/lib/external-video";
import styles from "./portal-video.module.css";

export function PortalVideo({ src, name, external = false, poster, onError }: {
  src: string; name: string; external?: boolean; poster?: string; onError?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const embed = external ? externalVideoEmbed(src) : undefined;
  if (external && !embed) return <p>Videovorschau nicht verfügbar.</p>;
  function play() {
    if (external) { setPlaying(true); return; }
    // Start in the click handler, retaining the browser's user activation on mobile.
    const result = video.current?.play();
    setPlaying(true);
    void result?.catch(() => setPlaying(false));
  }
  return <div className={styles.preview}>
    {external ? playing ? <iframe src={embed?.replace("autoplay=0", "autoplay=1") + "&dnt=1"}
      title={name} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin" /> : poster ?
      // The poster is an existing portal image, never a third-party thumbnail request.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt="" /> : <div className={styles.placeholder} aria-hidden="true" /> :
      <video ref={video} src={src} poster={poster} controls={playing} playsInline
        preload="metadata" aria-label={name} onError={onError} />}
    {!playing && <button type="button" className={styles.play} onClick={play} aria-label={`${name} abspielen`}>
      <span className={styles.playIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
      <span className={styles.caption}>{name}</span>
    </button>}
  </div>;
}
