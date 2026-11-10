"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { segments } from "@/content/site";

export function MegaMenu() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="segment-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium tracking-wide"
      >
        What we make
        <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id="segment-menu"
        hidden={!open}
        className="absolute left-1/2 top-full z-50 mt-6 w-[56rem] max-w-[90vw] -translate-x-1/2 border border-border bg-ivory p-10 shadow-xl"
      >
        <div className="grid grid-cols-3 gap-10">
          {segments.map((s) => (
            <div key={s.id}>
              <Link
                href={s.href}
                onClick={() => setOpen(false)}
                className="text-display-md block hover:text-bronze-text"
              >
                {s.label}
              </Link>
              <ul className="mt-4 space-y-1.5 text-sm">
                {s.items.map((i) => (
                  <li key={i.href + i.label}>
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      className="inline-block py-0.5 text-muted-foreground underline-offset-4 hover:text-charcoal hover:underline"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
