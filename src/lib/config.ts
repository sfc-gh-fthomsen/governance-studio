import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".governance-studio");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface AppConfig {
  account: string;
  username: string;
  authMethod: "key-pair" | "password";
  privateKeyPath?: string;
  privateKeyPass?: string;
  password?: string;
  role: string;
  warehouse: string;
  database: string;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export async function readConfig(): Promise<AppConfig | null> {
  try {
    if (!existsSync(CONFIG_FILE)) return null;
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(config: AppConfig): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600, // owner-only read/write
  });
}

export async function deleteConfig(): Promise<void> {
  try {
    if (existsSync(CONFIG_FILE)) {
      await unlink(CONFIG_FILE);
    }
  } catch {
    // Already gone
  }
}

/**
 * Return a sanitized version of the config safe to send to the browser.
 * Never includes password or key passphrase.
 */
export function sanitizeConfig(
  config: AppConfig
): Omit<AppConfig, "password" | "privateKeyPass"> & {
  hasPassword: boolean;
  hasKeyPath: boolean;
} {
  return {
    account: config.account,
    username: config.username,
    authMethod: config.authMethod,
    role: config.role,
    warehouse: config.warehouse,
    database: config.database,
    privateKeyPath: config.privateKeyPath,
    hasPassword: !!config.password,
    hasKeyPath: !!config.privateKeyPath,
  };
}
