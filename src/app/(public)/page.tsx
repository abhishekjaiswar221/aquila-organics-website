import { AromaChemicals } from "@/components/marketing/aroma-chemicals";
import { EnquiryCta } from "@/components/marketing/enquiry-cta";
import { Flavours } from "@/components/marketing/flavours";
import { FragranceApplications } from "@/components/marketing/fragrance-applications";
import { GlobalReach } from "@/components/marketing/global-reach";
import { Hero } from "@/components/marketing/hero";
import { Intro } from "@/components/marketing/intro";
import { Leadership } from "@/components/marketing/leadership";
import { Manufacturing } from "@/components/marketing/manufacturing";
import { Segments } from "@/components/marketing/segments";
import { Strengths } from "@/components/marketing/strengths";
import { Sustainability } from "@/components/marketing/sustainability";
import { visibleBlocks } from "@/content";
import * as home from "@/content/home";
import * as biz from "@/content/home-business";

export default function HomePage() {
  const [hero] = visibleBlocks([home.hero]);
  const [intro] = visibleBlocks([home.intro]);
  const [fragIntro] = visibleBlocks([home.fragranceIntro]);
  const [oudh] = visibleBlocks([home.oudhEmphasis]);
  const [chem] = visibleBlocks([biz.chemistries]);
  const [toll] = visibleBlocks([biz.tollManufacturing]);
  const [flIntro] = visibleBlocks([biz.flavourIntro]);
  const [flExtra] = visibleBlocks([biz.flavourExtras]);
  const [mfg] = visibleBlocks([biz.manufacturing]);
  const [str] = visibleBlocks([biz.strengths]);
  const [sus] = visibleBlocks([biz.sustainability]);
  const [reach] = visibleBlocks([biz.globalReach]);
  const [cta] = visibleBlocks([biz.enquiry]);

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
      {chem ? <AromaChemicals data={chem.data} toll={toll?.data.text} /> : null}
      <Flavours
        lead={flIntro?.data.lead}
        applications={visibleBlocks(biz.flavourApplications)}
        extra={flExtra?.data.text}
      />
      {mfg ? <Manufacturing data={mfg.data} /> : null}
      {str ? <Strengths items={str.data.items} /> : null}
      <Leadership leaders={visibleBlocks([biz.leadershipVaze, biz.leadershipHattali])} />
      {sus ? <Sustainability data={sus.data} /> : null}
      {reach ? <GlobalReach data={reach.data} /> : null}
      {/* biz.certifications is status "hidden": intentionally not rendered until confirmed */}
      {cta ? <EnquiryCta data={cta.data} /> : null}
    </>
  );
}
