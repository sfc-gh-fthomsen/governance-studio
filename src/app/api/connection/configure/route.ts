import { readConfig, writeConfig, deleteConfig, sanitizeConfig, type AppConfig } from "@/lib/config";
import { testConnection, configToConnectionOptions, resetConnection } from "@/lib/snowflake";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    account,
    username,
    authMethod,
    privateKeyPath,
    privateKeyPass,
    password,
    role,
    warehouse,
    database,
  } = body;

  if (!account || !username || !authMethod) {
    return NextResponse.json(
      { error: "account, username, and authMethod are required" },
      { status: 400 }
    );
  }

  const config: AppConfig = {
    account,
    username,
    authMethod,
    privateKeyPath: privateKeyPath || undefined,
    privateKeyPass: privateKeyPass || undefined,
    password: password || undefined,
    role: role || "ACCOUNTADMIN",
    warehouse: warehouse || "COMPUTE_WH",
    database: database || "GOVERNANCE_DB",
  };

  // Test connection before saving
  const opts = configToConnectionOptions(config);
  const result = await testConnection(opts);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, connected: false },
      { status: 422 }
    );
  }

  // Save and reset connection pool
  await writeConfig(config);
  resetConnection();

  return NextResponse.json({
    ok: true,
    connected: true,
    config: sanitizeConfig(config),
  });
}

export async function DELETE() {
  await deleteConfig();
  resetConnection();
  return NextResponse.json({ ok: true });
}
