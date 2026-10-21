import { Badge } from "@/components/ui/badge";
import { membershipStatus } from "@/lib/format";

export function MembershipBadge({ status }: { status: string | null }) {
  const { label, tone } = membershipStatus(status);
  return <Badge tone={tone}>{label}</Badge>;
}
