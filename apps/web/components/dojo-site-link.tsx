import { cx } from "@/lib/cx";

export const DOJO_SITE_URL = "https://www.shobukan-dojo.com";

/* External link to the club's public website: new tab, no opener, no referrer. */
export function DojoSiteLink({ className, label = "Site du Shobukan Dojo" }: { className?: string; label?: string }) {
  return (
    <a href={DOJO_SITE_URL} target="_blank" rel="noopener noreferrer" className={cx("inline-flex items-center gap-1.5", className)}>
      {label}
      <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5 shrink-0">
        <path d="M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}
