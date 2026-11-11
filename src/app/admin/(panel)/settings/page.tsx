import { RecipientsForm } from "@/components/admin/recipients-form";
import { PageHeader } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { getAllRecipients, RECIPIENT_TYPES } from "@/features/settings/queries";
import { requireAction } from "@/lib/permissions";

// Per request (session + database), no `use cache`: a saved change shows at once.
export const instant = false;
export const metadata = adminMetadata("Settings");

const LABELS = {
  FRAGRANCES: "Fragrances enquiries",
  AROMA_CHEMICALS: "Aroma chemicals quotations",
  FLAVOURS: "Flavours enquiries",
  GENERAL: "General contact enquiries",
  CAREERS: "Careers applications",
} as const;

export default async function AdminSettingsPage() {
  await requireAction("settings.edit");
  const recipients = await getAllRecipients();
  return (
    <>
      <PageHeader title="Settings">Who is emailed when a new enquiry arrives.</PageHeader>
      <section aria-labelledby="recipients-heading" className="mt-8 max-w-2xl">
        <h2 id="recipients-heading" className="text-xl">
          Notification recipients
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each enquiry type is sent to its own list. The visitor&apos;s acknowledgement is not affected.
        </p>
        <div className="mt-4">
          {RECIPIENT_TYPES.map((t) => (
            <RecipientsForm key={t} type={t} label={LABELS[t]} recipients={recipients[t]} />
          ))}
        </div>
      </section>
    </>
  );
}
