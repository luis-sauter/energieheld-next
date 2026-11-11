'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { observeHeroPlayback } from '@/lib/home-hero-playback';

export function HomeHeroMedia() {
  const poster = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!poster.current) return;
    return observeHeroPlayback(poster.current, playing => {
      if (playing) setLoaded(true);
      setActive(playing);
    });
  }, []);
  useEffect(() => {
    if (!video.current) return;
    if (active) void video.current.play().catch(() => { /* Poster remains when autoplay is blocked. */ });
    else video.current.pause();
  }, [active, loaded]);
  return <>
    <Image ref={poster} data-video-error={failed || undefined} src="/reiseportal/hero-poster.webp" alt="" fill sizes="100vw" preload className="home-hero-poster" />
    {loaded && !failed && <video ref={video} autoPlay={active} muted loop playsInline preload="none" poster="/reiseportal/hero-poster.webp" aria-hidden="true" tabIndex={-1} onError={event => { if (event.currentTarget.error) setFailed(true); }}>
      <source src="/reiseportal/hero-loop-mobile-v2.mp4" media="(max-width: 700px)" type="video/mp4" />
      <source src="/reiseportal/hero-loop-v2.mp4" type="video/mp4" />
    </video>}
  </>;
}
