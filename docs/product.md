# Product

ShobukApp is the member space of the Shobukan Hombu Dojo (Paris 12e: iaido, kendo, battodo, jojutsu, fuzokubudo). It replaces paper forms, bank transfer follow-ups and scattered licence PDFs with one place for practitioners and one dashboard for the dojo's administrators.

The UI is in French. This file names the screens by their French label in quotes when it helps.

## Roles

| Role | How one gets it | Can |
|---|---|---|
| Visitor | not signed in | sign up, sign in (the plans and prices are only shown once signed in) |
| `PRACTITIONER` | invitation from an admin (`onboarding.md`) | everything in "Practitioner features" below |
| `ADMIN` | `admin:grant <email>` on the server | everything a practitioner can, plus "Admin features" |

"Member" means a practitioner with an `active` or `trialing` subscription. It is a **computed status**, not a role: it drives what the UI highlights (membership card, directory badge), never what the API authorizes, except where a rule below says so.

Open question: if the dojo needs a third role (for example a board member who sees payments but cannot edit plans), it becomes a new enum value and a guard, not a flag.

## Practitioner features

- Ask to join with a message and an optional trial class ("Nous rejoindre"), then sign up from the link the dojo sends. Existing practitioners activate their account with a code from the dojo ("Activation"). Sign in, sign out ("Connexion").
- See the dojo plans and buy one through Stripe Checkout, the annual entrance fee included, then manage it (card, invoices, cancellation) through the Stripe Customer Portal ("Ma cotisation"; the UI says cotisation, never abonnement).
- Pay the FFJDA licence and insurance or the sports passport from the link the bureau sends, and buy a private lesson or a drop-in class from the dashboard.
- See the directory of members who opted in: name, photo, phone, email ("Annuaire").
- Send and receive 1:1 messages with other members ("Messagerie").
- Upload, replace, rename and delete their own documents, first of all the medical certificate ("Mes documents").
- See their FFJDA licences, one per season and discipline, view them in the site or download the PDF ("Mes licences").
- Edit their profile (first name, last name, phone, photo) and the legal information required for the FFJDA licence (birth date, sex, nationality, address, emergency contact) ("Mon profil").
- Choose whether they appear in the directory.

## Admin features

- Read join requests, send a signup link or decline ("Demandes"); issue activation codes for existing practitioners ("Invitations").
- CRUD on plans, synchronised with Stripe products and prices ("Formules"); the season's grid is imported from code, and a price change reaches members at their next renewal (`billing.md`, Seasons).
- Edit one-off products ("Produits"); for a practitioner, send a payment link for the FFJDA licence and insurance or the sports passport, or record it as paid at the dojo, declined or waived; see each practitioner's licence and passport status in the list.
- List practitioners with their subscription status, last payment and failed payments; open a practitioner's detail ("Pratiquants").
- Send a payment reminder to a practitioner, logged with its author and date ("Relancer").
- CRUD on dojo documents: legal (statuts, règlement intérieur, assurance) and accounting (bilans, factures) ("Documents du dojo").
- Upload FFJDA licences for a practitioner, season and discipline, and view them in the site.
- Track licence requests: request a licence for a member, season and disciplines, mark it sent to the FFJDA, export the data to type on the FFJDA extranet; uploading the licence closes the request ("Licences").
- CRUD on member information, except the password, and export the members list as CSV ("Membres", "Exporter").
- See (not edit) practitioners' medical certificates and their validity date.

## Out of scope for now

Online class booking, attendance, grading (passages de grades) history, accounting ledger, multi-dojo tenancy, mobile app, group conversations, real-time chat. Each one is a candidate for a later doc, not an implicit promise.
