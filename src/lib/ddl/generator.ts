import { fqn, quoteIdentifier } from "@/lib/sql-utils";
import type { AccessRule, ChangeItem, PolicyCell } from "@/types/governance";

const GOVERNANCE_DB = "GOVERNANCE_DB";
const GOVERNANCE_SCHEMA = "PUBLIC";

let changeCounter = 0;
function nextId() {
  return `chg_${Date.now()}_${++changeCounter}`;
}

// Masking policy templates keyed by AccessRule
const MASK_TEMPLATES: Record<string, (col: string, dt: string) => string> = {
  MASK_EMAIL: (_col, _dt) =>
    `CASE WHEN IS_ROLE_IN_SESSION('GOVERNANCE_ADMIN') THEN val
     ELSE REGEXP_REPLACE(val, '.+@', '***@') END`,
  MASK_PARTIAL: (_col, _dt) =>
    `CASE WHEN IS_ROLE_IN_SESSION('GOVERNANCE_ADMIN') THEN val
     ELSE CONCAT(LEFT(val, 1), '****', RIGHT(val, 1)) END`,
  MASK_HASH: (_col, _dt) =>
    `CASE WHEN IS_ROLE_IN_SESSION('GOVERNANCE_ADMIN') THEN val
     ELSE SHA2(val) END`,
  MASK_NULL: (_col, dt) =>
    `CASE WHEN IS_ROLE_IN_SESSION('GOVERNANCE_ADMIN') THEN val
     ELSE NULL::${dt} END`,
};

export function isMaskRule(rule: AccessRule): boolean {
  return rule.startsWith("MASK_");
}

export function isConditionRule(rule: AccessRule): boolean {
  return (
    rule !== "FULL_ACCESS" &&
    rule !== "NO_ACCESS" &&
    !isMaskRule(rule)
  );
}

/**
 * Parse an entity key like "DB.SCHEMA.TABLE.COLUMN" into parts.
 */
export function parseEntityKey(key: string) {
  const parts = key.split(".");
  return {
    database: parts[0] ?? "",
    schema: parts[1] ?? "",
    table: parts[2] ?? "",
    column: parts[3] ?? "",
    isColumn: parts.length >= 4,
    isTable: parts.length === 3,
  };
}

/**
 * Generate the mapping table DDL and inserts for RLS conditions.
 */
export function generateMappingTableDDL(
  cells: PolicyCell[]
): ChangeItem[] {
  const conditionCells = cells.filter((c) => isConditionRule(c.rule));
  if (conditionCells.length === 0) return [];

  const changes: ChangeItem[] = [];
  const tableFqn = fqn(GOVERNANCE_DB, GOVERNANCE_SCHEMA, "RLS_MAPPING");

  changes.push({
    id: nextId(),
    type: "CREATE_POLICY",
    description: `Create RLS mapping table ${tableFqn}`,
    sql: `CREATE TABLE IF NOT EXISTS ${tableFqn} (
  entity_key VARCHAR NOT NULL,
  role_or_user VARCHAR NOT NULL,
  condition_column VARCHAR NOT NULL,
  condition_operator VARCHAR NOT NULL DEFAULT '=',
  condition_value VARCHAR NOT NULL,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
)`,
    status: "pending",
  });

  for (const cell of conditionCells) {
    const parsed = parseCondition(cell.rule);
    if (!parsed) continue;

    changes.push({
      id: nextId(),
      type: "MAPPING_INSERT",
      description: `Map ${cell.roleOrUser} -> ${cell.rule} on ${cell.entityKey}`,
      sql: `INSERT INTO ${tableFqn} (entity_key, role_or_user, condition_column, condition_operator, condition_value)
  VALUES ('${escapeSql(cell.entityKey)}', '${escapeSql(cell.roleOrUser)}', '${escapeSql(parsed.column)}', '${escapeSql(parsed.operator)}', '${escapeSql(parsed.value)}')`,
      status: "pending",
    });
  }

  return changes;
}

