import { configToConnectionOptions, testConnection } from "@/lib/snowflake";
import type { AppConfig } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const config: AppConfig = {
    account: body.account || "",
    username: body.username || "",
    authMethod: body.authMethod || "password",
    privateKeyPath: body.privateKeyPath || undefined,
    privateKeyPass: body.privateKeyPass || undefined,
    password: body.password || undefined,
    role: body.role || "ACCOUNTADMIN",
    warehouse: body.warehouse || "COMPUTE_WH",
    database: body.database || "GOVERNANCE_DB",
  };

  const opts = configToConnectionOptions(config);
  const result = await testConnection(opts);

  return NextResponse.json(result);
}
