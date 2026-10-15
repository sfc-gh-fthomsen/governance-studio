"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useDatabases,
  useSchemas,
  useTables,
  useColumns,
  useDatabaseRoles,
  useDistinctValues,
  useRlsMapping,
} from "@/lib/api-client";
import { useStagingStore } from "@/store/staging";
import { generateValueBasedRlsDDL } from "@/lib/ddl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Check, Filter, Plus, Shield } from "lucide-react";

interface PendingChange {
  role: string;
  value: string;
  action: "add" | "remove";
}

export function RlsEditor() {
  const [selectedDb, setSelectedDb] = useState("");
  const [selectedSchema, setSelectedSchema] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  const { addChange } = useStagingStore();

  const { data: databases } = useDatabases();
  const { data: schemas } = useSchemas(selectedDb || null);
  const { data: tables } = useTables(selectedDb || null, selectedSchema || null);
  const { data: columns } = useColumns(
    selectedDb || null,
    selectedSchema || null,
    selectedTable || null
  );
  const { data: filteredRoles } = useDatabaseRoles(
    selectedDb || null,
    selectedSchema || null
  );

  const tableFqn =
    selectedDb && selectedSchema && selectedTable
      ? `${selectedDb}.${selectedSchema}.${selectedTable}`
      : null;

  const { data: distinctValues, isLoading: valuesLoading } = useDistinctValues(
    tableFqn,
    selectedColumn || null
  );
  const { data: existingMapping } = useRlsMapping(
    tableFqn,
    selectedColumn || null
  );

  const roles = filteredRoles ?? [];

  // Build lookup set: "role|value" -> true if mapped
  const mappingSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of existingMapping ?? []) {
      set.add(`${m.role_name}|${m.allowed_value}`);
    }
    // Apply pending changes
    for (const pc of pendingChanges) {
      const key = `${pc.role}|${pc.value}`;
      if (pc.action === "add") set.add(key);
      else set.delete(key);
    }
    return set;
  }, [existingMapping, pendingChanges]);

  function isChecked(role: string, value: string): boolean {
    return mappingSet.has(`${role}|${value}`);
  }

  function toggleMapping(role: string, value: string) {
    const key = `${role}|${value}`;
    const currentlyChecked = mappingSet.has(key);
    const action = currentlyChecked ? "remove" : "add";

    setPendingChanges((prev) => [
      ...prev.filter((p) => !(p.role === role && p.value === value)),
      { role, value, action },
    ]);
  }

  const pendingCount = pendingChanges.length;

  const handleStageChanges = useCallback(() => {
    if (!tableFqn || !selectedColumn) return;

    const addMappings = pendingChanges
      .filter((p) => p.action === "add")
      .map((p) => ({ role: p.role, value: p.value }));

    if (addMappings.length > 0) {
      const changes = generateValueBasedRlsDDL(
        tableFqn,
        selectedColumn,
        addMappings
      );
      changes.forEach(addChange);
    }

    // For removes, stage DELETE statements
    for (const pc of pendingChanges.filter((p) => p.action === "remove")) {
      addChange({
        id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "MAPPING_DELETE",
        description: `Remove ${pc.role} access to ${selectedColumn} = '${pc.value}'`,
        sql: `DELETE FROM GOVERNANCE_DB.PUBLIC.RLS_VALUE_MAPPING
WHERE table_fqn = '${tableFqn.replace(/'/g, "''")}' AND filter_column = '${selectedColumn.replace(/'/g, "''")}'
  AND role_name = '${pc.role.replace(/'/g, "''")}' AND allowed_value = '${pc.value.replace(/'/g, "''")}'`,
        status: "pending",
      });
    }

    setPendingChanges([]);
  }, [tableFqn, selectedColumn, pendingChanges, addChange]);

  // Reset helpers
  function onDbChange(val: string | null) {
    setSelectedDb(val ?? "");
    setSelectedSchema("");
    setSelectedTable("");
    setSelectedColumn("");
    setPendingChanges([]);
  }
  function onSchemaChange(val: string | null) {
    setSelectedSchema(val ?? "");
    setSelectedTable("");
    setSelectedColumn("");
    setPendingChanges([]);
  }
  function onTableChange(val: string | null) {
    setSelectedTable(val ?? "");
    setSelectedColumn("");
    setPendingChanges([]);
  }
  function onColumnChange(val: string | null) {
    setSelectedColumn(val ?? "");
    setPendingChanges([]);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Selectors: DB > Schema > Table > Filter Column */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Database</Label>
          <Select value={selectedDb} onValueChange={onDbChange}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              {databases?.map((d) => (
                <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedDb && (
          <div className="space-y-1">
            <Label className="text-xs">Schema</Label>
            <Select value={selectedSchema} onValueChange={onSchemaChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select schema" />
              </SelectTrigger>
              <SelectContent>
                {schemas?.map((s) => (
                  <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedSchema && (
          <div className="space-y-1">
            <Label className="text-xs">Table</Label>
            <Select value={selectedTable} onValueChange={onTableChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {tables?.map((t) => (
                  <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedTable && (
          <div className="space-y-1">
            <Label className="text-xs">Filter Column</Label>
            <Select value={selectedColumn} onValueChange={onColumnChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {columns?.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Mapping grid */}
      {selectedColumn && tableFqn ? (
        <>
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Filtering <strong>{selectedTable}</strong> by <strong>{selectedColumn}</strong>
            </span>
            {distinctValues && (
              <Badge variant="outline">{distinctValues.length} distinct values</Badge>
            )}
            {roles.length > 0 && (
              <Badge variant="outline">{roles.length} roles</Badge>
            )}
            {pendingCount > 0 && (
              <>
                <Badge variant="secondary">
                  {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
                </Badge>
                <Button size="sm" onClick={handleStageChanges}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Stage Changes
                </Button>
              </>
            )}
          </div>

          <Separator />

          {valuesLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Loading distinct values...
            </div>
          ) : distinctValues && distinctValues.length > 0 && roles.length > 0 ? (
            <ScrollArea className="max-h-[600px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/30 min-w-[180px]">
                        {selectedColumn}
                      </th>
                      {roles.map((role) => (
                        <th
                          key={role}
                          className="text-center px-2 py-2 font-medium min-w-[120px]"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <Shield className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">{role}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distinctValues.map((val) => (
                      <tr key={val} className="border-b hover:bg-accent/30">
                        <td className="px-3 py-1.5 font-medium sticky left-0 bg-background">
                          {val}
                        </td>
                        {roles.map((role) => {
                          const checked = isChecked(role, val);
                          const hasPending = pendingChanges.some(
                            (p) => p.role === role && p.value === val
                          );
                          return (
                            <td key={role} className="text-center px-2 py-1.5">
                              <button
                                onClick={() => toggleMapping(role, val)}
                                className={`inline-flex items-center justify-center h-6 w-6 rounded border transition-colors ${
                                  checked
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-input hover:border-primary/50"
                                } ${hasPending ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
                              >
                                {checked && <Check className="h-3.5 w-3.5" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              {!distinctValues || distinctValues.length === 0
                ? "No distinct values found in this column"
                : "No roles with access to this database"}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-64 rounded-lg border border-dashed text-sm text-muted-foreground">
          {!selectedDb
            ? "Select a database to begin"
            : !selectedSchema
              ? "Select a schema"
              : !selectedTable
                ? "Select a table"
                : "Select a filter column to configure row-level security"}
        </div>
      )}
    </div>
  );
}
