import { TagGovernance } from "@/components/policies/tag-governance";

export default function TagsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tag Governance
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage tag-based masking policies and detect conflicts
        </p>
      </div>
      <TagGovernance />
    </div>
  );
}
