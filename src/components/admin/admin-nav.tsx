"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/enquiries", label: "Enquiries" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1">
        {LINKS.map((l) => {
          const current = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center px-3 text-sm text-ivory hover:bg-ivory/10",
                  current && "bg-ivory/15 font-semibold underline decoration-bronze underline-offset-[6px]",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
