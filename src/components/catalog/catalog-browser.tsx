"use client";

import { useState } from "react";
import {
  useDatabases,
  useSchemas,
  useTables,
  useColumns,
} from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  FolderOpen,
  Table2,
  Columns3,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

type Level = "databases" | "schemas" | "tables" | "columns";

interface BreadcrumbItem {
  level: Level;
  label: string;
}

export function CatalogBrowser() {
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: databases, isLoading: dbLoading } = useDatabases();
  const { data: schemas, isLoading: schemaLoading } = useSchemas(selectedDb);
  const { data: tables, isLoading: tableLoading } = useTables(
    selectedDb,
    selectedSchema
  );
  const { data: columns, isLoading: colLoading } = useColumns(
    selectedDb,
    selectedSchema,
    selectedTable
  );

  const currentLevel: Level = selectedTable
    ? "columns"
    : selectedSchema
      ? "tables"
      : selectedDb
        ? "schemas"
        : "databases";

  const breadcrumbs: BreadcrumbItem[] = [{ level: "databases", label: "Databases" }];
  if (selectedDb) breadcrumbs.push({ level: "schemas", label: selectedDb });
  if (selectedSchema) breadcrumbs.push({ level: "tables", label: selectedSchema });
  if (selectedTable) breadcrumbs.push({ level: "columns", label: selectedTable });

  function navigateTo(item: BreadcrumbItem) {
    if (item.level === "databases") {
      setSelectedDb(null);
      setSelectedSchema(null);
      setSelectedTable(null);
    } else if (item.level === "schemas") {
      setSelectedSchema(null);
      setSelectedTable(null);
    } else if (item.level === "tables") {
      setSelectedTable(null);
    }
  }

  function goBack() {
    if (selectedTable) setSelectedTable(null);
    else if (selectedSchema) setSelectedSchema(null);
    else if (selectedDb) setSelectedDb(null);
  }

  const isLoading = dbLoading || schemaLoading || tableLoading || colLoading;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        {currentLevel !== "databases" && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {breadcrumbs.map((bc, i) => (
          <span key={bc.level} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => navigateTo(bc)}
              className={`hover:underline ${i === breadcrumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {bc.label}
            </button>
          </span>
        ))}
      </div>

      <Separator />

      {isLoading && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading...
        </div>
      )}

      <ScrollArea className="h-[600px]">
        <div className="grid gap-1">
          {currentLevel === "databases" &&
            databases?.map((db) => (
              <button
                key={db.name}
                onClick={() => setSelectedDb(db.name)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <Database className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{db.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {db.owner}
                </span>
              </button>
            ))}

          {currentLevel === "schemas" &&
            schemas?.map((s) => (
              <button
                key={s.name}
                onClick={() => setSelectedSchema(s.name)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <FolderOpen className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.owner}
                </span>
              </button>
            ))}

          {currentLevel === "tables" &&
            tables?.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTable(t.name)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <Table2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{t.name}</span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {t.kind}
                </Badge>
                {t.row_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t.row_count.toLocaleString()} rows
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {t.owner}
                </span>
              </button>
            ))}

          {currentLevel === "columns" &&
            columns?.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
              >
                <Columns3 className="h-4 w-4 text-purple-500" />
                <span className="font-medium">{c.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {c.data_type}
                </Badge>
                {c.is_nullable && (
                  <span className="text-xs text-muted-foreground">nullable</span>
                )}
              </div>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
