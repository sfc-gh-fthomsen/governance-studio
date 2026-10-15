import { query } from "@/lib/snowflake";
import { withSnowflake, jsonError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? "100"),
    500
  );
  const changeType = req.nextUrl.searchParams.get("type");

  return withSnowflake(async () => {
    let sql = `SELECT * FROM GOVERNANCE_DB.AUDIT.CHANGE_LOG ORDER BY TS DESC LIMIT ${limit}`;
    if (changeType) {
      sql = `SELECT * FROM GOVERNANCE_DB.AUDIT.CHANGE_LOG WHERE CHANGE_TYPE = '${changeType.replace(/'/g, "''")}' ORDER BY TS DESC LIMIT ${limit}`;
    }
    try {
      const rows = await query(sql);
      return rows;
    } catch {
      // Table may not exist yet
      return [];
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    user,
    role,
    session_id,
    change_type,
    object_fqn,
    sql: sqlText,
    before,
    after,
    status,
    error,
  } = body;

  if (!change_type || !sqlText) {
    return jsonError("change_type and sql required", 400);
  }

  return withSnowflake(async () => {
    await query(
      `INSERT INTO GOVERNANCE_DB.AUDIT.CHANGE_LOG
        (TS, "USER", ROLE, SESSION_ID, CHANGE_TYPE, OBJECT_FQN, SQL, BEFORE, AFTER, STATUS, ERROR)
       VALUES
        (CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?, PARSE_JSON(?), PARSE_JSON(?), ?, ?)`,
      [
        user ?? "",
        role ?? "",
        session_id ?? "",
        change_type,
        object_fqn ?? "",
        sqlText,
        before ? JSON.stringify(before) : "null",
        after ? JSON.stringify(after) : "null",
        status ?? "success",
        error ?? null,
      ]
    );
    return { ok: true };
  });
}
