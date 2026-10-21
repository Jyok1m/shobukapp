# Design

To align with the identity of https://www.shobukan-dojo.com (logo, colours) once assets are provided. Until then, a sober base that does not need to be undone.

- Tailwind 4 tokens in `app/globals.css` under `@theme`: `--color-ink` (near black, text), `--color-paper` (warm off white, background), `--color-accent` (deep red, kendo and dojo tradition), `--color-muted`, `--color-danger`, `--color-success`. Components use the tokens, never raw hex values.
- Fonts through `next/font`: one sans for the UI, optionally one serif for titles.
- Shared components in `components/ui/`: `Button`, `Input`, `Select`, `Field` (label, hint, error), `Card`, `Badge` (subscription status), `Table`, `EmptyState`, `ConfirmDialog`, `FileDrop`. Build a new primitive only if none fits.
- Layout: sidebar navigation on desktop, bottom or burger navigation on mobile. Admin screens share the shell with an "Administration" section visible only to admins.
- Forms: server actions or client fetch to `/api/*`, inline French error messages from the API error code, never a raw API message.
- Destructive actions (delete document, archive plan) go through `ConfirmDialog`.
- Statuses in French: "Actif", "En retard de paiement", "Résilié", "Sans abonnement", "Certificat expiré".
- Accessibility: every input has a label, focus is visible, contrast at least AA.