/**
 * Generate a Row Access Policy from condition cells targeting a specific table.
 */
export function generateRowAccessPolicyDDL(
  tableKey: string,
  conditionColumn: string,
  policyName: string
): ChangeItem[] {
  const changes: ChangeItem[] = [];
  const entity = parseEntityKey(tableKey);
  const mappingTable = fqn(GOVERNANCE_DB, GOVERNANCE_SCHEMA, "RLS_MAPPING");
  const policyFqn = fqn(GOVERNANCE_DB, GOVERNANCE_SCHEMA, policyName);
  const tableFqn = fqn(entity.database, entity.schema, entity.table);
  const safeCol = quoteIdentifier(conditionColumn);

  changes.push({
    id: nextId(),
    type: "CREATE_POLICY",
    description: `Create row access policy ${policyFqn}`,
    sql: `CREATE OR REPLACE ROW ACCESS POLICY ${policyFqn}
AS (${safeCol} VARCHAR) RETURNS BOOLEAN ->
  EXISTS (
    SELECT 1 FROM ${mappingTable}
    WHERE role_or_user = CURRENT_ROLE()
      AND entity_key = '${escapeSql(tableKey)}'
      AND condition_value = ${safeCol}
  )`,
    status: "pending",
  });

  changes.push({
    id: nextId(),
    type: "ALTER_TABLE",
    description: `Attach ${policyName} to ${tableFqn} on ${conditionColumn}`,
    sql: `ALTER TABLE ${tableFqn} ADD ROW ACCESS POLICY ${policyFqn} ON (${safeCol})`,
    status: "pending",
  });

  return changes;
}

/**
 * Generate masking policy DDL for a column.
 */
export function generateMaskingPolicyDDL(
  entityKey: string,
  rule: AccessRule,
  dataType: string = "VARCHAR"
): ChangeItem[] {
  const template = MASK_TEMPLATES[rule];
  if (!template) return [];

  const changes: ChangeItem[] = [];
  const entity = parseEntityKey(entityKey);
  const policyName = `mask_${entity.table}_${entity.column}_${rule.toLowerCase()}`;
  const policyFqn = fqn(GOVERNANCE_DB, GOVERNANCE_SCHEMA, policyName);
  const tableFqn = fqn(entity.database, entity.schema, entity.table);
  const safeCol = quoteIdentifier(entity.column);

  const body = template(entity.column, dataType);

  changes.push({
    id: nextId(),
    type: "CREATE_POLICY",
    description: `Create masking policy ${policyName}`,
    sql: `CREATE OR REPLACE MASKING POLICY ${policyFqn}
AS (val ${dataType}) RETURNS ${dataType} ->
  ${body}`,
    status: "pending",
  });

  changes.push({
    id: nextId(),
    type: "ALTER_TABLE",
    description: `Attach ${policyName} to ${tableFqn}.${entity.column}`,
    sql: `ALTER TABLE ${tableFqn} ALTER COLUMN ${safeCol} SET MASKING POLICY ${policyFqn}`,
    status: "pending",
  });

  return changes;
}

/**
 * Generate GRANT/REVOKE for FULL_ACCESS or NO_ACCESS on a table.
 */
export function generateAccessGrantDDL(
  entityKey: string,
  roleOrUser: string,
  rule: "FULL_ACCESS" | "NO_ACCESS"
): ChangeItem[] {
  const entity = parseEntityKey(entityKey);
  const tableFqn = fqn(entity.database, entity.schema, entity.table);
  const safeRole = quoteIdentifier(roleOrUser);

  if (rule === "FULL_ACCESS") {
    return [
      {
        id: nextId(),
        type: "GRANT",
        description: `Grant SELECT on ${tableFqn} to ${roleOrUser}`,
        sql: `GRANT SELECT ON TABLE ${tableFqn} TO ROLE ${safeRole}`,
        status: "pending",
      },
    ];
  }

  return [
    {
      id: nextId(),
      type: "REVOKE",
      description: `Revoke SELECT on ${tableFqn} from ${roleOrUser}`,
      sql: `REVOKE SELECT ON TABLE ${tableFqn} FROM ROLE ${safeRole}`,
      status: "pending",
    },
  ];
}

