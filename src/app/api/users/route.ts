import { query } from "@/lib/snowflake";
import { withSnowflake } from "@/lib/api-helpers";

export async function GET() {
  return withSnowflake(async () => {
    const rows = await query("SHOW USERS");
    return rows.map((r: Record<string, unknown>) => ({
      name: r["name"],
      login_name: r["login_name"],
      display_name: r["display_name"],
      email: r["email"],
      default_role: r["default_role"],
      disabled: r["disabled"] === "true",
      has_password: r["has_password"] === "true",
      last_success_login: r["last_success_login"] ?? null,
    }));
  });
}
