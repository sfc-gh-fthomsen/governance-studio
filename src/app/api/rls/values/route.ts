import { query, quoteIdentifier } from "@/lib/snowflake";
import { withSnowflake, jsonError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table");
  const column = req.nextUrl.searchParams.get("column");

  if (!table || !column) {
    return jsonError("table and column params required", 400);
  }

  const parts = table.split(".");
  if (parts.length !== 3) {
    return jsonError("table must be fully qualified: DB.SCHEMA.TABLE", 400);
  }

  const tableFqn = parts.map(quoteIdentifier).join(".");
  const safeCol = quoteIdentifier(column);

  return withSnowflake(async () => {
    const rows = await query(
      `SELECT DISTINCT ${safeCol} AS val FROM ${tableFqn} WHERE ${safeCol} IS NOT NULL ORDER BY val LIMIT 200`
    );
    return (rows as Record<string, unknown>[]).map((r) =>
      String(r["VAL"] ?? r["val"] ?? "")
    );
  });
}