// --- Helpers ---

function parseCondition(
  rule: string
): { column: string; operator: string; value: string } | null {
  const match = rule.match(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(=|!=|<>|>=|<=|>|<|IN|LIKE)\s*(.+)$/i
  );
  if (!match) return null;
  return {
    column: match[1],
    operator: match[2].toUpperCase(),
    value: match[3].replace(/^['"]|['"]$/g, "").trim(),
  };
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Generate a complete value-based RLS setup:
 * 1. INSERT mapping rows into RLS_VALUE_MAPPING
 * 2. CREATE the row access policy
 * 3. ALTER TABLE to attach the policy
 */
export function generateValueBasedRlsDDL(
  tableFqn: string,
  filterColumn: string,
  mappings: { role: string; value: string }[],
  policyName?: string
): ChangeItem[] {
  const changes: ChangeItem[] = [];
  const parts = tableFqn.split(".");
  const safeTable = fqn(parts[0], parts[1], parts[2]);
  const safeCol = quoteIdentifier(filterColumn);
  const mappingTableFqn = fqn(GOVERNANCE_DB, GOVERNANCE_SCHEMA, "RLS_VALUE_MAPPING");
  const name = policyName ?? `rls_${parts[2]}_${filterColumn}`.toLowerCase();
  const policyFqnStr = fqn(GOVERNANCE_DB, GOVERNANCE_SCHEMA, name);

  // Insert mapping rows
  for (const m of mappings) {
    changes.push({
      id: nextId(),
      type: "MAPPING_INSERT",
      description: `Allow ${m.role} to see ${filterColumn} = '${m.value}' on ${parts[2]}`,
      sql: `INSERT INTO ${mappingTableFqn} (table_fqn, filter_column, role_name, allowed_value)
  SELECT '${escapeSql(tableFqn)}', '${escapeSql(filterColumn)}', '${escapeSql(m.role)}', '${escapeSql(m.value)}'
  WHERE NOT EXISTS (
    SELECT 1 FROM ${mappingTableFqn}
    WHERE table_fqn = '${escapeSql(tableFqn)}' AND filter_column = '${escapeSql(filterColumn)}'
      AND role_name = '${escapeSql(m.role)}' AND allowed_value = '${escapeSql(m.value)}'
  )`,
      status: "pending",
    });
  }

  // Create the row access policy
  changes.push({
    id: nextId(),
    type: "CREATE_POLICY",
    description: `Create row access policy ${name} on ${parts[2]}.${filterColumn}`,
    sql: `CREATE OR REPLACE ROW ACCESS POLICY ${policyFqnStr}
AS (${safeCol} VARCHAR) RETURNS BOOLEAN ->
  CURRENT_ROLE() IN ('ACCOUNTADMIN', 'SECURITYADMIN', 'GOVERNANCE_ADMIN')
  OR EXISTS (
    SELECT 1 FROM ${mappingTableFqn}
    WHERE table_fqn = '${escapeSql(tableFqn)}'
      AND filter_column = '${escapeSql(filterColumn)}'
      AND role_name = CURRENT_ROLE()
      AND allowed_value = ${safeCol}
  )`,
    status: "pending",
  });

  // Attach the policy to the table
  changes.push({
    id: nextId(),
    type: "ALTER_TABLE",
    description: `Attach ${name} to ${safeTable} on column ${filterColumn}`,
    sql: `ALTER TABLE ${safeTable} ADD ROW ACCESS POLICY ${policyFqnStr} ON (${safeCol})`,
    status: "pending",
  });

  return changes;
}
