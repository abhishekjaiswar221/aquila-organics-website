import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submit = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("@/features/careers/actions", () => ({ submitApplication: submit }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { ApplicationForm } = await import("@/components/careers/application-form");

beforeEach(() => {
  submit.mockReset();
  push.mockReset();
});
afterEach(cleanup);

describe("ApplicationForm", () => {
  it("shows the CV type and size hint, restricts the file input, and has a post-method fallback", () => {
    const { container } = render(<ApplicationForm job={null} />);
    const cv = screen.getByLabelText("CV");
    expect(cv).toHaveAttribute("type", "file");
    expect(cv).toHaveAttribute("accept", ".pdf,.docx");
    expect(cv).not.toHaveAttribute("multiple");
    expect(screen.getByText(/PDF or DOCX, up to 10 MB/)).toBeInTheDocument();
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("explains what is collected, who sees it, retention and deletion beside the submit button", () => {
    render(<ApplicationForm job={null} />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/name, email address, telephone number, country, message and CV/);
    expect(text).toMatch(/Only the Aquila Organics HR team/);
    expect(text).toMatch(/to be confirmed by Aquila/);
    const submitButton = screen.getByRole("button", { name: "Send application" });
    const noticeId = submitButton.getAttribute("aria-describedby") ?? "";
    const notice = document.getElementById(noticeId);
    expect(notice?.textContent).toMatch(/to be confirmed by Aquila/);
    expect(notice?.querySelector("a")).toHaveAttribute("href", "/privacy");
  });

  it("names the opening being applied for, or says it is a general application", () => {
    const { unmount } = render(<ApplicationForm job={{ slug: "qa", title: "Quality Analyst" }} />);
    expect(screen.getByText("Quality Analyst")).toBeInTheDocument();
    unmount();
    render(<ApplicationForm job={null} />);
    expect(screen.getByText("This is a general application.")).toBeInTheDocument();
  });

  it("rejects an empty submit with per-field errors, aria-invalid and no server call", async () => {
    render(<ApplicationForm job={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("CV")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("CV").getAttribute("aria-describedby")).toContain("careers-apply-cv-error");
    expect(document.getElementById("careers-apply-cv-error")).toHaveTextContent("Attach your CV");
    expect(submit).not.toHaveBeenCalled();
  });

  it("sends one FormData with the CV, the opening and an idempotency token, then opens the confirmation", async () => {
    submit.mockResolvedValue({ ok: true, reference: "CA-2026-000001", droppedProducts: [], warnings: {} });
    render(<ApplicationForm job={{ slug: "qa", title: "Quality Analyst" }} />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Person" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.test" } });
    fireEvent.change(screen.getByLabelText("CV"), {
      target: { files: [new File(["%PDF-1.4 x"], "cv.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByLabelText(/I agree to Aquila Organics/));
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const fd = submit.mock.calls[0][0] as FormData;
    expect(fd.get("job")).toBe("qa");
    expect(fd.get("fullName")).toBe("Test Person");
    expect((fd.get("cv") as File).name).toBe("cv.pdf");
    expect(fd.get("consent")).toBe("on");
    expect(String(fd.get("submissionId"))).toMatch(/^[0-9a-f-]{36}$/);
    expect(fd.get("website")).toBe("");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/careers/apply/confirmation?ref=CA-2026-000001"));
  });

  it("puts a server CV error on the CV field", async () => {
    submit.mockResolvedValue({ ok: false, errors: { cv: ["Your CV must be a PDF or DOCX file"] } });
    render(<ApplicationForm job={null} />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Person" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.test" } });
    fireEvent.change(screen.getByLabelText("CV"), {
      target: { files: [new File(["x"], "cv.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByLabelText(/I agree to Aquila Organics/));
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(screen.getByLabelText("CV")).toHaveAttribute("aria-invalid", "true"));
    expect(push).not.toHaveBeenCalled();
  });
});
