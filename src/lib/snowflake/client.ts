import snowflake from "snowflake-sdk";
import { readConfig, type AppConfig } from "@/lib/config";

let connectionPool: snowflake.Connection | null = null;
let currentConfigHash: string = "";

function configHash(opts: snowflake.ConnectionOptions): string {
  return `${opts.account}|${opts.username}|${opts.role}|${opts.warehouse}`;
}

async function getConnectionOptions(): Promise<snowflake.ConnectionOptions> {
  // 1. Inside SPCS — use token file
  if (process.env.SNOWFLAKE_HOST) {
    return {
      accessUrl: `https://${process.env.SNOWFLAKE_HOST}`,
      account: process.env.SNOWFLAKE_ACCOUNT || "",
      authenticator: "OAUTH",
      token: "",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
      role: process.env.SNOWFLAKE_ROLE || "GOVERNANCE_ADMIN",
    };
  }

  // 2. Config file from setup wizard (primary)
  const config = await readConfig();
  if (config) {
    return configToConnectionOptions(config);
  }

  // 3. Env vars (fallback for advanced users)
  const authenticator = process.env.SNOWFLAKE_AUTHENTICATOR || "SNOWFLAKE";
  const opts: snowflake.ConnectionOptions = {
    account: process.env.SNOWFLAKE_ACCOUNT || "",
    username: process.env.SNOWFLAKE_USER || "",
    authenticator,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
    role: process.env.SNOWFLAKE_ROLE || "ACCOUNTADMIN",
    database: process.env.SNOWFLAKE_DATABASE || "",
  };

  if (authenticator === "SNOWFLAKE_JWT" || process.env.SNOWFLAKE_PRIVATE_KEY_PATH) {
    opts.authenticator = "SNOWFLAKE_JWT";
    opts.privateKeyPath = process.env.SNOWFLAKE_PRIVATE_KEY_PATH || "";
    if (process.env.SNOWFLAKE_PRIVATE_KEY_PASS) {
      opts.privateKeyPass = process.env.SNOWFLAKE_PRIVATE_KEY_PASS;
    }
  } else if (process.env.SNOWFLAKE_PASSWORD) {
    opts.password = process.env.SNOWFLAKE_PASSWORD;
  }

  return opts;
}

export function configToConnectionOptions(
  config: AppConfig
): snowflake.ConnectionOptions {
  const opts: snowflake.ConnectionOptions = {
    account: config.account,
    username: config.username,
    warehouse: config.warehouse,
    role: config.role,
    database: config.database,
  };

  if (config.authMethod === "key-pair" && config.privateKeyPath) {
    opts.authenticator = "SNOWFLAKE_JWT";
    opts.privateKeyPath = config.privateKeyPath;
    if (config.privateKeyPass) {
      opts.privateKeyPass = config.privateKeyPass;
    }
  } else if (config.authMethod === "password" && config.password) {
    opts.authenticator = "SNOWFLAKE";
    opts.password = config.password;
  }

  return opts;
}

async function readSpcsToken(): Promise<string> {
  const fs = await import("fs/promises");
  try {
    return (await fs.readFile("/snowflake/session/token", "utf-8")).trim();
  } catch {
    return "";
  }
}

export function resetConnection(): void {
  if (connectionPool) {
    try { connectionPool.destroy(() => {}); } catch { /* ignore */ }
    connectionPool = null;
  }
  currentConfigHash = "";
}

export async function getConnection(): Promise<snowflake.Connection> {
  const opts = await getConnectionOptions();
  const hash = configHash(opts);

  // If config changed, drop the old connection
  if (connectionPool && currentConfigHash !== hash) {
    resetConnection();
  }

  if (connectionPool?.isUp()) return connectionPool;

  if (opts.authenticator === "OAUTH" && !opts.token) {
    opts.token = await readSpcsToken();
  }

  return new Promise((resolve, reject) => {
    const conn = snowflake.createConnection(opts);
    conn.connect((err, c) => {
      if (err) return reject(err);
      connectionPool = c;
      currentConfigHash = hash;
      resolve(c);
    });
  });
}

export async function testConnection(
  opts: snowflake.ConnectionOptions
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const conn = snowflake.createConnection(opts);
    conn.connect((err, c) => {
      if (err) {
        resolve({ ok: false, error: err.message });
        return;
      }
      // Run a simple query to verify
      c.execute({
        sqlText: "SELECT CURRENT_USER() AS u",
        complete: (qErr) => {
          c.destroy(() => {});
          if (qErr) {
            resolve({ ok: false, error: qErr.message });
          } else {
            resolve({ ok: true });
          }
        },
      });
    });
  });
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  binds?: snowflake.Binds
): Promise<T[]> {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) return reject(err);
        resolve((rows ?? []) as T[]);
      },
    });
  });
}

export { quoteIdentifier, fqn } from "@/lib/sql-utils";

const DDL_KEYWORDS = new Set([
  "CREATE", "ALTER", "DROP", "GRANT", "REVOKE",
  "INSERT", "UPDATE", "DELETE", "MERGE", "TRUNCATE", "COPY",
]);

export function isDDL(sql: string): boolean {
  const first = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
  return DDL_KEYWORDS.has(first);
}
