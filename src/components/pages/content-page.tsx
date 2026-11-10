import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { Block, PageSection } from "@/content/types";
import type { Crumb } from "@/lib/seo/page-metadata";
import { Breadcrumbs } from "./breadcrumbs";
import { PageSections } from "./page-sections";

interface Props {
  title: string;
  lead: string;
  /** Path of this page, used for the final breadcrumb. */
  path: string;
  eyebrow?: string;
  blocks: Block<PageSection>[];
  /** Replaces the default Home > title trail (e.g. for pages under /sustainability). */
  trail?: Crumb[];
  children?: ReactNode;
}

/** Plain factual page: breadcrumb, h1, lead and ordered sections. */
export function ContentPage({ title, lead, path, eyebrow, blocks, trail, children }: Props) {
  const crumbs = trail ?? [
    { name: "Home", path: "/" },
    { name: title, path },
  ];
  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs trail={crumbs} />
      </div>
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-12 lg:pb-16 lg:pt-20">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="text-display-xl mt-5">{title}</h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">{lead}</p>
      </section>
      <div className="mx-auto max-w-7xl px-6 pb-20 lg:pb-28">
        <PageSections blocks={blocks} />
        {children}
      </div>
    </>
  );
}
