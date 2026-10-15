import { AppShell } from "@/components/layout/app-shell";
import { ConnectionGuard } from "@/components/layout/connection-guard";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ConnectionGuard>
      <AppShell>{children}</AppShell>
    </ConnectionGuard>
  );
}
