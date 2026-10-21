import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";

type MemberAvatarProps = {
  firstName: string;
  lastName: string;
  /* Same-origin photo URL through the /api rewrite, or null for the initials. */
  src: string | null;
  size?: "md" | "lg";
  className?: string;
};

const sizes = { md: "size-12 text-base", lg: "size-24 text-2xl" };

export function MemberAvatar({ firstName, lastName, src, size = "md", className }: MemberAvatarProps) {
  const box = cx("shrink-0 rounded-full", sizes[size], className);
  if (src) {
    // Plain img: the photo is served by the API with the session cookie, not by a remote loader.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`Photo de ${firstName} ${lastName}`} className={cx(box, "object-cover")} />;
  }
  return (
    <span
      aria-hidden
      className={cx(box, "inline-flex items-center justify-center bg-accent-soft font-serif font-semibold text-accent")}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
