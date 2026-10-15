import { useQuery } from "@tanstack/react-query";
import type {
  SnowflakeUser,
  SnowflakeRole,
  RoleGrant,
  CatalogDatabase,
  CatalogSchema,
  CatalogTable,
  CatalogColumn,
  SessionContext,
} from "@/types/governance";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- RLS value-based hooks ---

export interface RlsMappingRow {
  table_fqn: string;
  filter_column: string;
  role_name: string;
  allowed_value: string;
}

export function useDistinctValues(table: string | null, column: string | null) {
  return useQuery<string[]>({
    queryKey: ["rls", "values", table, column],
    queryFn: () =>
      fetchJson(
        `/api/rls/values?table=${encodeURIComponent(table!)}&column=${encodeURIComponent(column!)}`
      ),
    enabled: !!table && !!column,
  });
}

export function useRlsMapping(table: string | null, column: string | null) {
  return useQuery<RlsMappingRow[]>({
    queryKey: ["rls", "mapping", table, column],
    queryFn: () => {
      const params = new URLSearchParams();
      if (table) params.set("table", table);
      if (column) params.set("column", column);
      return fetchJson(`/api/rls/mapping?${params}`);
    },
    enabled: !!table,
  });
}

export async function updateRlsMapping(
  action: "add" | "remove",
  table_fqn: string,
  filter_column: string,
  role_name: string,
  allowed_value: string
) {
  const res = await fetch("/api/rls/mapping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      table_fqn,
      filter_column,
      role_name,
      allowed_value,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `RLS mapping update failed: ${res.status}`);
  }
  return res.json();
}

export function useUsers() {
  return useQuery<SnowflakeUser[]>({
    queryKey: ["users"],
    queryFn: () => fetchJson("/api/users"),
  });
}

export function useRoles() {
  return useQuery<SnowflakeRole[]>({
    queryKey: ["roles"],
    queryFn: () => fetchJson("/api/roles"),
  });
}

export function useRoleGrants(role: string | null) {
  return useQuery<RoleGrant[]>({
    queryKey: ["grants", "role", role],
    queryFn: () => fetchJson(`/api/grants/role/${encodeURIComponent(role!)}`),
    enabled: !!role,
  });
}

export function useUserGrants(user: string | null) {
  return useQuery<RoleGrant[]>({
    queryKey: ["grants", "user", user],
    queryFn: () => fetchJson(`/api/grants/user/${encodeURIComponent(user!)}`),
    enabled: !!user,
  });
}

export function useDatabases() {
  return useQuery<CatalogDatabase[]>({
    queryKey: ["catalog", "databases"],
    queryFn: () => fetchJson("/api/catalog?level=databases"),
  });
}

export function useSchemas(database: string | null) {
  return useQuery<CatalogSchema[]>({
    queryKey: ["catalog", "schemas", database],
    queryFn: () =>
      fetchJson(
        `/api/catalog?level=schemas&database=${encodeURIComponent(database!)}`
      ),
    enabled: !!database,
  });
}

export function useTables(database: string | null, schema: string | null) {
  return useQuery<CatalogTable[]>({
    queryKey: ["catalog", "tables", database, schema],
    queryFn: () =>
      fetchJson(
        `/api/catalog?level=tables&database=${encodeURIComponent(database!)}&schema=${encodeURIComponent(schema!)}`
      ),
    enabled: !!database && !!schema,
  });
}

export function useColumns(
  database: string | null,
  schema: string | null,
  table: string | null
) {
  return useQuery<CatalogColumn[]>({
    queryKey: ["catalog", "columns", database, schema, table],
    queryFn: () =>
      fetchJson(
        `/api/catalog?level=columns&database=${encodeURIComponent(database!)}&schema=${encodeURIComponent(schema!)}&table=${encodeURIComponent(table!)}`
      ),
    enabled: !!database && !!schema && !!table,
  });
}

export interface PoliciesResponse {
  maskingPolicies: Array<{
    name: string;
    database_name: string;
    schema_name: string;
    kind: string;
    owner: string;
  }>;
  rowAccessPolicies: Array<{
    name: string;
    database_name: string;
    schema_name: string;
    owner: string;
  }>;
  tags: Array<{
    name: string;
    database_name: string;
    schema_name: string;
    owner: string;
    allowed_values: string[];
  }>;
  policyReferences: Array<Record<string, unknown>>;
  tagReferences: Array<Record<string, unknown>>;
}

export function usePolicies(kind: string = "all") {
  return useQuery<PoliciesResponse>({
    queryKey: ["policies", kind],
    queryFn: () => fetchJson(`/api/policies?kind=${kind}`),
  });
}

export function useSession() {
  return useQuery<SessionContext>({
    queryKey: ["session"],
    queryFn: () => fetchJson("/api/session"),
    staleTime: 60_000,
  });
}

export function useDatabaseRoles(
  database: string | null,
  schema: string | null
) {
  return useQuery<string[]>({
    queryKey: ["grants", "database", database, schema],
    queryFn: () => {
      const params = new URLSearchParams();
      if (database) params.set("database", database);
      if (schema) params.set("schema", schema);
      return fetchJson(`/api/grants/database?${params}`);
    },
    enabled: !!database,
  });
}

export async function executeStatements(
  statements: string[],
  dryRun: boolean
) {
  const res = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statements, dryRun }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Execute failed: ${res.status}`);
  }
  return res.json();
}
