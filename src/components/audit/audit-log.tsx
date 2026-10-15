"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Clock, RefreshCw } from "lucide-react";

interface AuditRow {
  TS: string;
  USER: string;
  ROLE: string;
  SESSION_ID: string;
  CHANGE_TYPE: string;
  OBJECT_FQN: string;
  SQL: string;
  BEFORE: unknown;
  AFTER: unknown;
  STATUS: string;
  ERROR: string | null;
}

const CHANGE_TYPES = [
  "ALL",
  "GRANT",
  "REVOKE",
  "CREATE_POLICY",
  "ALTER_POLICY",
  "DROP_POLICY",
  "ALTER_TAG",
  "ALTER_TABLE",
  "MAPPING_INSERT",
  "MAPPING_DELETE",
];

export function AuditLog() {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedEntry, setSelectedEntry] = useState<AuditRow | null>(null);

  const { data: entries = [], isLoading, refetch } = useQuery<AuditRow[]>({
    queryKey: ["audit", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "ALL")}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {CHANGE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
        <Badge variant="outline">{entries.length} entries</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading audit log...
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          No audit entries found. Changes will appear here after you run setup.sql and apply changes.
        </div>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-1">
            {entries.map((entry, i) => (
              <button
                key={i}
                onClick={() => setSelectedEntry(entry)}
                className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left hover:bg-accent"
              >
                {entry.STATUS === "success" ? (
                  <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
                <Badge variant="outline" className="text-xs shrink-0">
                  {entry.CHANGE_TYPE}
                </Badge>
                <span className="truncate flex-1">
                  {entry.OBJECT_FQN || entry.SQL?.slice(0, 60)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {entry.USER}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.TS).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!selectedEntry}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Entry Detail</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Type: </span>
                  {selectedEntry.CHANGE_TYPE}
                </div>
                <div>
                  <span className="font-medium">Status: </span>
                  <Badge
                    variant={
                      selectedEntry.STATUS === "success"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {selectedEntry.STATUS}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">User: </span>
                  {selectedEntry.USER}
                </div>
                <div>
                  <span className="font-medium">Role: </span>
                  {selectedEntry.ROLE}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Object: </span>
                  {selectedEntry.OBJECT_FQN}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Time: </span>
                  {new Date(selectedEntry.TS).toLocaleString()}
                </div>
              </div>

              <div>
                <span className="font-medium">SQL:</span>
                <pre className="mt-1 text-xs bg-muted p-2 rounded-md overflow-x-auto whitespace-pre-wrap font-mono">
                  {selectedEntry.SQL}
                </pre>
              </div>

              {selectedEntry.ERROR && (
                <div>
                  <span className="font-medium text-destructive">Error:</span>
                  <pre className="mt-1 text-xs bg-destructive/5 p-2 rounded-md overflow-x-auto">
                    {selectedEntry.ERROR}
                  </pre>
                </div>
              )}

              {(selectedEntry.BEFORE != null || selectedEntry.AFTER != null) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Before:</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded-md overflow-x-auto max-h-32">
                      {JSON.stringify(selectedEntry.BEFORE, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-medium">After:</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded-md overflow-x-auto max-h-32">
                      {JSON.stringify(selectedEntry.AFTER, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
