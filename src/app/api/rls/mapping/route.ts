import { query } from "@/lib/snowflake";
import { withSnowflake, jsonError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export interface RlsMapping {
  table_fqn: string;
  filter_column: string;
  role_name: string;
  allowed_value: string;
}

export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table");
  const column = req.nextUrl.searchParams.get("column");

  if (!table) {
    return jsonError("table param required", 400);
  }

  return withSnowflake(async () => {
    let sql = `SELECT table_fqn, filter_column, role_name, allowed_value
               FROM GOVERNANCE_DB.PUBLIC.RLS_VALUE_MAPPING
               WHERE table_fqn = '${table.replace(/'/g, "''")}'`;
    if (column) {
      sql += ` AND filter_column = '${column.replace(/'/g, "''")}'`;
    }
    sql += ` ORDER BY role_name, allowed_value`;

    try {
      const rows = await query(sql);
      return (rows as Record<string, unknown>[]).map((r) => ({
        table_fqn: String(r["TABLE_FQN"] ?? r["table_fqn"] ?? ""),
        filter_column: String(r["FILTER_COLUMN"] ?? r["filter_column"] ?? ""),
        role_name: String(r["ROLE_NAME"] ?? r["role_name"] ?? ""),
        allowed_value: String(r["ALLOWED_VALUE"] ?? r["allowed_value"] ?? ""),
      }));
    } catch {
      // Table may not exist yet
      return [];
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, table_fqn, filter_column, role_name, allowed_value } = body;

  if (!action || !table_fqn || !filter_column || !role_name || !allowed_value) {
    return jsonError(
      "action, table_fqn, filter_column, role_name, and allowed_value required",
      400
    );
  }

  return withSnowflake(async () => {
    const esc = (s: string) => s.replace(/'/g, "''");

    if (action === "add") {
      await query(
        `INSERT INTO GOVERNANCE_DB.PUBLIC.RLS_VALUE_MAPPING (table_fqn, filter_column, role_name, allowed_value)
         SELECT '${esc(table_fqn)}', '${esc(filter_column)}', '${esc(role_name)}', '${esc(allowed_value)}'
         WHERE NOT EXISTS (
           SELECT 1 FROM GOVERNANCE_DB.PUBLIC.RLS_VALUE_MAPPING
           WHERE table_fqn = '${esc(table_fqn)}' AND filter_column = '${esc(filter_column)}'
             AND role_name = '${esc(role_name)}' AND allowed_value = '${esc(allowed_value)}'
         )`
      );
    } else if (action === "remove") {
      await query(
        `DELETE FROM GOVERNANCE_DB.PUBLIC.RLS_VALUE_MAPPING
         WHERE table_fqn = '${esc(table_fqn)}' AND filter_column = '${esc(filter_column)}'
           AND role_name = '${esc(role_name)}' AND allowed_value = '${esc(allowed_value)}'`
      );
    } else {
      return { error: "action must be 'add' or 'remove'" };
    }

    return { ok: true };
  });
}
