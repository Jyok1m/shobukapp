# Privacy (GDPR)

The dojo is the data controller. This app processes identity, contact, licence information, payment status, messages and health data (medical certificates).

## Rules

- **Minimisation**: a field is collected only if the FFJDA licence, the membership or the dojo's insurance needs it.
- **Health data** (article 9): medical certificates are readable by their owner and admins only, excluded from the directory and from exports, and stored in the private storage without public URL.
- **Directory**: opt-in, unchecked by default, revocable at any time from the profile. Admins cannot toggle it.
- **Exports**: CSV of members for admins only, logged. Never passwords, never medical documents.
- **Passwords**: never exported, never visible to admins. Admins edit every other field.
- **Card data** never touches our servers (Stripe Checkout and Portal).

- **Join requests** (`onboarding.md`) are data of people who are not members: name, email, optional phone, a free message. Only admins read them; an admin can delete one at any time. The form states that the data only serves to answer the request.

- **Admin-created accounts**: the admin chooses a temporary password and therefore knows it until the member replaces it at first login (forced). An admin could log in first and accept the terms on the member's behalf: a limit of the design, accepted by the dojo.
- **Role changes** are journaled (`role_changes`: who, whom, when) for accountability.
- **Production to dev copies** (`deployment.md`) are anonymized before the dev API can read them: names, emails (except admins'), phones, addresses, emergency contacts, birth data, messages, join requests, reminder notes, document titles and licence numbers are replaced or cleared; production password hashes and sessions never reach dev; admins' documents are dropped. Files are not copied.

## Rights

- Access and portability: the member can download their own data (profile, documents, licences, messages) as a zip. Not in the MVP; the admin export covers urgent requests.
- Erasure (`ErasureService`, used by the admin today and by self-deletion later): cancels the Stripe subscription first (else the person keeps being charged; one already missing at Stripe counts as cancelled), then deletes the user row and what cascades from it (sessions, documents, licences, messages), then the stored files. Row before files: a failed file removal leaves an orphan file, never a row pointing to nothing. A Stripe failure aborts before any data is touched. Accounting records required by law (invoices) stay at Stripe.

## To decide with the dojo before production

- Retention of join requests: suggested, delete declined or unanswered requests after six months, and invited ones once the account exists.
- Retention period after a member leaves (suggested: delete after one season without membership, keep licence numbers if the federation requires it).
- `/confidentialite` exists (privacy and cookies); its retention period and contact channel are left "à préciser par le bureau". A terms of use page does not exist yet, while the signup consent mentions the conditions.
- Hosting location of the database and files (EU).
