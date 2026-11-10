import Link from "next/link";
import { company, contacts, headerNav } from "@/content/site";
import { EnquiryLink } from "./enquiry-link";
import { MegaMenu } from "./mega-menu";
import { MobileDrawer } from "./mobile-drawer";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-ivory/95 backdrop-blur">
      <div className="hidden bg-charcoal text-ivory sm:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2 text-xs">
          <span>{contacts.hours}</span>
          <span className="flex flex-wrap gap-x-6 gap-y-1">
            <a href={`tel:${contacts.phoneAromaChemicals.tel}`}>
              Aroma chemicals {contacts.phoneAromaChemicals.display}
            </a>
            <a href={`tel:${contacts.phoneFragrancesFlavours.tel}`}>
              Fragrances and flavours {contacts.phoneFragrancesFlavours.display}
            </a>
          </span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl uppercase tracking-[0.12em]">
          {company.shortName}
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-10 lg:flex">
          <MegaMenu />
          {headerNav
            .filter((item) => item.available)
            .map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium tracking-wide">
                {item.label}
              </Link>
            ))}
          <EnquiryLink />
          <Link
            href="/contact"
            className="bg-charcoal px-6 py-3 text-sm font-medium tracking-wide text-ivory transition-colors hover:bg-bronze-text"
          >
            Request a consultation
          </Link>
        </nav>
        <MobileDrawer />
      </div>
    </header>
  );
}
