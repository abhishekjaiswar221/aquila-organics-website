import { describe, expect, it } from "vitest";
import { collectOpenBlocks } from "@/content/report";
import * as aboutModule from "@/content/about";
import * as contactModule from "@/content/contact";
import * as innovationModule from "@/content/innovation";
import * as sustainabilityModule from "@/content/sustainability";
import * as certificationsModule from "@/content/certifications";
import * as segmentsModule from "@/content/segments";
import { fragranceApplications, oudhEmphasis } from "@/content/home";
import { flavourApplications, flavourExtras } from "@/content/home-business";
import {
  APPLICATION_SLUGS,
  findApplication,
  flavourSegment,
  fragranceSegment,
} from "@/content/segments";
import { certificates } from "@/content/certifications";

const FRAGRANCE_SLUGS = [
  "fine-fragrance",
  "personal-care",
  "air-care",
  "fabric-care",
  "home-care",
  "incense-and-bakhoor",
];
const FLAVOUR_SLUGS = ["confectionery", "bakery", "beverages", "dairy", "savoury"];

describe("segment records", () => {
  it("has exactly the six fragrance and five flavour application slugs", () => {
    expect(fragranceSegment.applications.map((a) => a.slug)).toEqual(FRAGRANCE_SLUGS);
    expect(flavourSegment.applications.map((a) => a.slug)).toEqual(FLAVOUR_SLUGS);
    expect(APPLICATION_SLUGS.fragrances).toEqual(FRAGRANCE_SLUGS);
    expect(APPLICATION_SLUGS.flavours).toEqual(FLAVOUR_SLUGS);
  });

  it("uses unique names and non-empty summaries taken from the homepage blocks", () => {
    const all = [...fragranceSegment.applications, ...flavourSegment.applications];
    expect(new Set(all.map((a) => a.name)).size).toBe(all.length);
    const homeSummaries = new Map(
      [...fragranceApplications, ...flavourApplications].map((b) => [b.data.name, b.data.summary]),
    );
    for (const a of all) {
      expect(a.summary.length).toBeGreaterThan(10);
      expect(a.summary).toBe(homeSummaries.get(a.name));
    }
  });

  it("carries the Oud/Bakhoor/Arabic statement as a brief-supplied quote on the incense page only", () => {
    const incense = findApplication("fragrances", "incense-and-bakhoor");
    const quote = incense?.blocks.find((b) => b.data.kind === "quote");
    expect(quote?.status).toBe("brief-supplied");
    expect(quote?.data.kind === "quote" && quote.data.text).toBe(oudhEmphasis.data.text);
    for (const a of fragranceSegment.applications.filter((x) => x.slug !== "incense-and-bakhoor")) {
      expect(a.blocks.some((b) => b.data.kind === "quote")).toBe(false);
    }
  });

  it("lists the five incense sub-types named on the live site", () => {
    const incense = findApplication("fragrances", "incense-and-bakhoor");
    const list = incense?.blocks.find((b) => b.data.kind === "list");
    expect(list?.data.kind === "list" && list.data.items).toEqual([
      "Bakhoor",
      "Flora Batti",
      "Incense Cone",
      "Masala Batti",
      "Scented Batti",
    ]);
  });

  it("keeps the shisha and mouth-fresheners line flagged for confirmation", () => {
    const extra = flavourSegment.extras.find((b) => b.id === flavourExtras.id);
    expect(extra?.status).toBe("needs-client-confirmation");
  });

  it("finds applications case-sensitively and only for the right segment", () => {
    expect(findApplication("fragrances", "air-care")?.name).toBe("Air Care");
    expect(findApplication("flavours", "bakery")?.name).toBe("Bakery");
    expect(findApplication("flavours", "Bakery")).toBeUndefined();
    expect(findApplication("fragrances", "bakery")).toBeUndefined();
    expect(findApplication("fragrances", "nope")).toBeUndefined();
    expect(findApplication("flavours", "")).toBeUndefined();
  });
});

describe("certificates", () => {
  it("starts empty until the client confirms issuers and dates", () => {
    expect(certificates).toEqual([]);
    expect(certificationsModule.certificationsPending.data.length).toBeGreaterThan(10);
  });
});

describe("contact content", () => {
  it("flags the flavors mailbox for confirmation and hides the named individuals", () => {
    const flavours = contactModule.contactChannels.find((b) => b.id === "channel-flavours");
    expect(flavours?.status).toBe("needs-client-confirmation");
    for (const b of contactModule.hiddenContacts) expect(b.status).toBe("hidden");
    expect(contactModule.hiddenContacts.length).toBeGreaterThan(0);
  });
});

describe("compliance content", () => {
  it("names the document files only as awaiting confirmation and claims no compliance", () => {
    const text = JSON.stringify(sustainabilityModule.complianceBlocks);
    expect(text).toMatch(/awaiting confirmation|not yet confirmed/i);
    expect(text).not.toMatch(/REACH|IFRA|GMP|compliant with|certified/i);
  });
});

describe("about and innovation content", () => {
  it("keeps the second director hidden and mentions no capacity or equipment", () => {
    const about = JSON.stringify(aboutModule.aboutBlocks.filter((b) => b.status !== "hidden"));
    expect(about).toContain("Girish Vaze");
    expect(about).not.toContain("Hattali");
    const innovation = JSON.stringify(innovationModule.innovationBlocks);
    expect(innovation).not.toMatch(/tonnes|capacity|\bMT\b|equipment/i);
  });
});

describe("content report", () => {
  it("lists open blocks across modules (Oud statement, shisha line, flavors mailbox)", () => {
    const open = collectOpenBlocks({
      segments: segmentsModule,
      contact: contactModule,
      about: aboutModule,
      innovation: innovationModule,
      sustainability: sustainabilityModule,
      certifications: certificationsModule,
    });
    const ids = open.map((o) => o.id);
    expect(ids).toContain(flavourExtras.id);
    expect(ids).toContain("channel-flavours");
    expect(open.find((o) => o.id === flavourExtras.id)?.status).toBe("needs-client-confirmation");
    expect(open.some((o) => o.status === "brief-supplied")).toBe(true);
    expect(open.every((o) => !["hidden", "verified"].includes(o.status))).toBe(true);
  });

  it("walks nested arrays and objects and ignores non-block values", () => {
    const open = collectOpenBlocks({
      m: {
        list: [{ id: "x", status: "needs-client-confirmation", data: 1 }],
        nested: { deep: { id: "y", status: "brief-supplied", data: 2 } },
        plain: { id: "z", status: "verified", data: 3 },
        junk: [1, "a", null, { id: 5 }],
      },
    });
    expect(open.map((o) => o.id).sort()).toEqual(["x", "y"]);
  });
});
