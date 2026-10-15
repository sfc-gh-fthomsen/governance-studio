"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle, XCircle, Loader2, KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AuthMethod = "key-pair" | "password";
type TestState = "idle" | "testing" | "success" | "error";

export default function SetupPage() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("key-pair");
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [privateKeyPass, setPrivateKeyPass] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ACCOUNTADMIN");
  const [warehouse, setWarehouse] = useState("COMPUTE_WH");
  const [database, setDatabase] = useState("GOVERNANCE_DB");

  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function getFormData() {
    return {
      account,
      username,
      authMethod,
      privateKeyPath: authMethod === "key-pair" ? privateKeyPath : undefined,
      privateKeyPass: authMethod === "key-pair" ? privateKeyPass : undefined,
      password: authMethod === "password" ? password : undefined,
      role,
      warehouse,
      database,
    };
  }

  async function handleTest() {
    setTestState("testing");
    setTestError("");
    try {
      const res = await fetch("/api/connection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getFormData()),
      });
      const data = await res.json();
      if (data.ok) {
        setTestState("success");
      } else {
        setTestState("error");
        setTestError(data.error || "Connection failed");
      }
    } catch (err: unknown) {
      setTestState("error");
      setTestError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/connection/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getFormData()),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/roles");
      } else {
        setSaveError(data.error || "Failed to save");
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const isValid =
    account.trim() !== "" &&
    username.trim() !== "" &&
    (authMethod === "key-pair" ? privateKeyPath.trim() !== "" : password.trim() !== "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Governance Studio
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Connect to your Snowflake account to manage users, roles, policies,
            and row-level security.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="account">Account Locator</Label>
            <Input
              id="account"
              placeholder="e.g. MYORG-MYACCOUNT"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Found in Snowsight under Admin &gt; Accounts, or in your Snowflake URL
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="e.g. ADMIN"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Authentication Method</Label>
            <Select
              value={authMethod}
              onValueChange={(v) => {
                if (v) setAuthMethod(v as AuthMethod);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="key-pair">
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5" /> Key-Pair (recommended)
                  </span>
                </SelectItem>
                <SelectItem value="password">
                  <span className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> Password
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authMethod === "key-pair" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="keyPath">Private Key File Path</Label>
                <Input
                  id="keyPath"
                  placeholder="e.g. /Users/you/.snowflake/rsa_key.p8"
                  value={privateKeyPath}
                  onChange={(e) => setPrivateKeyPath(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Absolute path to the .p8 file on this machine
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="keyPass">Key Passphrase (if encrypted)</Label>
                <Input
                  id="keyPass"
                  type="password"
                  placeholder="Leave blank if unencrypted"
                  value={privateKeyPass}
                  onChange={(e) => setPrivateKeyPass(e.target.value)}
                />
              </div>
            </>
          )}

          {authMethod === "password" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Stored locally on this machine only, never in the codebase
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Input
                id="warehouse"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
              />
            </div>
          </div>

          {/* Test result */}
          {testState === "success" && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              Connection successful
            </div>
          )}
          {testState === "error" && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{testError}</span>
            </div>
          )}
          {saveError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!isValid || testState === "testing"}
              className="flex-1"
            >
              {testState === "testing" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Test Connection
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save & Connect
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Credentials are stored at ~/.governance-studio/config.json on this
          machine. Nothing is saved in the application code.
        </p>
      </div>
    </div>
  );
}
