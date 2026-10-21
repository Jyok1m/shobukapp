# Design

Identity of https://www.shobukan-dojo.com. **Logo**: the kanji 武 (bu), single colour. `components/logo.tsx` draws it in `currentColor` (accent red in the brand, light red in dark mode); `public/logo.svg` is the cleaned standalone file (black); `app/icon.svg` is the favicon (accent red, light red when the browser is dark); `app/apple-icon.png` (180 px, paper background, iOS ignores transparency) is generated from it with `rsvg-convert`. Never raster the logo for display in the app: it stays vector.

- Tailwind 4 tokens in `app/globals.css` under `@theme`: `ink` (text), `paper` (background), `surface`, `line`, `field` (input borders, 3:1 against the background), `accent` / `accent-strong` / `accent-soft` (deep red), `on-accent` (text on accent or danger), `muted`, `danger` / `danger-soft`, `success` / `success-soft`, `warning` / `warning-soft` (Stripe test mode), `scrim` (dialog and menu backdrops). Components use the tokens, never raw colors (`bg-white`, `zinc-*`, hex).
- **Dark mode**: every token is redefined under `prefers-color-scheme: dark` (via `:root:not([data-theme="light"])`) and under `:root[data-theme="dark"]`. The Clair / Sombre / Système choice is stored in localStorage (try/catch) and applied before paint by an inline script in `<head>` (`lib/theme-script.ts`, a constant: never interpolate anything user-controlled into it). Contrast AA checked in both themes.
- **Cursors**: Tailwind 4 resets buttons to `cursor: default`; a `@layer base` rule restores `pointer` on buttons, `[role=button]`, `summary`, `select`, `label[for]`, checkboxes, radios, file and range inputs, and `not-allowed` when disabled.
- **Mobile**: no horizontal scroll from 320 px; tap targets at least 44 px below `sm`; tables scroll inside a `relative` container (an absolutely positioned `sr-only` in a cell otherwise widens the whole page).
- Images are never stretched (`object-cover`, fixed aspect) nor upscaled. Profile photos are cropped square in the browser (react-easy-crop) at the source resolution, capped at 1024 px, PNG (lossless).
- Fonts through `next/font`: one sans for the UI, optionally one serif for titles.
- Shared components in `components/ui/`: `Button`, `Input`, `Select`, `Field` (label, hint, error), `Card`, `Badge` (subscription status), `Table`, `EmptyState`, `ConfirmDialog`, `FileDrop`. Build a new primitive only if none fits.
- Layout: sidebar navigation on desktop, bottom or burger navigation on mobile. Admin screens share the shell with an "Administration" section visible only to admins.
- Forms: server actions or client fetch to `/api/*`, inline French error messages from the API error code, never a raw API message.
- Destructive actions (delete document, archive plan) go through `ConfirmDialog`.
- Statuses in French: "Actif", "En retard de paiement", "Résilié", "Sans cotisation", "Certificat expiré". The UI says **cotisation**, never abonnement.
- Cookie notice: informational only (one strictly necessary session cookie), links to `/confidentialite`. Sticky at the bottom on mobile, a small card at the bottom right on desktop (clear of the sidebar).
- Accessibility: every input has a label, focus is visible, contrast at least AA.
