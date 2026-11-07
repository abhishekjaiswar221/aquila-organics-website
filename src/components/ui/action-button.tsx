import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "link";

type Props =
  | { href: string; onClick?: never; variant: Variant; children: ReactNode; className?: string }
  | { href?: never; onClick: () => void; variant: Variant; children: ReactNode; className?: string };

const styles: Record<Variant, string> = {
  primary:
    "bg-charcoal text-ivory px-7 py-3.5 hover:bg-bronze-text focus-visible:bg-bronze-text",
  secondary:
    "border border-charcoal text-charcoal px-7 py-3.5 hover:bg-charcoal hover:text-ivory",
  link: "text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2",
};

const base =
  "inline-flex items-center justify-center gap-2 text-sm font-medium tracking-wide transition-colors rounded-sm";

export function ActionButton(props: Props) {
  const cls = cn(base, styles[props.variant], props.className);
  if (props.href !== undefined) {
    const external = /^(mailto:|tel:|https?:)/.test(props.href);
    return external ? (
      <a href={props.href} className={cls}>{props.children}</a>
    ) : (
      <Link href={props.href} className={cls}>{props.children}</Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={cls}>
      {props.children}
    </button>
  );
}
