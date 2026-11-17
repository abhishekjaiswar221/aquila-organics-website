import Image from "next/image";
import { imageFileData, type GalleryItem } from "@/content/images";

/**
 * A captioned set of product-format photographs in even 4:5 tiles (the same shape as the flavour tiles on the home
 * page), each cropped to the centre. Items whose file was never prepared are skipped.
 */
export function ImageGallery({ heading, items }: { heading: string; items: readonly GalleryItem[] }) {
  const ready = items.flatMap((item) => {
    const data = imageFileData(item.file);
    return data ? [{ item, data }] : [];
  });
  if (ready.length === 0) return null;
  // Four items sit in one row on wide screens; any other count uses three columns.
  const columns = ready.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <section aria-labelledby="gallery-heading" className="mx-auto max-w-7xl px-6 pb-16 lg:pb-24">
      <h2 id="gallery-heading" className="text-display-md">
        {heading}
      </h2>
      <div className={`mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 ${columns}`}>
        {ready.map(({ item, data }) => (
          <figure key={item.file}>
            <div className="relative aspect-[4/5] overflow-hidden bg-cream">
              <Image
                src={item.file}
                alt={item.alt}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 100vw"
                placeholder="blur"
                blurDataURL={data.blurDataURL}
                className="object-cover"
              />
            </div>
            <figcaption className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {item.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
