import { query, quoteIdentifier } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const database = req.nextUrl.searchParams.get("database");
  const schema = req.nextUrl.searchParams.get("schema");

  if (!database) {
    return withSnowflake(async () => []);
  }

  return withSnowflake(async () => {
    const roleSet = new Set<string>();

    // Get roles with grants on the database
    try {
      const dbGrants = await query(
        `SHOW GRANTS ON DATABASE ${quoteIdentifier(database)}`
      );
      for (const g of dbGrants as Record<string, unknown>[]) {
        if (g["grantee_name"]) roleSet.add(String(g["grantee_name"]));
      }
    } catch { /* database may not be accessible */ }

    // Get roles with grants on schemas in this database
    if (schema) {
      try {
        const schemaGrants = await query(
          `SHOW GRANTS ON SCHEMA ${quoteIdentifier(database)}.${quoteIdentifier(schema)}`
        );
        for (const g of schemaGrants as Record<string, unknown>[]) {
          if (g["grantee_name"]) roleSet.add(String(g["grantee_name"]));
        }
      } catch { /* schema may not be accessible */ }

      // Get roles with grants on tables in this schema
      try {
        const futureGrants = await query(
          `SHOW FUTURE GRANTS IN SCHEMA ${quoteIdentifier(database)}.${quoteIdentifier(schema)}`
        );
        for (const g of futureGrants as Record<string, unknown>[]) {
          if (g["grantee_name"]) roleSet.add(String(g["grantee_name"]));
        }
      } catch { /* may not have access */ }
    }

    // Always include system roles for reference
    roleSet.add("ACCOUNTADMIN");
    roleSet.add("SYSADMIN");
    roleSet.add("SECURITYADMIN");

    return [...roleSet].sort();
  });
}
