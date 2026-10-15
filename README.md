# Governance & RBAC Studio

A full-stack web application for managing Snowflake data governance — users, roles, masking policies, tag-based security, and row-level security — from a single interactive interface.

Built with Next.js, React, Tailwind CSS, shadcn/ui, AG Grid, and React Flow.

![Role Hierarchy DAG](docs/screenshots/role-hierarchy.png)

## Features

- **Role Hierarchy DAG** — Interactive graph visualization of role-to-role grants with automatic cycle detection (Tarjan SCC), search, zoom, and minimap
- **Data Catalog** — Lazy-loading browser for databases, schemas, tables, and columns
- **Row-Level Security** — Map roles to allowed column values (e.g., SALES_US sees `REGION = 'US'`). Generates the mapping table, row access policy, and ALTER TABLE DDL
- **RBAC / Masking Matrix** — Excel-style AG Grid where rows are entities and columns are roles. Assign access rules (FULL_ACCESS, NO_ACCESS) and masking policies (email, partial, hash, null) per cell
- **Tag Governance** — View tags, attached masking policies, tagged objects, and detect conflicts (direct vs. tag-based policies, multiple tags with policies, inherited overlaps)
- **What-If Simulator** — Select a role to see its effective privileges (transitive closure), inherited role chain, and active policies on accessible tables
- **Audit Log** — Filterable history of all governance changes with SQL, before/after diffs, and session metadata
- **Review & Apply Drawer** — Staged changes with guardrails (blocks REVOKE from system roles, warns on self-lockout), copy SQL, export `.sql`, and live or dry-run execution
- **Setup Wizard** — First-run configuration screen for account locator, credentials (key-pair or password), role, warehouse, and database. No credentials stored in code.

## Prerequisites

- **Node.js** 18+ and npm
- **Snowflake account** with ACCOUNTADMIN (or a role with MANAGE GRANTS, APPLY MASKING POLICY, APPLY ROW ACCESS POLICY, APPLY TAG)
- **Key-pair authentication** (recommended) or password authentication configured for your Snowflake user

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/sfc-gh-fthomsen/governance-studio.git
cd governance-studio

# 2. Install dependencies
npm install

# 3. Run the setup SQL in your Snowflake account (as ACCOUNTADMIN)
#    This creates the GOVERNANCE_ADMIN role, GOVERNANCE_DB database,
#    mapping tables, and audit log table.
#    Open deploy/setup.sql in Snowsight and execute it.

# 4. Start the app
npm run dev

