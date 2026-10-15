import { AuditLog } from "@/components/audit/audit-log";

export default function AuditPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          History of all governance changes with diffs and session metadata
        </p>
      </div>
      <AuditLog />
    </div>
  );
}
