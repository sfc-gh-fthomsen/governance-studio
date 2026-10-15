import { NextResponse } from "next/server";

export function jsonOk<T>(data: T) {
  return NextResponse.json(data);
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function withSnowflake<T>(
  fn: () => Promise<T>
): Promise<NextResponse> {
  try {
    const data = await fn();
    return jsonOk(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[API]", msg);
    return jsonError(msg);
  }
}
