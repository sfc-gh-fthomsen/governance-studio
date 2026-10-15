import type { PolicyReference, TagReference } from "@/types/governance";

export interface TagConflict {
  severity: "error" | "warning";
  type:
    | "DIRECT_AND_TAG_POLICY"
    | "MULTIPLE_TAG_POLICIES"
    | "INHERITED_TAG_OVERLAP";
  message: string;
  entity: string;
  details: {
    tags?: string[];
    policies?: string[];
    column?: string;
  };
}

/**
 * Detect conflicts between tag-based and direct masking policy assignments.
 *
 * Conflict types:
 * 1. DIRECT_AND_TAG_POLICY — a column has both a direct masking policy and
 *    a tag-based masking policy (the direct policy wins at runtime, but
 *    the admin may not intend that).
 * 2. MULTIPLE_TAG_POLICIES — a column is tagged with two or more tags that
 *    each have masking policies for the same data type.
 * 3. INHERITED_TAG_OVERLAP — a table-level tag propagates masking to
 *    columns that already have their own column-level tag with a policy.
 */
export function detectTagConflicts(
  policyRefs: PolicyReference[],
  tagRefs: TagReference[],
  tagPolicies: Map<string, string[]> // tag FQN -> attached masking policy names
): TagConflict[] {
  const conflicts: TagConflict[] = [];

  // Index: column FQN -> direct masking policies
  const directPoliciesByColumn = new Map<string, string[]>();
  for (const pr of policyRefs) {
    if (pr.policy_kind !== "MASKING_POLICY") continue;
    if (!pr.ref_column_name) continue;
    const colFqn = `${pr.ref_database_name}.${pr.ref_schema_name}.${pr.ref_entity_name}.${pr.ref_column_name}`;
    const existing = directPoliciesByColumn.get(colFqn) ?? [];
    existing.push(`${pr.policy_db}.${pr.policy_schema}.${pr.policy_name}`);
    directPoliciesByColumn.set(colFqn, existing);
  }

  // Index: column FQN -> tags with masking policies
  const tagPoliciesByColumn = new Map<string, { tag: string; policies: string[] }[]>();

  // Also track table-level tags for inherited overlap detection
  const tableLevelTags = new Map<string, { tag: string; policies: string[] }[]>();

  for (const tr of tagRefs) {
    const tagFqn = `${tr.tag_database}.${tr.tag_schema}.${tr.tag_name}`;
    const policies = tagPolicies.get(tagFqn);
    if (!policies || policies.length === 0) continue;

    if (tr.column_name) {
      // Column-level tag
      const colFqn = `${tr.object_database}.${tr.object_schema}.${tr.object_name}.${tr.column_name}`;
      const existing = tagPoliciesByColumn.get(colFqn) ?? [];
      existing.push({ tag: tagFqn, policies });
      tagPoliciesByColumn.set(colFqn, existing);
    } else if (tr.domain === "TABLE") {
      // Table-level tag — propagates to all columns
      const tableFqn = `${tr.object_database}.${tr.object_schema}.${tr.object_name}`;
      const existing = tableLevelTags.get(tableFqn) ?? [];
      existing.push({ tag: tagFqn, policies });
      tableLevelTags.set(tableFqn, existing);
    }
  }

  // Check 1: direct + tag policy on same column
  for (const [colFqn, tagEntries] of tagPoliciesByColumn) {
    const directPols = directPoliciesByColumn.get(colFqn);
    if (directPols && directPols.length > 0) {
      conflicts.push({
        severity: "error",
        type: "DIRECT_AND_TAG_POLICY",
        message: `Column ${colFqn} has both a direct masking policy and a tag-based masking policy. The direct policy takes precedence at runtime.`,
        entity: colFqn,
        details: {
          tags: tagEntries.map((e) => e.tag),
          policies: [
            ...directPols,
            ...tagEntries.flatMap((e) => e.policies),
          ],
          column: colFqn,
        },
      });
    }
  }

  // Check 2: multiple tags with masking policies on same column
  for (const [colFqn, tagEntries] of tagPoliciesByColumn) {
    if (tagEntries.length > 1) {
      conflicts.push({
        severity: "error",
        type: "MULTIPLE_TAG_POLICIES",
        message: `Column ${colFqn} is tagged with ${tagEntries.length} tags that each have masking policies. Only one can apply.`,
        entity: colFqn,
        details: {
          tags: tagEntries.map((e) => e.tag),
          policies: tagEntries.flatMap((e) => e.policies),
          column: colFqn,
        },
      });
    }
  }

  // Check 3: table-level tag propagation conflicts with column-level tags
  for (const [tableFqn, tableTagEntries] of tableLevelTags) {
    for (const [colFqn, colTagEntries] of tagPoliciesByColumn) {
      if (!colFqn.startsWith(tableFqn + ".")) continue;
      // Column already has its own tag-based policy, and the table
      // also has a tag-based policy that would propagate
      conflicts.push({
        severity: "warning",
        type: "INHERITED_TAG_OVERLAP",
        message: `Column ${colFqn} has its own tag-based masking, but table ${tableFqn} also has a tag with masking that could propagate.`,
        entity: colFqn,
        details: {
          tags: [
            ...tableTagEntries.map((e) => e.tag),
            ...colTagEntries.map((e) => e.tag),
          ],
          policies: [
            ...tableTagEntries.flatMap((e) => e.policies),
            ...colTagEntries.flatMap((e) => e.policies),
          ],
          column: colFqn,
        },
      });
    }
  }

  return conflicts;
}
