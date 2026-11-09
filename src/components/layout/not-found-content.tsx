import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";

export function NotFoundContent() {
  return (
    <section aria-labelledby="not-found-title" className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      <Eyebrow>Error 404</Eyebrow>
      <h1 id="not-found-title" className="text-display-lg mt-4">
        Page not found
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
        This page does not exist or is no longer available.
      </p>
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <Link href="/aroma-chemicals" className="text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2">
          Browse the aroma chemicals catalogue
        </Link>
        <Link href="/" className="text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2">
          Go to the homepage
        </Link>
      </div>
    </section>
  );
}
