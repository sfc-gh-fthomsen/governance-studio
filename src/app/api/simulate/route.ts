import { query, quoteIdentifier } from "@/lib/snowflake";
import { withSnowflake, jsonError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role");
  if (!role) return jsonError("role param required", 400);

  return withSnowflake(async () => {
    const safeRole = quoteIdentifier(role);

    // Get all privileges granted to this role (direct)
    const directGrants = await query(
      `SHOW GRANTS TO ROLE ${safeRole}`
    );

    // Get roles granted to this role (for transitive closure)
    const childRoles = await query(
      `SHOW GRANTS OF ROLE ${safeRole}`
    );

    // Resolve transitive roles
    const visitedRoles = new Set<string>();
    const rolesToVisit = [role];
    const allGrants: Record<string, unknown>[] = [...(directGrants as Record<string, unknown>[])];

    const childRoleNames = (childRoles as Record<string, unknown>[])
      .filter((r) => r["granted_to"] === "ROLE")
      .map((r) => String(r["grantee_name"]));

    for (const child of childRoleNames) {
      if (!visitedRoles.has(child)) {
        rolesToVisit.push(child);
      }
    }

    while (rolesToVisit.length > 0) {
      const r = rolesToVisit.pop()!;
      if (visitedRoles.has(r)) continue;
      visitedRoles.add(r);

      try {
        const grants = await query(
          `SHOW GRANTS TO ROLE ${quoteIdentifier(r)}`
        );
        allGrants.push(...(grants as Record<string, unknown>[]));

        const nested = await query(
          `SHOW GRANTS OF ROLE ${quoteIdentifier(r)}`
        );
        for (const n of nested as Record<string, unknown>[]) {
          if (n["granted_to"] === "ROLE") {
            const name = String(n["grantee_name"]);
            if (!visitedRoles.has(name)) rolesToVisit.push(name);
          }
        }
      } catch {
        // Role may not be accessible
      }
    }

    // Categorize grants
    const privileges = allGrants.map((g) => ({
      privilege: g["privilege"],
      granted_on: g["granted_on"],
      name: g["name"],
      granted_to: g["grantee_name"],
      grant_option: g["grant_option"] === "true",
    }));

    // Find policies on objects this role can access.
    // Strategy: collect table FQNs from direct TABLE grants, and also discover
    // tables in schemas the role has USAGE on, then query POLICY_REFERENCES.

    const tableNames = new Set<string>();

    // 1. Direct table grants
    for (const g of allGrants) {
      if (
        String(g["granted_on"]).toUpperCase() === "TABLE" &&
        ["SELECT", "INSERT", "UPDATE", "DELETE", "OWNERSHIP"].includes(
          String(g["privilege"]).toUpperCase()
        )
      ) {
        tableNames.add(String(g["name"]));
      }
    }

    // 2. Find schemas via USAGE grants, then discover tables in them
    const schemaFqns = new Set<string>();
    const dbNames = new Set<string>();
    for (const g of allGrants) {
      const on = String(g["granted_on"]).toUpperCase();
      const priv = String(g["privilege"]).toUpperCase();
      if (on === "DATABASE" && priv === "USAGE") {
        dbNames.add(String(g["name"]));
      }
      if (on === "SCHEMA" && priv === "USAGE") {
        schemaFqns.add(String(g["name"]));
      }
    }

    // For databases with USAGE, get their schemas
    for (const dbName of [...dbNames].slice(0, 5)) {
      try {
        const schemas = await query(
          `SHOW SCHEMAS IN DATABASE ${quoteIdentifier(dbName)}`
        );
        for (const s of schemas as Record<string, unknown>[]) {
          schemaFqns.add(`${dbName}.${s["name"]}`);
        }
      } catch { /* DB may not be accessible */ }
    }

    // For each schema, discover tables (limit per schema to avoid timeout)
    for (const sFqn of [...schemaFqns].slice(0, 15)) {
      const parts = sFqn.split(".");
      if (parts.length < 2) continue;
      try {
        const tables = await query(
          `SHOW TABLES IN ${quoteIdentifier(parts[0])}.${quoteIdentifier(parts[1])}`
        );
        for (const t of (tables as Record<string, unknown>[]).slice(0, 50)) {
          tableNames.add(`${parts[0]}.${parts[1]}.${t["name"]}`);
        }
      } catch { /* Schema may not be accessible */ }
    }

    // Query POLICY_REFERENCES for each table (real-time)
    const policyRefs: Record<string, unknown>[] = [];
    for (const tableFqn of [...tableNames].slice(0, 50)) {
      try {
        const refs = await query(
          `SELECT * FROM TABLE(INFORMATION_SCHEMA.POLICY_REFERENCES(REF_ENTITY_NAME => '${tableFqn.replace(/'/g, "''")}', REF_ENTITY_DOMAIN => 'TABLE'))`
        );
        policyRefs.push(...(refs as Record<string, unknown>[]));
      } catch {
        // No policies on this table
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const policies = policyRefs
      .map((pr) => ({
        policy_name: String(pr["POLICY_NAME"] ?? ""),
        policy_kind: String(pr["POLICY_KIND"] ?? ""),
        policy_db: String(pr["POLICY_DB"] ?? ""),
        policy_schema: String(pr["POLICY_SCHEMA"] ?? ""),
        ref_entity_name: String(pr["REF_ENTITY_NAME"] ?? ""),
        ref_column_name: (pr["REF_COLUMN_NAME"] ?? null) as string | null,
        ref_database_name: String(pr["REF_DATABASE_NAME"] ?? ""),
        ref_schema_name: String(pr["REF_SCHEMA_NAME"] ?? ""),
      }))
      .filter((p) => {
        const key = `${p.policy_name}|${p.ref_entity_name}|${p.ref_column_name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return {
      role,
      inheritedRoles: [...visitedRoles],
      privileges,
      totalPrivileges: privileges.length,
      policies,
    };
  });
}
