import { query } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";

export async function GET() {
  return withSnowflake(async () => {
    const rows = await query("SHOW ROLES");
    return rows.map((r: Record<string, unknown>) => ({
      name: r["name"],
      owner: r["owner"],
      comment: r["comment"] ?? "",
      is_default: r["is_default"] === "Y",
      is_current: r["is_current"] === "Y",
      is_inherited: r["is_inherited"] === "Y",
      granted_to_roles: Number(r["granted_to_roles"] ?? 0),
      granted_roles: Number(r["granted_roles"] ?? 0),
    }));
  });
}
