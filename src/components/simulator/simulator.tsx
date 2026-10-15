"use client";

import { useState } from "react";
import { useRoles } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Eye,
  Shield,
  ShieldCheck,
  Database,
  Lock,
  Loader2,
} from "lucide-react";

interface SimulationResult {
  role: string;
  inheritedRoles: string[];
  privileges: {
    privilege: string;
    granted_on: string;
    name: string;
    granted_to: string;
    grant_option: boolean;
  }[];
  totalPrivileges: number;
  policies: {
    policy_name: string;
    policy_kind: string;
    policy_db: string;
    policy_schema: string;
    ref_entity_name: string;
    ref_column_name: string | null;
    ref_database_name: string;
    ref_schema_name: string;
  }[];
}

export function Simulator() {
  const { data: roles } = useRoles();
  const [selectedRole, setSelectedRole] = useState<string>("");

  const {
    data: simulation,
    isLoading,
    refetch,
  } = useQuery<SimulationResult>({
    queryKey: ["simulate", selectedRole],
    queryFn: async () => {
      const res = await fetch(
        `/api/simulate?role=${encodeURIComponent(selectedRole)}`
      );
      if (!res.ok) throw new Error("Simulation failed");
      return res.json();
    },
    enabled: !!selectedRole,
  });

  // Group privileges by type
  const groupedPrivs = simulation?.privileges.reduce(
    (acc, p) => {
      const key = String(p.granted_on ?? "OTHER");
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {} as Record<string, typeof simulation.privileges>
  );

  const activePolicies = simulation?.policies ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Role selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Impersonate role:</span>
        </div>
        <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v ?? "")}>
          <SelectTrigger className="w-[250px] h-8 text-xs">
            <SelectValue placeholder="Select a role to simulate" />
          </SelectTrigger>
          <SelectContent>
            {roles?.map((r) => (
              <SelectItem key={r.name} value={r.name}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRole && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        )}
      </div>

      {!selectedRole && (
        <div className="flex items-center justify-center h-64 rounded-lg border border-dashed text-sm text-muted-foreground">
          Select a role to see its effective permissions
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Simulating...
        </div>
      )}

      {simulation && !isLoading && (
        <>
          {/* Summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="default" className="text-xs">
              <ShieldCheck className="h-3 w-3 mr-1" />
              {simulation.role}
            </Badge>
            <Badge variant="secondary">
              {simulation.inheritedRoles.length} inherited role
              {simulation.inheritedRoles.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline">
              {simulation.totalPrivileges} total privileges
            </Badge>
            <Badge variant="outline">
              {activePolicies.length} active policies
            </Badge>
          </div>

          <Tabs defaultValue="privileges">
            <TabsList>
              <TabsTrigger value="privileges">Privileges</TabsTrigger>
              <TabsTrigger value="roles">Role Hierarchy</TabsTrigger>
              <TabsTrigger value="policies">Active Policies</TabsTrigger>
            </TabsList>

            <TabsContent value="privileges" className="mt-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {groupedPrivs &&
                    Object.entries(groupedPrivs)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([objectType, privs]) => (
                        <div key={objectType}>
                          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                            <Database className="h-3.5 w-3.5" />
                            {objectType}
                            <Badge variant="secondary" className="text-xs">
                              {privs.length}
                            </Badge>
                          </h4>
                          <div className="space-y-0.5 ml-5">
                            {privs.map((p, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs py-0.5"
                              >
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0 w-28 justify-center"
                                >
                                  {String(p.privilege)}
                                </Badge>
                                <span className="truncate text-muted-foreground">
                                  {String(p.name)}
                                </span>
                                {p.grant_option && (
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    WITH GRANT
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                          <Separator className="mt-3" />
                        </div>
                      ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="roles" className="mt-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {simulation.inheritedRoles.map((r) => (
                    <div
                      key={r}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                    >
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{r}</span>
                      {r === simulation.role && (
                        <Badge variant="default" className="text-xs">
                          selected
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="policies" className="mt-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {activePolicies.length > 0 ? (
                    activePolicies.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                      >
                        <Lock className="h-4 w-4 text-yellow-500" />
                        <Badge variant="outline" className="text-xs">
                          {p.policy_kind}
                        </Badge>
                        <span className="font-medium">
                          {p.policy_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.policy_db}.{p.policy_schema}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          on {p.ref_database_name}.{p.ref_schema_name}.{p.ref_entity_name}
                          {p.ref_column_name ? `.${p.ref_column_name}` : ""}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No policies found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
