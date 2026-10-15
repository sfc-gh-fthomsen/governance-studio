"use client";

import { useState, useMemo } from "react";
import { useStagingStore } from "@/store/staging";
import { useSession } from "@/lib/api-client";
import { executeStatements } from "@/lib/api-client";
import { checkGuardrails, type GuardrailResult } from "@/lib/guardrails";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Download,
  Loader2,
  Play,
  Trash2,
  X,
} from "lucide-react";
import type { ChangeItem } from "@/types/governance";

export function ReviewDrawer() {
  const {
    changes,
    mode,
    removeChange,
    clearChanges,
    updateChangeStatus,
  } = useStagingStore();
  const { data: session } = useSession();
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const pendingChanges = changes.filter((c) => c.status === "pending");
  const completedChanges = changes.filter((c) => c.status === "success");
  const failedChanges = changes.filter((c) => c.status === "error");

  const guardrailResults = useMemo(() => {
    if (!session) return [];
    return checkGuardrails(
      pendingChanges,
      session.currentRole,
      session.currentUser
    );
  }, [pendingChanges, session]);

  const blockedIds = new Set(
    guardrailResults.filter((g) => g.blocked).map((g) => g.changeId)
  );
  const confirmIds = new Set(
    guardrailResults
      .filter((g) => g.requiresConfirmation)
      .map((g) => g.changeId)
  );

  const executableChanges = pendingChanges.filter(
    (c) => !blockedIds.has(c.id)
  );
  const needsConfirmation = executableChanges.some((c) =>
    confirmIds.has(c.id)
  );

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function generateScript(): string {
    return pendingChanges
      .filter((c) => !blockedIds.has(c.id))
      .map((c) => `-- ${c.description}\n${c.sql};`)
      .join("\n\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(generateScript());
  }

  function handleDownload() {
    const blob = new Blob([generateScript()], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `governance-changes-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExecute() {
    if (needsConfirmation && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }
    setShowConfirmDialog(false);
    setIsExecuting(true);

    try {
      const statements = executableChanges.map((c) => c.sql);
      const dryRun = mode === "dry-run";
      const result = await executeStatements(statements, dryRun);

      if (dryRun) {
        // In dry-run mode, just mark as previewed
        for (const c of executableChanges) {
          updateChangeStatus(c.id, "success");
        }
      } else if (result.results) {
        for (let i = 0; i < result.results.length; i++) {
          const r = result.results[i];
          const change = executableChanges[i];
          if (change) {
            updateChangeStatus(
              change.id,
              r.status === "success" ? "success" : "error",
              r.error
            );
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const c of executableChanges) {
        updateChangeStatus(c.id, "error", msg);
      }
    } finally {
      setIsExecuting(false);
    }
  }

  function guardrailFor(id: string): GuardrailResult | undefined {
    return guardrailResults.find((g) => g.changeId === id);
  }

  return (
    <>
      <Sheet>
        <SheetTrigger render={<Button size="sm" disabled={changes.length === 0} />}>
          Review & Apply
          {pendingChanges.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingChanges.length}
            </Badge>
          )}
        </SheetTrigger>
        <SheetContent className="w-[540px] sm:w-[640px] flex flex-col">
          <SheetHeader>
            <SheetTitle>Review Changes</SheetTitle>
          </SheetHeader>

          {/* Summary badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">
              {pendingChanges.length} pending
            </Badge>
            {completedChanges.length > 0 && (
              <Badge variant="default">
                {completedChanges.length} applied
              </Badge>
            )}
            {failedChanges.length > 0 && (
              <Badge variant="destructive">
                {failedChanges.length} failed
              </Badge>
            )}
            {blockedIds.size > 0 && (
              <Badge variant="destructive">
                <Ban className="h-3 w-3 mr-1" />
                {blockedIds.size} blocked
              </Badge>
            )}
            <Badge variant="secondary">
              Mode: {mode}
            </Badge>
          </div>

          {/* Guardrail warnings */}
          {guardrailResults.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              {guardrailResults.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {g.blocked ? (
                    <Ban className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                  )}
                  <span>{g.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Change list */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-1">
              {changes.map((change) => (
                <ChangeRow
                  key={change.id}
                  change={change}
                  expanded={expandedIds.has(change.id)}
                  onToggle={() => toggleExpanded(change.id)}
                  onRemove={() => removeChange(change.id)}
                  guardrail={guardrailFor(change.id)}
                />
              ))}
              {changes.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No changes staged
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={pendingChanges.length === 0}
            >
              <ClipboardCopy className="h-3.5 w-3.5 mr-1" />
              Copy SQL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={pendingChanges.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export .sql
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChanges}
              disabled={changes.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={
                executableChanges.length === 0 || isExecuting
              }
            >
              {isExecuting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              {mode === "dry-run" ? "Preview" : "Apply"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog for guardrail warnings */}
      <Dialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Execution
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Some changes have guardrail warnings. Are you sure you want to
              proceed?
            </p>
            <div className="space-y-1">
              {guardrailResults
                .filter((g) => g.requiresConfirmation)
                .map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                    <span>{g.message}</span>
                  </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleExecute}>
                Execute Anyway
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChangeRow({
  change,
  expanded,
  onToggle,
  onRemove,
  guardrail,
}: {
  change: ChangeItem;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  guardrail?: GuardrailResult;
}) {
  const statusIcon = {
    pending: null,
    executing: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
    success: <Check className="h-3.5 w-3.5 text-green-500" />,
    error: <X className="h-3.5 w-3.5 text-destructive" />,
  }[change.status];

  return (
    <div
      className={`rounded-md border text-sm ${
        guardrail?.blocked
          ? "border-destructive/50 bg-destructive/5"
          : change.status === "error"
            ? "border-destructive/30"
            : change.status === "success"
              ? "border-green-500/30"
              : ""
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <Badge variant="outline" className="text-xs shrink-0">
          {change.type}
        </Badge>
        <span className="flex-1 truncate">{change.description}</span>
        {statusIcon}
        {guardrail?.blocked && (
          <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
        )}
        {guardrail?.requiresConfirmation && (
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        )}
        {change.status === "pending" && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="hover:text-destructive cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto whitespace-pre-wrap font-mono">
            {change.sql}
          </pre>
          {change.error && (
            <div className="text-xs text-destructive">{change.error}</div>
          )}
          {guardrail && (
            <div className="text-xs text-yellow-600">{guardrail.message}</div>
          )}
        </div>
      )}
    </div>
  );
}
