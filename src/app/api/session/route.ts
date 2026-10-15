import { query } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";

export async function GET() {
  return withSnowflake(async () => {
    const [userRows, roleRows, whRows] = await Promise.all([
      query("SELECT CURRENT_USER() AS val"),
      query("SELECT CURRENT_ROLE() AS val"),
      query("SELECT CURRENT_WAREHOUSE() AS val"),
    ]);

    const val = (rows: Record<string, unknown>[]) =>
      String(rows[0]?.["VAL"] ?? rows[0]?.["val"] ?? "");

    return {
      currentUser: val(userRows),
      currentRole: val(roleRows),
      currentWarehouse: val(whRows),
      account: process.env.SNOWFLAKE_ACCOUNT ?? "",
    };
  });
}
