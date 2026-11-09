import type { Metadata } from "next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { NotFoundContent } from "@/components/layout/not-found-content";
import { SkipLink } from "@/components/layout/skip-link";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

// Unmatched URLs, and unpublished catalogue slugs rewritten here by src/proxy.ts.
// Rendered inside the root layout only, so it carries the public chrome itself.
export default function NotFound() {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        <NotFoundContent />
      </main>
      <Footer />
    </>
  );
}
