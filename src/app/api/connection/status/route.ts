import { readConfig, sanitizeConfig } from "@/lib/config";
import { query } from "@/lib/snowflake";
import { NextResponse } from "next/server";

export async function GET() {
  const config = await readConfig();
  const hasEnvConfig = !!(
    process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER
  );

  if (!config && !hasEnvConfig) {
    return NextResponse.json({
      configured: false,
      connected: false,
    });
  }

  // Try connecting (uses config file first, then env vars)
  try {
    const rows = await query("SELECT CURRENT_USER() AS u, CURRENT_ROLE() AS r");
    const row = rows[0] as Record<string, unknown> | undefined;
    return NextResponse.json({
      configured: true,
      connected: true,
      config: config ? sanitizeConfig(config) : undefined,
      currentUser: row?.["U"] ?? row?.["u"] ?? "",
      currentRole: row?.["R"] ?? row?.["r"] ?? "",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      configured: !!(config || hasEnvConfig),
      connected: false,
      config: config ? sanitizeConfig(config) : undefined,
      error: msg,
    });
  }
}
