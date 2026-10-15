import { RlsEditor } from "@/components/rls/rls-editor";

export default function RlsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Row-Level Security
        </h1>
        <p className="text-sm text-muted-foreground">
          Control which rows each role can see by mapping roles to allowed
          column values
        </p>
      </div>
      <RlsEditor />
    </div>
  );
}
