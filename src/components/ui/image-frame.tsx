import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  src?: string;
  alt: string;
  ratio: "4/5" | "3/2" | "16/9";
  /** Visible only in development: what the client must supply. */
  label?: string;
  className?: string;
}

const ratios = { "4/5": "aspect-[4/5]", "3/2": "aspect-[3/2]", "16/9": "aspect-video" } as const;

export function ImageFrame({ src, alt, ratio, label, className }: Props) {
  return (
    <div className={cn("relative overflow-hidden bg-cream", ratios[ratio], className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex items-end bg-gradient-to-br from-cream to-warm-grey/40 p-4"
        >
          {process.env.NODE_ENV !== "production" && label ? (
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Placeholder: {label}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
