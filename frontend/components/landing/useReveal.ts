import { useEffect, useRef, useState } from 'react';

// Content is visible at rest (only a small translateY), never opacity:0 --
// matches Landing.module.css's .rv/.rvIn pair. Fires once via
// IntersectionObserver, then disconnects; skipped entirely for
// prefers-reduced-motion since .rv:not(.rvIn) already collapses to
// transform:none in that case, so there's nothing to animate anyway.
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect(); }
    }, { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}
