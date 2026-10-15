import type { ChangeItem } from "@/types/governance";

const PROTECTED_ROLES = new Set([
  "ACCOUNTADMIN",
  "SECURITYADMIN",
  "SYSADMIN",
  "ORGADMIN",
  "USERADMIN",
]);

export interface GuardrailResult {
  blocked: boolean;
  requiresConfirmation: boolean;
  message: string;
  changeId: string;
}

export function checkGuardrails(
  changes: ChangeItem[],
  currentRole: string,
  currentUser: string
): GuardrailResult[] {
  const results: GuardrailResult[] = [];

  for (const change of changes) {
    const upperSql = change.sql.toUpperCase();

    // Check REVOKE statements
    if (change.type === "REVOKE") {
      const targetRole = extractTargetRole(change.sql);

      if (targetRole && PROTECTED_ROLES.has(targetRole.toUpperCase())) {
        results.push({
          blocked: true,
          requiresConfirmation: false,
          message: `Blocked: cannot revoke from system role ${targetRole}. This could lock out administrative access.`,
          changeId: change.id,
        });
        continue;
      }

      if (targetRole && targetRole.toUpperCase() === currentRole.toUpperCase()) {
        results.push({
          blocked: false,
          requiresConfirmation: true,
          message: `Warning: you are revoking from your current role (${currentRole}). This may lock you out of this session.`,
          changeId: change.id,
        });
        continue;
      }

      if (upperSql.includes(currentUser.toUpperCase())) {
        results.push({
          blocked: false,
          requiresConfirmation: true,
          message: `Warning: this REVOKE affects your own user (${currentUser}). You may lose access.`,
          changeId: change.id,
        });
        continue;
      }
    }

    // Check DROP on system-referenced policies
    if (change.type === "DROP_POLICY") {
      if (
        PROTECTED_ROLES.has(extractTargetRole(change.sql)?.toUpperCase() ?? "")
      ) {
        results.push({
          blocked: true,
          requiresConfirmation: false,
          message: `Blocked: cannot drop a policy owned by a system role.`,
          changeId: change.id,
        });
        continue;
      }
    }

    // Check row access policies that might hide all rows from admin
    if (
      change.type === "CREATE_POLICY" &&
      upperSql.includes("ROW ACCESS POLICY")
    ) {
      const mentionsAdmin = [...PROTECTED_ROLES].some((r) =>
        upperSql.includes(r)
      );
      if (!upperSql.includes("CURRENT_ROLE()") && !mentionsAdmin) {
        results.push({
          blocked: false,
          requiresConfirmation: true,
          message: `Warning: this row access policy does not reference CURRENT_ROLE() and may hide all rows from admin roles.`,
          changeId: change.id,
        });
      }
    }
  }

  return results;
}

function extractTargetRole(sql: string): string | null {
  // Match "TO ROLE <name>" or "FROM ROLE <name>"
  const match = sql.match(/(?:TO|FROM)\s+ROLE\s+(\S+)/i);
  if (match) return match[1].replace(/"/g, "");
  return null;
}
