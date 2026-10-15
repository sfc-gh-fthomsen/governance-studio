import { query, quoteIdentifier } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  const { user } = await params;
  return withSnowflake(async () => {
    const safeUser = quoteIdentifier(user);
    const rows = await query(`SHOW GRANTS TO USER ${safeUser}`);
    return rows.map((r: Record<string, unknown>) => ({
      role: r["role"],
      granted_to: r["granted_to"],
      grantee_name: r["grantee_name"],
      granted_by: r["granted_by"] ?? "",
    }));
  });
}
