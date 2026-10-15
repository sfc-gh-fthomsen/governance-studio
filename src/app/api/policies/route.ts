import { query } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "all";

  return withSnowflake(async () => {
    const result: Record<string, unknown[]> = {};

    if (kind === "all" || kind === "masking") {
      const rows = await query("SHOW MASKING POLICIES");
      result.maskingPolicies = rows.map((r: Record<string, unknown>) => ({
        name: r["name"],
        database_name: r["database_name"],
        schema_name: r["schema_name"],
        kind: r["kind"] ?? "MASKING",
        owner: r["owner"] ?? "",
      }));
    }

    if (kind === "all" || kind === "row_access") {
      const rows = await query("SHOW ROW ACCESS POLICIES");
      result.rowAccessPolicies = rows.map((r: Record<string, unknown>) => ({
        name: r["name"],
        database_name: r["database_name"],
        schema_name: r["schema_name"],
        owner: r["owner"] ?? "",
      }));
    }

    if (kind === "all" || kind === "tags") {
      const rows = await query("SHOW TAGS");
      result.tags = rows.map((r: Record<string, unknown>) => ({
        name: r["name"],
        database_name: r["database_name"],
        schema_name: r["schema_name"],
        owner: r["owner"] ?? "",
        allowed_values: r["allowed_values"]
          ? String(r["allowed_values"]).split(",").map((v: string) => v.trim())
          : [],
      }));
    }

    if (kind === "all" || kind === "references") {
      try {
        const policyRefs = await query(
          `SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES ORDER BY CREATED DESC LIMIT 1000`
        );
        result.policyReferences = policyRefs.map(
          (r: Record<string, unknown>) => ({
            policy_db: r["POLICY_DB"],
            policy_schema: r["POLICY_SCHEMA"],
            policy_name: r["POLICY_NAME"],
            policy_kind: r["POLICY_KIND"],
            ref_database_name: r["REF_DATABASE_NAME"],
            ref_schema_name: r["REF_SCHEMA_NAME"],
            ref_entity_name: r["REF_ENTITY_NAME"],
            ref_entity_domain: r["REF_ENTITY_DOMAIN"],
            ref_column_name: r["REF_COLUMN_NAME"] ?? null,
          })
        );
      } catch {
        result.policyReferences = [];
      }

      try {
        const tagRefs = await query(
          `SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES ORDER BY TAG_NAME LIMIT 1000`
        );
        result.tagReferences = tagRefs.map((r: Record<string, unknown>) => ({
          tag_database: r["TAG_DATABASE"],
          tag_schema: r["TAG_SCHEMA"],
          tag_name: r["TAG_NAME"],
          tag_value: r["TAG_VALUE"],
          object_database: r["OBJECT_DATABASE"],
          object_schema: r["OBJECT_SCHEMA"],
          object_name: r["OBJECT_NAME"],
          column_name: r["COLUMN_NAME"] ?? null,
          domain: r["DOMAIN"],
        }));
      } catch {
        result.tagReferences = [];
      }
    }

    return result;
  });
}
