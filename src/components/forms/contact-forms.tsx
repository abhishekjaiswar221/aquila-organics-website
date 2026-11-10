"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { RFQ_PATH } from "@/features/enquiries/confirmation";
import type { ContactType } from "@/features/contact/schema";
import { cn } from "@/lib/utils";
import { ContactForm, type ApplicationOption } from "./contact-form";

/*
 * The four Contact forms behind one tablist (WAI-ARIA tabs, automatic
 * activation: arrow keys, Home and End move and select; only the selected tab
 * is in the Tab order). Every form stays mounted and hidden panels keep their
 * state, so switching never loses what was typed.
 */

const ORDER: readonly ContactType[] = ["GENERAL", "FRAGRANCES", "FLAVOURS", "AROMA_CHEMICALS"];

const PANELS: Record<ContactType, { tab: string; title: string; intro: string }> = {
  GENERAL: {
    tab: "General",
    title: "General enquiry",
    intro: "For anything that is not about a specific product range.",
  },
  FRAGRANCES: {
    tab: "Fragrances",
    title: "Fragrances",
    intro: "Tell us about the fragrance you are developing and where it will be used.",
  },
  FLAVOURS: {
    tab: "Flavours",
    title: "Flavours",
    intro: "Tell us about the flavour you are developing and the product it is for.",
  },
  AROMA_CHEMICALS: {
    tab: "Aroma chemicals",
    title: "Aroma chemicals",
    intro: "Questions about an aroma chemical, its documentation or its supply.",
  },
};

const slug = (type: ContactType) => type.toLowerCase().replace(/_/g, "-");
const tabId = (type: ContactType) => `contact-tab-${slug(type)}`;
const panelId = (type: ContactType) => `contact-panel-${slug(type)}`;

interface Props {
  /** From parseContactParams: already one of CONTACT_TYPES, or absent. */
  initialType?: ContactType;
  /** From parseContactParams: already a fixed slug of initialType's segment, or absent. */
  initialApplication?: string;
  applications: { FRAGRANCES: readonly ApplicationOption[]; FLAVOURS: readonly ApplicationOption[] };
  /** The flavours mailbox, shown only in the Flavours panel (absent when its block is hidden). */
  flavoursMailbox?: string;
}

export function ContactForms({ initialType, initialApplication, applications, flavoursMailbox }: Props) {
  const start = initialType ?? "GENERAL";
  const [selected, setSelected] = useState<ContactType>(start);
  // A new prefill (a different /contact?type=... URL rendered into this
  // instance) selects its form; typed data in every form is kept.
  const [prevStart, setPrevStart] = useState(start);
  if (prevStart !== start) {
    setPrevStart(start);
    setSelected(start);
  }
  const tabs = useRef<Partial<Record<ContactType, HTMLButtonElement | null>>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = ORDER.indexOf(selected);
    const n = ORDER.length;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = (i + 1) % n;
        break;
      case "ArrowLeft":
        next = (i - 1 + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const type = ORDER[next];
    setSelected(type);
    tabs.current[type]?.focus();
  }

  return (
    <div>
      <noscript>
        <p className="mb-8 border border-charcoal bg-white p-5 text-sm">
          These forms need JavaScript. You can also write to us using the email addresses on this page.
        </p>
      </noscript>

      <div
        role="tablist"
        aria-label="Enquiry type"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 border-b border-charcoal sm:flex sm:flex-wrap"
      >
        {ORDER.map((type) => {
          const active = type === selected;
          return (
            <button
              key={type}
              ref={(el) => {
                tabs.current[type] = el;
              }}
              type="button"
              role="tab"
              id={tabId(type)}
              aria-selected={active}
              aria-controls={panelId(type)}
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(type)}
              className={cn(
                "-mb-px min-h-12 border-b-2 px-4 py-3 text-left text-sm transition-colors sm:px-5",
                active
                  ? "border-charcoal font-medium text-charcoal"
                  : "border-transparent text-muted-foreground hover:border-charcoal/40 hover:text-charcoal",
              )}
            >
              {PANELS[type].tab}
            </button>
          );
        })}
      </div>

      {ORDER.map((type) => {
        const copy = PANELS[type];
        const titleId = `${panelId(type)}-title`;
        return (
          <div
            key={type}
            role="tabpanel"
            id={panelId(type)}
            aria-labelledby={tabId(type)}
            hidden={type !== selected}
            tabIndex={0}
            className="pt-8 outline-offset-4"
          >
            <h3 id={titleId} className="text-2xl sm:text-3xl">
              {copy.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.intro}</p>
            {type === "FLAVOURS" && flavoursMailbox ? (
              <p className="mt-3 text-sm leading-relaxed">
                You can also write to the flavours team at{" "}
                <a href={`mailto:${flavoursMailbox}`} className="text-bronze-text underline underline-offset-4">
                  {flavoursMailbox}
                </a>
                .
              </p>
            ) : null}
            {type === "AROMA_CHEMICALS" ? (
              <p className="mt-3 text-sm leading-relaxed">
                Need prices for several products? Use the{" "}
                <Link href={RFQ_PATH} className="text-bronze-text underline underline-offset-4">
                  quotation request form
                </Link>
                .
              </p>
            ) : null}
            <div className="mt-8">
              <ContactForm
                type={type}
                labelledBy={titleId}
                application={type === initialType ? initialApplication : undefined}
                applications={type === "FRAGRANCES" || type === "FLAVOURS" ? applications[type] : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