# 5. Open http://localhost:3000
#    The setup wizard will guide you through connecting to your Snowflake account.
```

## Setup SQL

Before using the app, run [`deploy/setup.sql`](deploy/setup.sql) in your Snowflake account. It creates:

| Object | Purpose |
|---|---|
| `GOVERNANCE_ADMIN` role | Service role for the app |
| `GOVERNANCE_DB` database | Stores mapping tables and audit logs |
| `GOVERNANCE_DB.PUBLIC.RLS_MAPPING` | Legacy condition-based RLS mappings |
| `GOVERNANCE_DB.PUBLIC.RLS_VALUE_MAPPING` | Value-based RLS mappings (role -> allowed column values) |
| `GOVERNANCE_DB.AUDIT.CHANGE_LOG` | Audit trail for all governance changes |

The script also grants the necessary privileges (MANAGE GRANTS, APPLY MASKING POLICY, APPLY ROW ACCESS POLICY, APPLY TAG, IMPORTED PRIVILEGES on SNOWFLAKE) to `GOVERNANCE_ADMIN`.

## Authentication

The setup wizard supports two authentication methods:

### Key-Pair (Recommended)

1. Generate an RSA key pair if you don't have one:
   ```bash
   openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -nocrypt
   openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
   ```

2. Register the public key with your Snowflake user:
   ```sql
   ALTER USER your_username SET RSA_PUBLIC_KEY='MIIBIjAN...';
   ```

3. In the setup wizard, select "Key-Pair" and enter the absolute path to your `.p8` file.

### Password

Select "Password" in the setup wizard and enter your Snowflake password. The password is stored in `~/.governance-studio/config.json` on your machine (never in the application code).

## Configuration

All connection details are stored at `~/.governance-studio/config.json` (created by the setup wizard). This file is:
- Outside the project directory — never committed to git
- Owner-only readable (0600 permissions)
- Deletable via the Disconnect button in the app header

For advanced users, environment variables can override the config file. See [`.env.example`](.env.example).

## Project Structure

```
governance-studio/
├── deploy/
│   └── setup.sql              # Snowflake setup script
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # All dashboard pages (gated by connection check)
│   │   │   ├── roles/         # Role Hierarchy DAG
│   │   │   ├── catalog/       # Data Catalog browser
│   │   │   ├── rls/           # Row-Level Security editor
│   │   │   ├── matrix/        # RBAC / Masking grid
│   │   │   ├── tags/          # Tag Governance
│   │   │   ├── simulator/     # What-If Simulator
│   │   │   ├── audit/         # Audit Log
│   │   │   └── deploy/        # Deployment config
│   │   ├── setup/             # First-run setup wizard
│   │   └── api/               # Server-side API routes
│   │       ├── connection/    # Status, configure, test
│   │       ├── users/         # SHOW USERS
│   │       ├── roles/         # SHOW ROLES
│   │       ├── grants/        # SHOW GRANTS (by role, user, database)
│   │       ├── catalog/       # Lazy catalog (databases, schemas, tables, columns)
│   │       ├── policies/      # Masking, row access, tags, references
│   │       ├── rls/           # RLS value mapping CRUD
│   │       ├── execute/       # DDL execution (live or dry-run)
│   │       ├── simulate/      # Role privilege simulation
│   │       ├── audit/         # Audit log read/write
│   │       └── session/       # Current user, role, warehouse
│   ├── components/
│   │   ├── layout/            # App shell, sidebar, header, review drawer
│   │   ├── dag/               # Role hierarchy DAG (React Flow)
│   │   ├── catalog/           # Catalog browser
│   │   ├── rls/               # RLS editor (value-based)
│   │   ├── matrix/            # AG Grid policy matrix
│   │   ├── policies/          # Tag governance
│   │   ├── simulator/         # What-If simulator
│   │   ├── audit/             # Audit log viewer
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── snowflake/         # Snowflake connection client
│   │   ├── ddl/               # DDL generator (grants, masking, RLS)
│   │   ├── config.ts          # Config file manager
│   │   ├── sql-utils.ts       # Safe identifier quoting
│   │   ├── api-helpers.ts     # API route helpers
│   │   ├── api-client.ts      # Client-side hooks (TanStack Query)
│   │   ├── cycle-detection.ts # Tarjan SCC for role graph
│   │   ├── conflict-detection.ts # Tag policy conflict detection
│   │   └── guardrails.ts      # Safety checks for DDL execution
│   ├── store/
│   │   └── staging.ts         # Zustand store for staged changes
│   └── types/
│       └── governance.ts      # Shared TypeScript types
└── .env.example               # Optional env var overrides
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4, shadcn/ui (base-ui variant) |
| Data Grid | AG Grid Community |
| Graph Visualization | React Flow + dagre |
| State Management | Zustand (staging), TanStack Query (server state) |
| Snowflake SDK | snowflake-sdk (Node.js, server-side only) |

## Execution Modes

- **Dry Run** (default) — Changes are staged and previewed as SQL. Nothing is executed against Snowflake.
- **Live** — Changes are executed sequentially against Snowflake, with per-statement status reporting.

Toggle between modes using the dropdown in the header.

## Guardrails

The Review & Apply drawer includes safety checks:
- **Blocked**: REVOKE from system roles (ACCOUNTADMIN, SECURITYADMIN, SYSADMIN, ORGADMIN, USERADMIN)
- **Confirmation required**: REVOKE from your current role or user
- **Warning**: Row access policies that don't reference CURRENT_ROLE()

## License

MIT
