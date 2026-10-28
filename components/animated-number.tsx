'use client';
import {useEffect, useRef, useState} from 'react';
export default function AnimatedNumber({value, format, className}: {value: number; format: (value: number) => string; className?: string}) {
  const [display, setDisplay] = useState(value), current = useRef(value);
  useEffect(() => {
    const from = current.current, started = performance.now(), duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
    let frame: number;
    const animate = (now: number) => {const progress = duration ? Math.min(1, (now - started) / duration) : 1; const next = from + (value - from) * (1 - (1 - progress) ** 3); current.current = next; setDisplay(next); if (progress < 1) frame = requestAnimationFrame(animate);};
    frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={className} aria-label={format(value)} aria-live="off">{format(display)}</span>;
}
