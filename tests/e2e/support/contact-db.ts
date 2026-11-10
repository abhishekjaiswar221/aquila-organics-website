// Stored-row reads for tests/e2e/contact.spec.ts on the e2e TEST database
// (withDb refuses anything that is not a dedicated *_test database). Cleanup
// and rate-limit seeding reuse rfq-db.ts.
import { withDb } from "./rfq-db";

export type StoredContactEnquiry = {
  reference: string;
  submissionId: string | null;
  type: string;
  businessSegment: string | null;
  intendedApplication: string | null;
  additionalRequirements: string | null;
  itemCount: number;
};

/** Every enquiry stored for this email address (each test uses a unique one), oldest first. */
export async function contactEnquiriesFor(email: string): Promise<StoredContactEnquiry[]> {
  return withDb(async (c) => {
    const { rows } = await c.query<StoredContactEnquiry>(
      `SELECT e."reference", e."submissionId", e."type"::text AS "type", e."businessSegment",
              e."intendedApplication", e."additionalRequirements",
              (SELECT count(*)::int FROM "enquiry_item" i WHERE i."enquiryId" = e."id") AS "itemCount"
       FROM "enquiry" e WHERE e."email" = $1 ORDER BY e."createdAt"`,
      [email],
    );
    return rows;
  });
}
