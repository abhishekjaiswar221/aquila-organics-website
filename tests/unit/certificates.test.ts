import { describe, expect, it } from "vitest";
import { activeCertificates, certificateStatus, expiredCertificates } from "@/lib/certificates";
import type { CertificateRecord } from "@/content/types";

const cert = (over: Partial<CertificateRecord> = {}): CertificateRecord => ({
  id: "c1",
  title: "TEST-Certificate",
  issuer: "TEST-Issuer",
  issuedOn: "2025-01-01",
  expiresOn: "2026-11-10",
  scope: null,
  documentPath: null,
  status: "verified",
  ...over,
});

describe("certificateStatus", () => {
  it("is active on the expiry day itself, up to the last millisecond (UTC)", () => {
    expect(certificateStatus(cert(), new Date("2026-11-10T00:00:00.000Z"))).toBe("active");
    expect(certificateStatus(cert(), new Date("2026-11-10T12:00:00.000Z"))).toBe("active");
    expect(certificateStatus(cert(), new Date("2026-11-10T23:59:59.999Z"))).toBe("active");
  });

  it("is expired from the first millisecond after the expiry day", () => {
    expect(certificateStatus(cert(), new Date("2026-11-11T00:00:00.000Z"))).toBe("expired");
    expect(certificateStatus(cert({ expiresOn: "2026-11-09" }), new Date("2026-11-10T00:00:00.000Z"))).toBe(
      "expired",
    );
  });

  it("is active when the expiry is tomorrow or later", () => {
    expect(certificateStatus(cert({ expiresOn: "2026-11-11" }), new Date("2026-11-10T12:00:00Z"))).toBe("active");
  });

  it("treats a verified entry with an issue date but no expiry as active", () => {
    expect(certificateStatus(cert({ expiresOn: null }), new Date("2030-01-01T00:00:00Z"))).toBe("active");
  });

  it("treats an entry with neither an expiry nor an issue date as unconfirmed", () => {
    expect(certificateStatus(cert({ expiresOn: null, issuedOn: null }), new Date("2026-11-10T00:00:00Z"))).toBe(
      "unconfirmed",
    );
  });

  it("is unconfirmed unless the status is verified, whatever the dates say", () => {
    for (const status of ["needs-client-confirmation", "brief-supplied", "hidden"] as const) {
      expect(certificateStatus(cert({ status }), new Date("2026-01-01T00:00:00Z"))).toBe("unconfirmed");
    }
  });

  it("is unconfirmed for malformed or impossible dates", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    for (const expiresOn of ["2026-13-45", "2026-02-30", "10/11/2026", "2026-1-5", "", "garbage"]) {
      expect(certificateStatus(cert({ expiresOn }), now)).toBe("unconfirmed");
    }
    expect(certificateStatus(cert({ issuedOn: "2026-02-30" }), now)).toBe("unconfirmed");
  });
});

describe("activeCertificates / expiredCertificates", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const list = [
    cert({ id: "a", expiresOn: "2027-01-01" }),
    cert({ id: "b", expiresOn: "2026-01-01" }),
    cert({ id: "c", status: "needs-client-confirmation" }),
    cert({ id: "d", expiresOn: null, issuedOn: null }),
  ];

  it("splits entries and drops anything unconfirmed from both lists", () => {
    expect(activeCertificates(list, now).map((c) => c.id)).toEqual(["a"]);
    expect(expiredCertificates(list, now).map((c) => c.id)).toEqual(["b"]);
  });
});
