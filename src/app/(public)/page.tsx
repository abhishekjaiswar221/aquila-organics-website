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
import { Reveal } from "@/components/motion/reveal";
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
      {intro ? (
        <Reveal>
          <Intro data={intro.data} />
        </Reveal>
      ) : null}
      <Reveal>
        <Segments blocks={visibleBlocks(home.segmentBlocks)} />
      </Reveal>
      <Reveal>
        <FragranceApplications
          intro={fragIntro?.data}
          applications={visibleBlocks(home.fragranceApplications)}
          emphasis={oudh?.data}
        />
      </Reveal>
      {chem ? (
        <Reveal>
          <AromaChemicals data={chem.data} toll={toll?.data.text} />
        </Reveal>
      ) : null}
      <Reveal>
        <Flavours
          lead={flIntro?.data.lead}
          applications={visibleBlocks(biz.flavourApplications)}
          extra={flExtra?.data.text}
        />
      </Reveal>
      {mfg ? (
        <Reveal>
          <Manufacturing data={mfg.data} />
        </Reveal>
      ) : null}
      {str ? (
        <Reveal>
          <Strengths items={str.data.items} />
        </Reveal>
      ) : null}
      <Reveal>
        <Leadership leaders={visibleBlocks([biz.leadershipVaze, biz.leadershipHattali])} />
      </Reveal>
      {sus ? (
        <Reveal>
          <Sustainability data={sus.data} />
        </Reveal>
      ) : null}
      {reach ? (
        <Reveal>
          <GlobalReach data={reach.data} />
        </Reveal>
      ) : null}
      {/* biz.certifications is status "hidden": intentionally not rendered until confirmed */}
      {cta ? (
        <Reveal>
          <EnquiryCta data={cta.data} />
        </Reveal>
      ) : null}
    </>
  );
}
