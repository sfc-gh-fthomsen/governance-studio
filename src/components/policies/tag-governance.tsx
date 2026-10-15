"use client";

import { useMemo, useState } from "react";
import { usePolicies } from "@/lib/api-client";
import { useStagingStore } from "@/store/staging";
import {
  detectTagConflicts,
  type TagConflict,
} from "@/lib/conflict-detection";
import { fqn } from "@/lib/sql-utils";
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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tag,
  AlertTriangle,
  AlertCircle,
  Shield,
  Plus,
} from "lucide-react";
import type { PolicyReference, TagReference } from "@/types/governance";

const MASK_TEMPLATES = [
  { label: "Email Mask", value: "MASK_EMAIL" },
  { label: "Partial Mask", value: "MASK_PARTIAL" },
  { label: "Hash Mask", value: "MASK_HASH" },
  { label: "Null Mask", value: "MASK_NULL" },
];

export function TagGovernance() {
  const { data: policiesData, isLoading, error } = usePolicies("all");
  const { addChange } = useStagingStore();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [assignTemplate, setAssignTemplate] = useState("");

  const tags = policiesData?.tags ?? [];
  const policyRefs = (policiesData?.policyReferences ?? []) as unknown as PolicyReference[];
  const tagRefs = (policiesData?.tagReferences ?? []) as unknown as TagReference[];
  const maskingPolicies = policiesData?.maskingPolicies ?? [];

  // Build tag -> attached masking policies map
  const tagPolicyMap = useMemo(() => {
    const map = new Map<string, string[]>();
    // Tag-based masking policies are tracked via POLICY_REFERENCES
    // where the ref_entity_domain is 'TAG'
    for (const pr of policyRefs) {
      if (pr.policy_kind !== "MASKING_POLICY") continue;
      if (pr.ref_entity_domain === "TAG") {
        const tagFqn = `${pr.ref_database_name}.${pr.ref_schema_name}.${pr.ref_entity_name}`;
        const existing = map.get(tagFqn) ?? [];
        existing.push(`${pr.policy_db}.${pr.policy_schema}.${pr.policy_name}`);
        map.set(tagFqn, existing);
      }
    }
    return map;
  }, [policyRefs]);

  // Tag references grouped by tag
  const tagRefsByTag = useMemo(() => {
    const map = new Map<string, TagReference[]>();
    for (const tr of tagRefs) {
      const key = `${tr.tag_database}.${tr.tag_schema}.${tr.tag_name}`;
      const existing = map.get(key) ?? [];
      existing.push(tr);
      map.set(key, existing);
    }
    return map;
  }, [tagRefs]);

  // Conflict detection
  const conflicts = useMemo(
    () => detectTagConflicts(policyRefs, tagRefs, tagPolicyMap),
    [policyRefs, tagRefs, tagPolicyMap]
  );

  const errorCount = conflicts.filter((c) => c.severity === "error").length;
  const warningCount = conflicts.filter((c) => c.severity === "warning").length;

  function handleAssignPolicy(tagFqnStr: string) {
    if (!assignTemplate) return;

    const parts = tagFqnStr.split(".");
    const safeFqn = fqn(parts[0], parts[1], parts[2]);
    const policyName = `mask_tag_${parts[2]}_${assignTemplate.toLowerCase()}`;
    const policyFqn = fqn("GOVERNANCE_DB", "PUBLIC", policyName);

    addChange({
      id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "ALTER_TAG",
      description: `Set masking policy ${policyName} on tag ${parts[2]}`,
      sql: `ALTER TAG ${safeFqn} SET MASKING POLICY ${policyFqn}`,
      status: "pending",
    });

    setAssignTemplate("");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Loading tag data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-destructive">
        Failed to load: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Conflict Summary */}
      {conflicts.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-sm">
              Policy Conflicts Detected
            </span>
            {errorCount > 0 && (
              <Badge variant="destructive">{errorCount} error{errorCount !== 1 ? "s" : ""}</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary">{warningCount} warning{warningCount !== 1 ? "s" : ""}</Badge>
            )}
          </div>
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {conflicts.map((c, i) => (
                <ConflictRow key={i} conflict={c} />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Tag List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tags Panel */}
        <div className="lg:col-span-1 border rounded-lg">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-medium text-sm">Tags ({tags.length})</h3>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-1">
              {tags.map((tag) => {
                const tagFqnStr = `${tag.database_name}.${tag.schema_name}.${tag.name}`;
                const policies = tagPolicyMap.get(tagFqnStr) ?? [];
                const refs = tagRefsByTag.get(tagFqnStr) ?? [];
                const hasConflict = conflicts.some((c) =>
                  c.details.tags?.includes(tagFqnStr)
                );

                return (
                  <button
                    key={tagFqnStr}
                    onClick={() => setSelectedTag(tagFqnStr)}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left hover:bg-accent ${
                      selectedTag === tagFqnStr ? "bg-accent" : ""
                    }`}
                  >
                    <Tag className="h-4 w-4 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{tag.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {tag.database_name}.{tag.schema_name}
                      </div>
                    </div>
                    {policies.length > 0 && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Shield className="h-3 w-3 mr-1" />
                        {policies.length}
                      </Badge>
                    )}
                    {refs.length > 0 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {refs.length} ref{refs.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {hasConflict && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </button>
                );
              })}
              {tags.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No tags found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 border rounded-lg">
          {selectedTag ? (
            <TagDetail
              tagFqn={selectedTag}
              tags={tags}
              attachedPolicies={tagPolicyMap.get(selectedTag) ?? []}
              references={tagRefsByTag.get(selectedTag) ?? []}
              conflicts={conflicts.filter((c) =>
                c.details.tags?.includes(selectedTag)
              )}
              maskingPolicies={maskingPolicies}
              assignTemplate={assignTemplate}
              onAssignTemplateChange={setAssignTemplate}
              onAssignPolicy={() => handleAssignPolicy(selectedTag)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8">
              Select a tag to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagDetail({
  tagFqn,
  tags,
  attachedPolicies,
  references,
  conflicts,
  maskingPolicies,
  assignTemplate,
  onAssignTemplateChange,
  onAssignPolicy,
}: {
  tagFqn: string;
  tags: { name: string; database_name: string; schema_name: string; allowed_values: string[] }[];
  attachedPolicies: string[];
  references: TagReference[];
  conflicts: TagConflict[];
  maskingPolicies: { name: string; database_name: string; schema_name: string }[];
  assignTemplate: string;
  onAssignTemplateChange: (v: string) => void;
  onAssignPolicy: () => void;
}) {
  const parts = tagFqn.split(".");
  const tag = tags.find(
    (t) =>
      t.database_name === parts[0] &&
      t.schema_name === parts[1] &&
      t.name === parts[2]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold">{parts[2]}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {parts[0]}.{parts[1]}
        </p>
        {tag?.allowed_values && tag.allowed_values.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tag.allowed_values.map((v) => (
              <Badge key={v} variant="outline" className="text-xs">
                {v}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-5">
          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-destructive">Conflicts</h4>
              <div className="space-y-2">
                {conflicts.map((c, i) => (
                  <ConflictRow key={i} conflict={c} />
                ))}
              </div>
            </div>
          )}

          {/* Attached Masking Policies */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Masking Policies ({attachedPolicies.length})
            </h4>
            {attachedPolicies.length > 0 ? (
              <div className="space-y-1">
                {attachedPolicies.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                  >
                    <Shield className="h-3.5 w-3.5 text-blue-500" />
                    {p}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No masking policies attached
              </p>
            )}

            <Separator className="my-3" />

            {/* Assign policy */}
            <div className="flex items-center gap-2">
              <Select value={assignTemplate} onValueChange={(v) => onAssignTemplateChange(v ?? "")}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Assign policy..." />
                </SelectTrigger>
                <SelectContent>
                  {MASK_TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                  {maskingPolicies.map((mp) => (
                    <SelectItem
                      key={`${mp.database_name}.${mp.schema_name}.${mp.name}`}
                      value={`${mp.database_name}.${mp.schema_name}.${mp.name}`}
                    >
                      {mp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={onAssignPolicy}
                disabled={!assignTemplate}
                className="h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Attach
              </Button>
            </div>
          </div>

          {/* Tag References */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Tagged Objects ({references.length})
            </h4>
            {references.length > 0 ? (
              <div className="space-y-1">
                {references.map((ref, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                  >
                    <Badge variant="outline" className="text-xs">
                      {ref.domain}
                    </Badge>
                    <span className="truncate">
                      {ref.object_database}.{ref.object_schema}.{ref.object_name}
                      {ref.column_name ? `.${ref.column_name}` : ""}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      = {ref.tag_value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No objects tagged
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ConflictRow({ conflict }: { conflict: TagConflict }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button className="w-full flex items-start gap-2 rounded-md px-3 py-2 text-sm text-left hover:bg-muted/50" />
        }
      >
        {conflict.severity === "error" ? (
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="font-medium">
            {conflict.type.replace(/_/g, " ")}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {conflict.entity}
          </div>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {conflict.severity === "error" ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            {conflict.type.replace(/_/g, " ")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>{conflict.message}</p>
          {conflict.details.tags && (
            <div>
              <span className="font-medium">Tags: </span>
              {conflict.details.tags.join(", ")}
            </div>
          )}
          {conflict.details.policies && (
            <div>
              <span className="font-medium">Policies: </span>
              {conflict.details.policies.join(", ")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
