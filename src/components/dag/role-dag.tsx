"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { useRoles } from "@/lib/api-client";
import { findCycles } from "@/lib/cycle-detection";
import type { RoleGrant, SnowflakeRole } from "@/types/governance";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search } from "lucide-react";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;

function buildGraph(
  roles: SnowflakeRole[],
  allGrants: RoleGrant[],
  cycleNodes: Set<string>,
  search: string
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  const lowerSearch = search.toLowerCase();

  for (const role of roles) {
    g.setNode(role.name, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const grant of allGrants) {
    if (grant.granted_to === "ROLE") {
      g.setEdge(grant.role, grant.grantee_name);
    }
  }

  dagre.layout(g);

  const nodes: Node[] = roles.map((role) => {
    const pos = g.node(role.name);
    const inCycle = cycleNodes.has(role.name);
    const matchesSearch =
      !search || role.name.toLowerCase().includes(lowerSearch);

    return {
      id: role.name,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { label: role.name },
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        background: inCycle
          ? "hsl(0 84% 60%)"
          : matchesSearch && search
            ? "hsl(217 91% 60%)"
            : undefined,
        color: inCycle || (matchesSearch && search) ? "white" : undefined,
        opacity: search && !matchesSearch ? 0.3 : 1,
        borderRadius: 8,
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    };
  });

  const edges: Edge[] = allGrants
    .filter((g) => g.granted_to === "ROLE")
    .map((g) => ({
      id: `${g.role}->${g.grantee_name}`,
      source: g.role,
      target: g.grantee_name,
      animated: cycleNodes.has(g.role) && cycleNodes.has(g.grantee_name),
      style: {
        stroke:
          cycleNodes.has(g.role) && cycleNodes.has(g.grantee_name)
            ? "hsl(0 84% 60%)"
            : undefined,
      },
    }));

  return { nodes, edges };
}

export function RoleDag() {
  const { data: roles, isLoading, error } = useRoles();
  const [search, setSearch] = useState("");
  const [allGrants, setAllGrants] = useState<RoleGrant[]>([]);
  const [grantsLoaded, setGrantsLoaded] = useState(false);

  // Fetch grants for all roles once roles are loaded
  const fetchAllGrants = useCallback(async () => {
    if (!roles || grantsLoaded) return;
    try {
      const results = await Promise.all(
        roles.map(async (r) => {
          const res = await fetch(
            `/api/grants/role/${encodeURIComponent(r.name)}`
          );
          if (!res.ok) return [];
          return res.json() as Promise<RoleGrant[]>;
        })
      );
      setAllGrants(results.flat());
      setGrantsLoaded(true);
    } catch (e) {
      console.error("Failed to load grants", e);
    }
  }, [roles, grantsLoaded]);

  // Trigger grant loading
  useMemo(() => {
    fetchAllGrants();
  }, [fetchAllGrants]);

  const { cycles, cycleNodes } = useMemo(() => {
    if (!roles) return { cycles: [], cycleNodes: new Set<string>() };
    return findCycles(
      roles.map((r) => r.name),
      allGrants
    );
  }, [roles, allGrants]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!roles) return { nodes: [], edges: [] };
    return buildGraph(roles, allGrants, cycleNodes, search);
  }, [roles, allGrants, cycleNodes, search]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Loading roles...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-destructive">
        Failed to load roles: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Badge variant="outline">{roles?.length ?? 0} roles</Badge>
        <Badge variant="outline">
          {allGrants.filter((g) => g.granted_to === "ROLE").length} edges
        </Badge>
        {cycles.length > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {cycles.length} cycle{cycles.length !== 1 ? "s" : ""} detected
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-[600px] rounded-lg border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
