"use client";

import { useState, useMemo } from "react";
import { PolicyMatrix } from "@/components/matrix/policy-matrix";
import {
  useDatabases,
  useSchemas,
  useTables,
  useColumns,
  useDatabaseRoles,
} from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStagingStore } from "@/store/staging";

export default function MatrixPage() {
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<string>("");

  const { data: databases } = useDatabases();
  const { data: schemas } = useSchemas(selectedDb || null);
  const { data: tables } = useTables(
    selectedDb || null,
    selectedSchema || null
  );
  const { data: columns } = useColumns(
    selectedDb || null,
    selectedSchema || null,
    selectedTable || null
  );
  const { data: filteredRoles } = useDatabaseRoles(
    selectedDb || null,
    selectedSchema || null
  );

  const changes = useStagingStore((s) => s.changes);
  const pendingCount = changes.filter((c) => c.status === "pending").length;

  // Build entity list from selected scope
  const entities = useMemo(() => {
    if (selectedTable && columns) {
      return columns.map((c) => ({
        key: `${selectedDb}.${selectedSchema}.${selectedTable}.${c.name}`,
        label: c.name,
        type: "column" as const,
        dataType: c.data_type,
      }));
    }
    if (selectedSchema && tables) {
      return tables.map((t) => ({
        key: `${selectedDb}.${selectedSchema}.${t.name}`,
        label: t.name,
        type: "table" as const,
      }));
    }
    if (selectedDb && schemas) {
      return schemas.map((s) => ({
        key: `${selectedDb}.${s.name}`,
        label: s.name,
        type: "schema" as const,
      }));
    }
    return [];
  }, [selectedDb, selectedSchema, selectedTable, columns, tables, schemas]);

  const roleNames = useMemo(
    () => filteredRoles ?? [],
    [filteredRoles]
  );

  // Reset dependent selects on parent change
  function onDbChange(val: string | null) {
    setSelectedDb(val ?? "");
    setSelectedSchema("");
    setSelectedTable("");
  }
  function onSchemaChange(val: string | null) {
    setSelectedSchema(val ?? "");
    setSelectedTable("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          RBAC / Masking
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Map access grants and masking policies to roles across your data
          entities
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Database</Label>
          <Select value={selectedDb} onValueChange={onDbChange}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              {databases?.map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedDb && (
          <div className="space-y-1">
            <Label className="text-xs">Schema</Label>
            <Select value={selectedSchema} onValueChange={onSchemaChange}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Select schema" />
              </SelectTrigger>
              <SelectContent>
                {schemas?.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedSchema && (
          <div className="space-y-1">
            <Label className="text-xs">Table (optional)</Label>
            <Select value={selectedTable} onValueChange={(v) => setSelectedTable(v ?? "")}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                {tables?.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {pendingCount > 0 && (
          <Badge variant="secondary" className="mb-0.5">
            {pendingCount} staged change{pendingCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Grid */}
      {entities.length > 0 && roleNames.length > 0 ? (
        <PolicyMatrix entities={entities} roles={roleNames} />
      ) : (
        <div className="flex items-center justify-center h-64 rounded-lg border border-dashed text-sm text-muted-foreground">
          {!selectedDb
            ? "Select a database to begin"
            : !selectedSchema
              ? "Select a schema to load entities"
              : "No entities found"}
        </div>
      )}
    </div>
  );
}
