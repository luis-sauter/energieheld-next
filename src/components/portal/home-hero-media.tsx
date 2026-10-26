'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function HomeHeroMedia() {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      setPlay(false);
      if (!motion.matches && !connection?.saveData) timer = setTimeout(() => setPlay(true), 1500);
    };
    update();
    motion.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => { clearTimeout(timer); motion.removeEventListener('change', update); connection?.removeEventListener('change', update); };
  }, []);
  return <>
    <Image src="/reiseportal/hero-poster.webp" alt="" fill sizes="100vw" preload className="home-hero-poster" />
    {play && <video autoPlay muted loop playsInline preload="none" poster="/reiseportal/hero-poster.webp" aria-hidden="true" tabIndex={-1}>
      <source src="/reiseportal/hero-loop-mobile.mp4" media="(max-width: 700px)" type="video/mp4" />
      <source src="/reiseportal/hero-loop.mp4" type="video/mp4" />
    </video>}
  </>;
}
