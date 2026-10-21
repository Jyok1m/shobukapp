import { ProtectedShell } from "@/components/shell/protected-shell";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
