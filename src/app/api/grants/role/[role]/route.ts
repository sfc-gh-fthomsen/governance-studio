import { query, quoteIdentifier } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  const { role } = await params;
  return withSnowflake(async () => {
    const safeRole = quoteIdentifier(role);
    const rows = await query(`SHOW GRANTS OF ROLE ${safeRole}`);
    return rows.map((r: Record<string, unknown>) => ({
      role: r["role"],
      granted_to: r["granted_to"],
      grantee_name: r["grantee_name"],
      granted_by: r["granted_by"] ?? "",
    }));
  });
}
