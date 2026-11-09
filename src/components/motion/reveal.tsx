"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll reveal, built as a progressive enhancement:
 *  - Server HTML is fully visible (no-JS safe).
 *  - After hydration, only blocks that start below the fold are hidden, and never when
 *    the user prefers reduced motion.
 *  - Intersection events are not guaranteed (instant jumps, anchor navigation), so a scroll
 *    fallback makes any block that has been scrolled past visible again.
 *  - Print is handled in globals.css (`@media print [data-reveal]`).
 */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight) setAnimate(true);
  }, [reduce]);

  useEffect(() => {
    if (!animate) return;
    const onScroll = () => {
      const el = ref.current;
      if (el && el.getBoundingClientRect().bottom <= 0) setAnimate(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [animate]);

  if (!animate) {
    return (
      <div ref={ref} data-reveal>
        {children}
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={ref}
        data-reveal
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
