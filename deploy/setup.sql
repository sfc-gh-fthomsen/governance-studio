-- =============================================================================
-- Governance Studio: Setup Script
-- Run this as ACCOUNTADMIN (or a role with CREATE ROLE, CREATE DATABASE,
-- MANAGE GRANTS, and APPLY MASKING/ROW ACCESS POLICY privileges).
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- 1. Governance admin role
CREATE ROLE IF NOT EXISTS GOVERNANCE_ADMIN
  COMMENT = 'Service role for the Governance & RBAC Studio app';

GRANT ROLE GOVERNANCE_ADMIN TO ROLE SYSADMIN;

-- 2. Governance database and schemas
CREATE DATABASE IF NOT EXISTS GOVERNANCE_DB
  COMMENT = 'Stores governance mapping tables, policies, and audit logs';

CREATE SCHEMA IF NOT EXISTS GOVERNANCE_DB.PUBLIC;
CREATE SCHEMA IF NOT EXISTS GOVERNANCE_DB.AUDIT;

-- 3. RLS mapping table (used by generated row access policies)
CREATE TABLE IF NOT EXISTS GOVERNANCE_DB.PUBLIC.RLS_MAPPING (
  entity_key       VARCHAR     NOT NULL,
  role_or_user     VARCHAR     NOT NULL,
  condition_column VARCHAR     NOT NULL,
  condition_operator VARCHAR   NOT NULL DEFAULT '=',
  condition_value  VARCHAR     NOT NULL,
  created_at       TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 4. RLS value mapping table (value-based row-level security)
CREATE TABLE IF NOT EXISTS GOVERNANCE_DB.PUBLIC.RLS_VALUE_MAPPING (
  table_fqn       VARCHAR     NOT NULL,
  filter_column   VARCHAR     NOT NULL,
  role_name       VARCHAR     NOT NULL,
  allowed_value   VARCHAR     NOT NULL,
  created_at      TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  UNIQUE (table_fqn, filter_column, role_name, allowed_value)
);

-- 5. Audit change log
CREATE TABLE IF NOT EXISTS GOVERNANCE_DB.AUDIT.CHANGE_LOG (
  TS              TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  "USER"          VARCHAR,
  ROLE            VARCHAR,
  SESSION_ID      VARCHAR,
  CHANGE_TYPE     VARCHAR       NOT NULL,
  OBJECT_FQN      VARCHAR,
  SQL             VARCHAR(16777216),
  BEFORE          VARIANT,
  AFTER           VARIANT,
  STATUS          VARCHAR       NOT NULL DEFAULT 'success',
  ERROR           VARCHAR
);

-- 5. Grants to GOVERNANCE_ADMIN
GRANT OWNERSHIP ON DATABASE GOVERNANCE_DB TO ROLE GOVERNANCE_ADMIN COPY CURRENT GRANTS;
GRANT OWNERSHIP ON SCHEMA GOVERNANCE_DB.PUBLIC TO ROLE GOVERNANCE_ADMIN COPY CURRENT GRANTS;
GRANT OWNERSHIP ON SCHEMA GOVERNANCE_DB.AUDIT TO ROLE GOVERNANCE_ADMIN COPY CURRENT GRANTS;
GRANT OWNERSHIP ON ALL TABLES IN SCHEMA GOVERNANCE_DB.PUBLIC TO ROLE GOVERNANCE_ADMIN COPY CURRENT GRANTS;
GRANT OWNERSHIP ON ALL TABLES IN SCHEMA GOVERNANCE_DB.AUDIT TO ROLE GOVERNANCE_ADMIN COPY CURRENT GRANTS;

-- The app needs to discover metadata across the account
GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE GOVERNANCE_ADMIN;

-- The app needs to manage grants, masking policies, and row access policies
GRANT MANAGE GRANTS ON ACCOUNT TO ROLE GOVERNANCE_ADMIN;
GRANT APPLY MASKING POLICY ON ACCOUNT TO ROLE GOVERNANCE_ADMIN;
GRANT APPLY ROW ACCESS POLICY ON ACCOUNT TO ROLE GOVERNANCE_ADMIN;
GRANT APPLY TAG ON ACCOUNT TO ROLE GOVERNANCE_ADMIN;

-- Allow GOVERNANCE_ADMIN to use a warehouse (adjust name as needed)
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE GOVERNANCE_ADMIN;

-- Grant the role to your user so you can use it locally
-- Replace 'ADMIN' with your username if different
GRANT ROLE GOVERNANCE_ADMIN TO USER ADMIN;

-- =============================================================================
-- Done. You can now start the app with:
--   cd governance-studio
--   cp .env.example .env.local   # edit connection details
--   npm run dev
-- =============================================================================
