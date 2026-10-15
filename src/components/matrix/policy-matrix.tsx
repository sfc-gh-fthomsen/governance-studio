"use client";

import { useCallback, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  type ColDef,
  type CellValueChangedEvent,
  type CellClassParams,
  ModuleRegistry,
} from "ag-grid-community";
import { useStagingStore } from "@/store/staging";
import {
  generateAccessGrantDDL,
  generateMaskingPolicyDDL,
  generateMappingTableDDL,
  isMaskRule,
  isConditionRule,
} from "@/lib/ddl";
import type { PolicyCell, AccessRule } from "@/types/governance";

ModuleRegistry.registerModules([AllCommunityModule]);

const RULE_OPTIONS = [
  "",
  "FULL_ACCESS",
  "NO_ACCESS",
  "MASK_EMAIL",
  "MASK_PARTIAL",
  "MASK_HASH",
  "MASK_NULL",
];

function cellStyle(params: CellClassParams): Record<string, string> | null {
  const val = params.value as string;
  if (!val) return null;
  if (val === "FULL_ACCESS") return { backgroundColor: "hsl(142 71% 90%)", color: "hsl(142 71% 25%)" };
  if (val === "NO_ACCESS") return { backgroundColor: "hsl(0 84% 92%)", color: "hsl(0 84% 30%)" };
  if (val.startsWith("MASK_")) return { backgroundColor: "hsl(48 96% 89%)", color: "hsl(48 96% 30%)" };
  return { backgroundColor: "hsl(217 91% 92%)", color: "hsl(217 91% 30%)" };
}

interface MatrixRow {
  entityKey: string;
  entityLabel: string;
  entityType: "database" | "schema" | "table" | "column";
  [role: string]: string;
}

interface PolicyMatrixProps {
  entities: {
    key: string;
    label: string;
    type: "database" | "schema" | "table" | "column";
    dataType?: string;
  }[];
  roles: string[];
  existingCells?: PolicyCell[];
}

export function PolicyMatrix({
  entities,
  roles,
  existingCells = [],
}: PolicyMatrixProps) {
  const { addChange } = useStagingStore();
  const [pendingCells, setPendingCells] = useState<PolicyCell[]>([]);

  const allCells = useMemo(
    () => [...existingCells, ...pendingCells],
    [existingCells, pendingCells]
  );

  // Build row data
  const rowData: MatrixRow[] = useMemo(() => {
    return entities.map((entity) => {
      const row: MatrixRow = {
        entityKey: entity.key,
        entityLabel: entity.label,
        entityType: entity.type,
      };
      for (const role of roles) {
        const cell = allCells.find(
          (c) => c.entityKey === entity.key && c.roleOrUser === role
        );
        row[role] = cell?.rule ?? "";
      }
      return row;
    });
  }, [entities, roles, allCells]);

  // Column definitions
  const columnDefs: ColDef[] = useMemo(() => {
    const entityCol: ColDef = {
      field: "entityLabel",
      headerName: "Entity",
      pinned: "left",
      width: 280,
      editable: false,
      cellClass: "font-medium",
    };

    const roleCols: ColDef[] = roles.map((role) => ({
      field: role,
      headerName: role,
      width: 160,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: RULE_OPTIONS },
      cellStyle,
    }));

    return [entityCol, ...roleCols];
  }, [roles]);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<MatrixRow>) => {
      const role = event.colDef.field;
      if (!role || role === "entityLabel") return;

      const entityKey = event.data?.entityKey;
      const newValue = (event.newValue as string) ?? "";
      const oldValue = (event.oldValue as string) ?? "";

      if (!entityKey || newValue === oldValue) return;

      const cell: PolicyCell = {
        entityKey,
        roleOrUser: role,
        rule: newValue as AccessRule,
      };

      // Track in local pending state
      setPendingCells((prev) => [
        ...prev.filter(
          (c) => !(c.entityKey === entityKey && c.roleOrUser === role)
        ),
        ...(newValue ? [cell] : []),
      ]);

      // Generate DDL changes and add to staging
      if (newValue === "FULL_ACCESS" || newValue === "NO_ACCESS") {
        const changes = generateAccessGrantDDL(
          entityKey,
          role,
          newValue as "FULL_ACCESS" | "NO_ACCESS"
        );
        changes.forEach(addChange);
      } else if (isMaskRule(newValue)) {
        const entity = entities.find((e) => e.key === entityKey);
        const changes = generateMaskingPolicyDDL(
          entityKey,
          newValue,
          entity?.dataType ?? "VARCHAR"
        );
        changes.forEach(addChange);
      } else if (isConditionRule(newValue)) {
        const changes = generateMappingTableDDL([cell]);
        changes.forEach(addChange);
      }
    },
    [addChange, entities]
  );

  return (
    <div className="h-[600px] w-full ag-theme-alpine">
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={{
          resizable: true,
          sortable: true,
          filter: true,
        }}
        onCellValueChanged={onCellValueChanged}
        animateRows
        rowSelection="multiple"
        suppressRowClickSelection
        getRowId={(params) => params.data.entityKey}
      />
    </div>
  );
}
