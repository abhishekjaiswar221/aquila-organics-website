"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { contacts, segments } from "@/content/site";
import { EnquiryLink } from "./enquiry-link";

export function MobileDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const close = () => dialog.current?.close();

  return (
    <>
      <button
        ref={opener}
        type="button"
        aria-label="Open menu"
        onClick={() => dialog.current?.showModal()}
        className="p-2 lg:hidden"
      >
        <Menu aria-hidden className="size-6" />
      </button>
      <dialog
        ref={dialog}
        aria-label="Site menu"
        onClose={() => opener.current?.focus()}
        className="m-0 ml-auto h-full max-h-none w-[min(24rem,100vw)] bg-ivory p-8 text-charcoal backdrop:bg-charcoal/50"
      >
        <div className="flex justify-end">
          <button type="button" aria-label="Close menu" onClick={close} className="p-2">
            <X aria-hidden className="size-6" />
          </button>
        </div>
        <nav aria-label="Mobile" className="mt-6 space-y-8">
          {segments.map((s) => (
            <div key={s.id}>
              <Link href={s.anchor} onClick={close} className="text-display-md block">
                {s.label}
              </Link>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-charcoal/20 pt-6">
            <EnquiryLink onNavigate={close} className="text-base" />
            <a href={`mailto:${contacts.sales}`} className="inline-block bg-charcoal px-6 py-3 text-sm text-ivory">
              Request a consultation
            </a>
          </div>
        </nav>
      </dialog>
    </>
  );
}
