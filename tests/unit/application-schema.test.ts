// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applicationFromFormData,
  applicationSchema,
  APPLICATION_MESSAGE_MAX,
} from "@/features/careers/application-schema";
import {
  applicationToFormData,
  buildApplicationFormData,
  checkSelectedCv,
  pristineApplicationValues,
} from "@/features/careers/form-state";

const TOKEN = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const base = {
  fullName: "Jane Candidate",
  email: "Jane.Candidate@Example.COM ",
  consent: "on",
  submissionId: TOKEN,
};

function parse(extra: Record<string, string | undefined> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v !== undefined) fd.set(k, v);
  return applicationSchema.safeParse(applicationFromFormData(fd));
}

describe("applicationSchema", () => {
  it("accepts the minimum and normalises the email", () => {
    const r = parse();
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("jane.candidate@example.com");
      expect(r.data.phone).toBeUndefined();
      expect(r.data.country).toBeUndefined();
      expect(r.data.message).toBeUndefined();
      expect(r.data.job).toBeUndefined();
    }
  });
  it("requires name, a valid email and consent", () => {
    const r = parse({ fullName: "  ", email: "nope", consent: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["consent", "email", "fullName"]);
  });
  it("rejects consent that is not on/true", () => {
    expect(parse({ consent: "off" }).success).toBe(false);
    expect(parse({ consent: "true" }).success).toBe(true);
  });
  it("rejects a message over 2000 characters and accepts exactly 2000", () => {
    expect(parse({ message: "a".repeat(APPLICATION_MESSAGE_MAX + 1) }).success).toBe(false);
    expect(parse({ message: "a".repeat(APPLICATION_MESSAGE_MAX) }).success).toBe(true);
  });
  it("turns CRLF into LF and strips control characters", () => {
    const r = parse({ message: "one\r\ntwo\u0000‮ three" });
    expect(r.success && r.data.message).toBe("one\ntwo three");
  });
  it("requires submissionId to be a uuid when present", () => {
    expect(parse({ submissionId: "not-a-uuid" }).success).toBe(false);
    expect(parse({ submissionId: undefined }).success).toBe(true);
  });
  it("validates the telephone number characters", () => {
    expect(parse({ phone: "+44 20 7946 0000" }).success).toBe(true);
    expect(parse({ phone: "call me <b>" }).success).toBe(false);
  });
  it("keeps the job slug, empty means none, and ignores unknown keys", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...base, job: "chemist", status: "HIRED", jobId: "x" })) fd.set(k, v);
    const r = applicationSchema.safeParse(applicationFromFormData(fd));
    expect(r.success && r.data.job).toBe("chemist");
    expect(r.success && Object.keys(r.data)).not.toContain("status");
    const empty = parse({ job: "" });
    expect(empty.success).toBe(true);
    expect(empty.data?.job).toBeUndefined();
  });
});

describe("careers form-state", () => {
  it("applicationToFormData round-trips and sends consent only when true", () => {
    const cv = new File(["%PDF-1.4"], "cv.pdf");
    const fd = applicationToFormData({ fullName: "A", email: "a@b.co", consent: true, job: "x" }, cv);
    expect(fd.get("fullName")).toBe("A");
    expect(fd.get("consent")).toBe("on");
    expect(fd.get("cv")).toBeInstanceOf(File);
    expect(applicationToFormData({ fullName: "A" }).has("consent")).toBe(false);
    expect(applicationToFormData({ fullName: "A" }).has("cv")).toBe(false);
  });
  it("buildApplicationFormData adds the token and leaves unticked consent out", () => {
    const values = { ...pristineApplicationValues("job-slug"), fullName: "A", email: "a@b.co" } as Parameters<
      typeof buildApplicationFormData
    >[0];
    const fd = buildApplicationFormData(values, TOKEN, null);
    expect(fd.get("submissionId")).toBe(TOKEN);
    expect(fd.get("job")).toBe("job-slug");
    expect(fd.has("consent")).toBe(false);
  });
  it("checkSelectedCv is a client hint for missing, empty, big and wrong-type files", () => {
    expect(checkSelectedCv(null)).toBe("Attach your CV");
    expect(checkSelectedCv({ name: "cv.pdf", size: 0 })).toBe("File is empty");
    expect(checkSelectedCv({ name: "cv.pdf", size: 10 * 1024 * 1024 + 1 })).toBe("File is larger than 10 MB");
    expect(checkSelectedCv({ name: "cv.png", size: 5 })).toBe("Your CV must be a PDF or DOCX file");
    expect(checkSelectedCv({ name: "cv", size: 5 })).toBe("Your CV must be a PDF or DOCX file");
    expect(checkSelectedCv({ name: "CV.DOCX", size: 5 })).toBeNull();
  });
});
