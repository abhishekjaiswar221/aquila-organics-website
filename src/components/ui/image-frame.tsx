import Image from "next/image";
import { getImage, type ImageSlot } from "@/content/images";
import { cn } from "@/lib/utils";

interface Props {
  /** The registered photo for this slot (src/content/images.ts). With none registered, a neutral placeholder shows. */
  slot?: ImageSlot;
  /** Alt text for the placeholder. A registered photo brings its own alt text. */
  alt: string;
  ratio: "4/5" | "3/2" | "16/9";
  /** Visible only in development: what the client must supply. */
  label?: string;
  className?: string;
  /** Above-the-fold photo: loads eagerly and is preloaded. */
  priority?: boolean;
  /** Overrides the default responsive `sizes` hint. */
  sizes?: string;
}

const ratios = { "4/5": "aspect-[4/5]", "3/2": "aspect-[3/2]", "16/9": "aspect-video" } as const;
const DEFAULT_SIZES = "(min-width: 1024px) 50vw, 100vw";

export function ImageFrame({ slot, alt, ratio, label, className, priority, sizes }: Props) {
  const image = slot ? getImage(slot) : undefined;
  return (
    <div className={cn("relative overflow-hidden bg-cream", ratios[ratio], className)}>
      {image ? (
        <Image
          src={image.file}
          alt={image.alt}
          fill
          sizes={sizes ?? DEFAULT_SIZES}
          placeholder="blur"
          blurDataURL={image.blurDataURL}
          priority={priority}
          className="object-cover"
        />
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
