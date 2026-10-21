# Privacy (GDPR)

The dojo is the data controller. This app processes identity, contact, licence information, payment status, messages and health data (medical certificates).

## Rules

- **Minimisation**: a field is collected only if the FFK licence, the membership or the dojo's insurance needs it.
- **Health data** (article 9): medical certificates are readable by their owner and admins only, excluded from the directory and from exports, and stored in the private storage without public URL.
- **Directory**: opt-in, unchecked by default, revocable at any time from the profile. Admins cannot toggle it.
- **Exports**: CSV of members for admins only, logged. Never passwords, never medical documents.
- **Passwords**: never exported, never visible to admins. Admins edit every other field.
- **Card data** never touches our servers (Stripe Checkout and Portal).

## Rights

- Access and portability: the member can download their own data (profile, documents, licences, messages) as a zip. Not in the MVP; the admin export covers urgent requests.
- Erasure: account deletion cancels the Stripe subscription first (else the person keeps being charged), deletes stored files, then the user row and what cascades from it (sessions, documents, messages sent). Accounting records required by law (invoices) stay at Stripe.

## To decide with the dojo before production

- Retention period after a member leaves (suggested: delete after one season without membership, keep licence numbers if the federation requires it).
- Privacy policy and terms pages, and the consent checkbox at signup that points to them.
- Hosting location of the database and files (EU).
