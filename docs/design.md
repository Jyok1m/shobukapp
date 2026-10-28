# Design

Identity of https://www.shobukan-dojo.com, in the spirit of Budo: **zen and restrained**. Washi paper, sumi ink, and ai-iro (the indigo of keikogi and hakama) as the only action colour. Red only for errors. Generous whitespace, borders rather than shadows, serif titles. No pink, no saturated fills except the primary button and small counters.

**Logo**: the kanji 武 (bu), single colour, always drawn in ink (`text-ink`): sumi on paper, washi on dark. `components/logo.tsx` uses `currentColor`; `public/logo.svg` is the cleaned standalone file; `app/icon.svg` (tab icon, ink, washi when the browser is dark), `app/favicon.ico` (16/32/48 px, ink on a washi square, readable on any tab bar) and `app/apple-icon.png` (180 px, iOS ignores transparency) are generated from it with `rsvg-convert`. Never raster the logo for display in the app.

Tokens in `app/globals.css` (light / dark), every text pair at least 4.5:1, borders at least 3:1 (checked by script):

| Token | Light | Dark |
|---|---|---|
| paper | #f5f2eb | #121110 |
| surface | #fbf9f4 | #1b1a17 |
| ink | #1d1b18 | #ebe7de |
| muted | #625d55 | #a49e93 |
| line | #e3ded3 | #2e2b27 |
| field (input borders) | #8f877b | #6e685f |
| accent (ai-iro) | #24405f | #9fb3cb |
| accent-strong | #182d44 | #c3d0df |
| accent-soft | #e4e9ef | #1f2a36 |
| on-accent | #fbf9f4 | #121110 |
| danger / danger-soft | #9b2c22 / #f6e4e0 | #e0886f / #3a211b |
| success / success-soft | #2f5d3a / #e3eee5 | #8fbf98 / #1d2b20 |
| warning / warning-soft | #7a5a12 / #f5ecd6 | #d9b26a / #33291a |
| scrim | rgb(29 27 24 / 0.45) | rgb(0 0 0 / 0.6) |

`scrim` carries its own alpha: never add an opacity modifier to it.

- **Dark mode**: every token is redefined under `prefers-color-scheme: dark` (via `:root:not([data-theme="light"])`) and under `:root[data-theme="dark"]`. One icon button (moon in light, sun in dark, "Activer le thème sombre / clair") toggles; until the first click the page follows the system. The choice is stored in localStorage (try/catch) and applied before paint by an inline script in `<head>` (`lib/theme-script.ts`, a constant: never interpolate anything user-controlled into it).
- Fonts through `next/font`: one sans for the UI, optionally one serif for titles.
- Shared components in `components/ui/`: `Button`, `Input`, `PasswordInput`, `PasswordRules`, `Select`, `Field` (label, hint, error), `Card`, `Badge` (subscription status), `Table`, `EmptyState`, `ConfirmDialog`, `FileDrop`, `Toast`. Build a new primitive only if none fits.
- Layout: sidebar navigation on desktop, bottom or burger navigation on mobile. Admin screens share the shell with an "Administration" section visible only to admins.
- Forms: server actions or client fetch to `/api/*`, inline French error messages from the API error code, never a raw API message.
- Destructive actions (delete document, archive plan) go through `ConfirmDialog`.
- Toasts (`components/ui/toast.tsx`, `useToast()`): a short French confirmation after an action ("Profil enregistré"), auto-dismissed after 6 s, paused on hover or focus. Top of the screen on mobile (clear of the cookie notice), bottom right on tablet, top right on desktop. A toast echoes, it never replaces an inline error: problems stay next to the field or in the form.
- Password fields use `PasswordInput` (show/hide button) and every new password shows `PasswordRules` (live checklist).
- Statuses in French: "Actif", "En retard de paiement", "Résilié", "Sans cotisation", "Certificat expiré". The UI says **cotisation**, never abonnement.
- **Guided tour** (`components/tour/`): written for people who rarely use a computer. Opens by itself at the first visit (member tour), and on the first admin page for admins (admin tour); "Aide" (`/aide`) replays both and holds step by step guides. One idea per step, the exact on-screen labels in quotes, large text, "Retour", "Suivant" and "Arrêter la visite" spelled out. The menu link of each step is highlighted; on a phone the "Menu" button is, with a sentence saying so. Seen state in localStorage per account (try/catch): a new device shows it again, on purpose. Step texts live in `components/tour/steps.ts` and the guides in `app/(app)/aide/page.tsx`: rename a button, update both.
- Cookie notice: informational only (one strictly necessary session cookie), links to `/confidentialite`. Sticky at the bottom on mobile, a small card at the bottom right on desktop (clear of the sidebar).
- Accessibility: every input has a label, focus is visible, contrast at least AA.
