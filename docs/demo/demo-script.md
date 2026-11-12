# Demo script (about 5 minutes)

Audience: a prospective client for the Aquila Organics website. Everything shown is built and working; the catalogue
contains **sample data** (well-known chemicals with public CAS numbers), not Aquila's real products.

## Before you start (once)

1. Run the demo on the private deployment (see `deploy-steps.md`) or locally with `npm run dev`.
2. Load the sample catalogue: `npm run demo:seed -- --with-job` (adds 17 sample products and one sample opening).
3. Have two admin accounts ready: a super admin (`npm run seed:admin`) and an HR manager (create it from
   Admin > Users; the one-time password is shown once, and the first sign-in forces a password change).
4. Keep two browser windows: one signed out (the visitor), one signed in as the super admin.

## 1. The brand and the home page (30 s)

Open the home page. Point out the tagline, the two segments (Fragrances and Flavours) and the aroma-chemicals
section. Mention it is fully responsive: shrink the window to phone width.

## 2. Search the catalogue by CAS number (60 s)

Go to **Aroma chemicals**. Type `64-17-5`, then `64175`: both find Ethanol (hyphens are optional). Search by
name (`vanil`) and open **Vanillin**. Show the product page: CAS number, description, and the Add to RFQ button.
Say: this is the part buyers use most, and it is database-backed, not a static page.

## 3. A multi-product request for quotation (60 s)

Add two or three products to the RFQ, set quantities and units (the unit is always an explicit choice), attach a
small PDF, tick consent and submit. Show the confirmation page: it carries only the reference number.
Mention: spam protection, a per-address limit on acknowledgement emails, and that the file is checked by content,
not just by its name.

## 4. The admin: enquiries and publishing (75 s)

In the super admin window open **Enquiries**: the RFQ just submitted is there, with its lines and attachment.
Change its status. Then open **Products**, create a new product, and show that it starts as a **draft and
unverified**. Only a super admin can verify; only then can it be published. Publish it and refresh the public
catalogue to show it appear. Edit a published product and show the warning that saving unpublishes it until it is
verified again. This is the rule that nothing unverified ever goes public.

## 5. Careers and the HR inbox (60 s)

On the public site open **Careers**, open the sample opening and apply with a PDF CV. Sign in as the HR manager:
they land on **Applications** and see only Jobs and Applications in the menu. Open the application, download the
CV, move the status along, and show the delete confirmation (it says the CV is removed too). Point out that
sales and administrator accounts cannot see any of this.

## 6. Control and accountability (30 s)

As the super admin open **Audit log**: every change above is recorded with who, what and when, and never with
personal data. Mention roles (super admin, administrator, sales manager, content editor, HR manager), settings for
who receives each notification, and creating or disabling users.

## Things to say honestly

- The catalogue shown is sample data. A real catalogue needs Aquila's verified product list and CAS numbers.
- Emails are not sent in this demo (they are logged only); real sending is connected when the client's email
  account exists.
- Page copy and certificates are still maintained by us in code; making them editable by staff is a later,
  optional phase.
- See `built-vs-roadmap.md` for the full list of what the client still needs to supply.

## After the demo

Remove the sample data from any database that will become real: `npm run demo:reset`.
