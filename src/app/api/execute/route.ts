import { query, isDDL } from "@/lib/snowflake";
import { withSnowflake, jsonError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const statements: string[] = body.statements;
  const dryRun: boolean = body.dryRun ?? false;

  if (!Array.isArray(statements) || statements.length === 0) {
    return jsonError("statements array required", 400);
  }

  if (dryRun) {
    return withSnowflake(async () => {
      return { mode: "dry-run", statements, message: "DDL preview only" };
    });
  }

  return withSnowflake(async () => {
    const results: { sql: string; status: string; error?: string }[] = [];

    for (const sql of statements) {
      if (!isDDL(sql)) {
        results.push({
          sql,
          status: "skipped",
          error: "Not a DDL statement",
        });
        continue;
      }
      try {
        await query(sql);
        results.push({ sql, status: "success" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ sql, status: "error", error: msg });
        break; // stop on first error
      }
    }

    return { mode: "live", results };
  });
}
