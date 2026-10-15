import { RoleDag } from "@/components/dag/role-dag";

export default function RolesPage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Role Hierarchy
        </h1>
        <p className="text-sm text-muted-foreground">
          Interactive DAG of role-to-role grants with cycle detection
        </p>
      </div>
      <div className="flex-1">
        <RoleDag />
      </div>
    </div>
  );
}
