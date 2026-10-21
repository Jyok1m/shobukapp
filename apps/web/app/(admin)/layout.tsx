import { ProtectedShell } from "@/components/shell/protected-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell role="ADMIN">{children}</ProtectedShell>;
}
