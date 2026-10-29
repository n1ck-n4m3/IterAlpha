'use client';
import {useEffect, useRef, useState} from 'react';
export default function AnimatedNumber({value, format, className, animate = true}: {value: number; format: (value: number) => string; className?: string; animate?: boolean}) {
  const [display, setDisplay] = useState(value), current = useRef(value);
  useEffect(() => {
    const from = current.current, started = performance.now(), duration = !animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
    let frame: number;
    const tick = (now: number) => {const progress = duration ? Math.min(1, (now - started) / duration) : 1; const next = from + (value - from) * (1 - (1 - progress) ** 3); current.current = next; setDisplay(next); if (progress < 1) frame = requestAnimationFrame(tick);};
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [value, animate]);
  return <span className={className} aria-label={format(value)} aria-live="off">{format(display)}</span>;
}
