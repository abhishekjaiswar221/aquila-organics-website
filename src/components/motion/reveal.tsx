"use client";

import { LazyMotion, domAnimation, m, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll reveal, built as a progressive enhancement:
 *  - Server HTML is fully visible (no-JS safe).
 *  - After hydration, only blocks that start below the fold are hidden, and never when
 *    the user prefers reduced motion.
 *  - Intersection events are not guaranteed (instant jumps, anchor navigation), so a scroll
 *    fallback makes any block that has been scrolled past visible again.
 *  - Print is handled in globals.css (`@media print [data-reveal]`).
 *
 * The same element is rendered in every state (only its animated values change), so
 * arming the reveal after hydration never remounts the children.
 */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight) setArmed(true);
  }, [reduce]);

  useEffect(() => {
    if (!armed) return;
    const onScroll = () => {
      const el = ref.current;
      if (el && el.getBoundingClientRect().bottom <= 0) setArmed(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [armed]);

  const hidden = armed && !inView;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={ref}
        data-reveal
        initial={false}
        animate={hidden ? { opacity: 0, y: 28 } : { opacity: 1, y: 0 }}
        // Hiding is instant (it happens right after hydration); showing eases in.
        transition={hidden ? { duration: 0 } : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
