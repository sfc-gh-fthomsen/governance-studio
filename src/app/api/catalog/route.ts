import { query, quoteIdentifier } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get("level") ?? "databases";
  const db = req.nextUrl.searchParams.get("database");
  const schema = req.nextUrl.searchParams.get("schema");
  const table = req.nextUrl.searchParams.get("table");

  return withSnowflake(async () => {
    switch (level) {
      case "databases": {
        const rows = await query("SHOW DATABASES");
        return rows.map((r: Record<string, unknown>) => ({
          name: r["name"],
          owner: r["owner"] ?? "",
        }));
      }
      case "schemas": {
        if (!db) throw new Error("database param required");
        const rows = await query(
          `SHOW SCHEMAS IN DATABASE ${quoteIdentifier(db)}`
        );
        return rows.map((r: Record<string, unknown>) => ({
          database_name: db,
          name: r["name"],
          owner: r["owner"] ?? "",
        }));
      }
      case "tables": {
        if (!db || !schema) throw new Error("database and schema params required");
        const rows = await query(
          `SHOW TABLES IN ${quoteIdentifier(db)}.${quoteIdentifier(schema)}`
        );
        const views = await query(
          `SHOW VIEWS IN ${quoteIdentifier(db)}.${quoteIdentifier(schema)}`
        );
        const tables = rows.map((r: Record<string, unknown>) => ({
          database_name: db,
          schema_name: schema,
          name: r["name"],
          kind: "TABLE" as const,
          owner: r["owner"] ?? "",
          row_count: Number(r["rows"] ?? 0),
        }));
        const viewsMapped = views.map((r: Record<string, unknown>) => ({
          database_name: db,
          schema_name: schema,
          name: r["name"],
          kind: "VIEW" as const,
          owner: r["owner"] ?? "",
          row_count: 0,
        }));
        return [...tables, ...viewsMapped];
      }
      case "columns": {
        if (!db || !schema || !table)
          throw new Error("database, schema, and table params required");
        const rows = await query(
          `SHOW COLUMNS IN ${quoteIdentifier(db)}.${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
        );
        return rows.map((r: Record<string, unknown>) => ({
          database_name: db,
          schema_name: schema,
          table_name: table,
          name: r["column_name"],
          data_type: parseSnowflakeDataType(String(r["data_type"] ?? "")),
          is_nullable: r["is_nullable"] === "Y",
        }));
      }
      default:
        throw new Error(`Unknown level: ${level}`);
    }
  });
}

function parseSnowflakeDataType(raw: string): string {
  // SHOW COLUMNS returns data_type as JSON like {"type":"TEXT","length":100,...}
  // or {"type":"FIXED","precision":38,"scale":0,...}
  // Convert to SQL syntax.
  try {
    const obj = JSON.parse(raw);
    const t = String(obj.type ?? "").toUpperCase();

    switch (t) {
      case "TEXT":
        return obj.length ? `VARCHAR(${obj.length})` : "VARCHAR";
      case "FIXED":
        if (obj.scale && obj.scale > 0)
          return `NUMBER(${obj.precision ?? 38},${obj.scale})`;
        return obj.precision && obj.precision !== 38
          ? `NUMBER(${obj.precision},0)`
          : "NUMBER";
      case "REAL":
        return "FLOAT";
      case "BOOLEAN":
        return "BOOLEAN";
      case "DATE":
        return "DATE";
      case "TIMESTAMP_NTZ":
        return obj.precision ? `TIMESTAMP_NTZ(${obj.precision})` : "TIMESTAMP_NTZ";
      case "TIMESTAMP_LTZ":
        return obj.precision ? `TIMESTAMP_LTZ(${obj.precision})` : "TIMESTAMP_LTZ";
      case "TIMESTAMP_TZ":
        return obj.precision ? `TIMESTAMP_TZ(${obj.precision})` : "TIMESTAMP_TZ";
      case "VARIANT":
        return "VARIANT";
      case "OBJECT":
        return "OBJECT";
      case "ARRAY":
        return "ARRAY";
      case "BINARY":
        return obj.length ? `BINARY(${obj.length})` : "BINARY";
      default:
        return t || "VARCHAR";
    }
  } catch {
    // Not JSON — return as-is (already a SQL type string)
    return raw || "VARCHAR";
  }
}
