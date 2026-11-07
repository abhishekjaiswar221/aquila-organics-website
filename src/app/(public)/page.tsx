import { FragranceApplications } from "@/components/marketing/fragrance-applications";
import { Hero } from "@/components/marketing/hero";
import { Intro } from "@/components/marketing/intro";
import { Segments } from "@/components/marketing/segments";
import { visibleBlocks } from "@/content";
import * as home from "@/content/home";

export default function HomePage() {
  const [hero] = visibleBlocks([home.hero]);
  const [intro] = visibleBlocks([home.intro]);
  const [fragIntro] = visibleBlocks([home.fragranceIntro]);
  const [oudh] = visibleBlocks([home.oudhEmphasis]);

  return (
    <>
      {hero ? <Hero data={hero.data} /> : null}
      {intro ? <Intro data={intro.data} /> : null}
      <Segments blocks={visibleBlocks(home.segmentBlocks)} />
      <FragranceApplications
        intro={fragIntro?.data}
        applications={visibleBlocks(home.fragranceApplications)}
        emphasis={oudh?.data}
      />
    </>
  );
}
