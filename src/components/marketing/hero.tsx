import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ImageFrame } from "@/components/ui/image-frame";
import { contacts } from "@/content/site";
import type { HeroData } from "@/content/home";

export function Hero({ data }: { data: HeroData }) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-32 lg:pt-28">
        <div className="hero-in lg:col-span-7">
          <Eyebrow>{data.eyebrow}</Eyebrow>
          <h1 id="hero-title" className="text-display-xl mt-6">
            {data.headline}
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">{data.lead}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ActionButton href="/#aroma-chemicals" variant="primary">
              Explore aroma chemicals
            </ActionButton>
            <ActionButton href={`mailto:${contacts.sales}`} variant="secondary">
              Request a consultation
            </ActionButton>
          </div>
        </div>
        <div className="lg:col-span-5">
          <ImageFrame
            ratio="4/5"
            alt="Hero image: perfumery ingredients and laboratory glassware"
            label="hero: ingredients + glassware (supply or license)"
            className="lg:translate-y-8"
          />
        </div>
      </div>
    </section>
  );
}
