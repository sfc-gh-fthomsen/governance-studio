export interface SnowflakeUser {
  name: string;
  login_name: string;
  display_name: string;
  email: string;
  default_role: string;
  disabled: boolean;
  has_password: boolean;
  last_success_login: string | null;
}

export interface SnowflakeRole {
  name: string;
  owner: string;
  comment: string;
  is_default: boolean;
  is_current: boolean;
  is_inherited: boolean;
  granted_to_roles: number;
  granted_roles: number;
}

export interface RoleGrant {
  role: string;
  granted_to: "ROLE" | "USER";
  grantee_name: string;
  granted_by: string;
}

export interface CatalogDatabase {
  name: string;
  owner: string;
}

export interface CatalogSchema {
  database_name: string;
  name: string;
  owner: string;
}

export interface CatalogTable {
  database_name: string;
  schema_name: string;
  name: string;
  kind: "TABLE" | "VIEW";
  owner: string;
  row_count: number;
}

export interface CatalogColumn {
  database_name: string;
  schema_name: string;
  table_name: string;
  name: string;
  data_type: string;
  is_nullable: boolean;
}

export interface MaskingPolicy {
  name: string;
  database_name: string;
  schema_name: string;
  kind: string;
  owner: string;
}

export interface RowAccessPolicy {
  name: string;
  database_name: string;
  schema_name: string;
  owner: string;
}

export interface SnowflakeTag {
  name: string;
  database_name: string;
  schema_name: string;
  owner: string;
  allowed_values: string[];
}

export interface PolicyReference {
  policy_db: string;
  policy_schema: string;
  policy_name: string;
  policy_kind: "MASKING_POLICY" | "ROW_ACCESS_POLICY";
  ref_database_name: string;
  ref_schema_name: string;
  ref_entity_name: string;
  ref_entity_domain: string;
  ref_column_name: string | null;
}

export interface TagReference {
  tag_database: string;
  tag_schema: string;
  tag_name: string;
  tag_value: string;
  object_database: string;
  object_schema: string;
  object_name: string;
  column_name: string | null;
  domain: string;
}

export type AccessRule =
  | "FULL_ACCESS"
  | "NO_ACCESS"
  | "MASK_EMAIL"
  | "MASK_PARTIAL"
  | "MASK_HASH"
  | "MASK_NULL"
  | string; // condition expressions like COUNTRY = 'US'

export interface PolicyCell {
  entityKey: string; // db.schema.table.column or tag:TAG_NAME
  roleOrUser: string;
  rule: AccessRule;
}

export type ExecutionMode = "live" | "dry-run";

export interface ChangeItem {
  id: string;
  type:
    | "GRANT"
    | "REVOKE"
    | "CREATE_POLICY"
    | "ALTER_POLICY"
    | "DROP_POLICY"
    | "ALTER_TAG"
    | "ALTER_TABLE"
    | "MAPPING_INSERT"
    | "MAPPING_DELETE";
  description: string;
  sql: string;
  before?: string;
  after?: string;
  status: "pending" | "executing" | "success" | "error";
  error?: string;
}

export interface SessionContext {
  currentUser: string;
  currentRole: string;
  currentWarehouse: string;
  account: string;
}

export interface AuditEntry {
  ts: string;
  user: string;
  role: string;
  session_id: string;
  change_type: string;
  object_fqn: string;
  sql: string;
  before: unknown;
  after: unknown;
  status: "success" | "error";
  error?: string;
}
