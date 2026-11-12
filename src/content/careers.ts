import type { Block } from "./types";

/**
 * Careers page copy. Framing and form wording only: no claim about jobs, pay,
 * staff numbers or the workplace lives here. The only job content on the site is
 * what an admin enters as an opening (src/features/careers/job-queries.ts).
 */

export const careersMeta = {
  title: "Careers",
  lead: "Current openings at Aquila Organics.",
  description: "Current job openings at Aquila Organics, and how to apply.",
} as const;

export const careersApplyMeta = {
  title: "Apply",
  lead: "Send your details and your CV to the Aquila Organics HR team.",
  description: "Apply to Aquila Organics with your CV.",
} as const;

/** The introduction is supplied by the brief and awaits the client's wording. */
export const careersIntro: Block<string> = {
  id: "careers-intro",
  status: "needs-client-confirmation",
  data: "If you would like to work with Aquila Organics, you can apply for an opening below or send a general application.",
};

export const careersEmptyState: Block<string> = {
  id: "careers-empty",
  status: "brief-supplied",
  data: "There are no current openings.",
};

export const careersGeneralApplication: Block<string> = {
  id: "careers-general-application",
  status: "brief-supplied",
  data: "You can still send a general application.",
};

export const careersApplyIntro: Block<string> = {
  id: "careers-apply-intro",
  status: "brief-supplied",
  data: "Fields marked optional can be left empty. Your CV is required.",
};

export const careersCvHint = "PDF or DOCX, up to 10 MB";

/** Shown next to the submit button. Retention is deliberately left to the client. */
export const careersFormNotice: Block<{ collected: string; access: string; retention: string; deletion: string }> = {
  id: "careers-form-notice",
  status: "needs-client-confirmation",
  data: {
    collected: "We collect your name, email address, telephone number, country, message and CV.",
    access:
      "Only the Aquila Organics HR team can see them, and a notification email with your details (not your CV file) goes to the people HR chooses.",
    retention: "How long we keep them is to be confirmed by Aquila.",
    deletion: "To ask us to delete your application, follow the instructions in the",
  },
};

export const careersConsentLabel = "I agree to Aquila Organics using these details to consider my application.";