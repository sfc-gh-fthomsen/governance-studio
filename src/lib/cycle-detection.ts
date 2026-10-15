import type { RoleGrant } from "@/types/governance";

interface SccState {
  index: number;
  stack: string[];
  onStack: Set<string>;
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  sccs: string[][];
}

export function findCycles(
  roles: string[],
  grants: RoleGrant[]
): { cycles: string[][]; cycleNodes: Set<string> } {
  const adj = new Map<string, string[]>();
  for (const r of roles) adj.set(r, []);
  for (const g of grants) {
    if (g.granted_to === "ROLE") {
      const children = adj.get(g.role) ?? [];
      children.push(g.grantee_name);
      adj.set(g.role, children);
    }
  }

  const state: SccState = {
    index: 0,
    stack: [],
    onStack: new Set(),
    indices: new Map(),
    lowlinks: new Map(),
    sccs: [],
  };

  function strongconnect(v: string) {
    state.indices.set(v, state.index);
    state.lowlinks.set(v, state.index);
    state.index++;
    state.stack.push(v);
    state.onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!state.indices.has(w)) {
        strongconnect(w);
        state.lowlinks.set(
          v,
          Math.min(state.lowlinks.get(v)!, state.lowlinks.get(w)!)
        );
      } else if (state.onStack.has(w)) {
        state.lowlinks.set(
          v,
          Math.min(state.lowlinks.get(v)!, state.indices.get(w)!)
        );
      }
    }

    if (state.lowlinks.get(v) === state.indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = state.stack.pop()!;
        state.onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      if (scc.length > 1) {
        state.sccs.push(scc);
      }
    }
  }

  for (const v of adj.keys()) {
    if (!state.indices.has(v)) {
      strongconnect(v);
    }
  }

  const cycleNodes = new Set<string>();
  for (const scc of state.sccs) {
    for (const n of scc) cycleNodes.add(n);
  }

  return { cycles: state.sccs, cycleNodes };
}
