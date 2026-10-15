"use client";

import { useSession } from "@/lib/api-client";
import { useStagingStore } from "@/store/staging";
import { Badge } from "@/components/ui/badge";
import { ReviewDrawer } from "@/components/layout/review-drawer";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, ShieldCheck, Warehouse, LogOut } from "lucide-react";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppHeader() {
  const router = useRouter();
  const { data: session } = useSession();
  const { changes, mode, setMode } = useStagingStore();
  const pendingCount = changes.filter((c) => c.status === "pending").length;

  return (
    <>
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-teal-400" />
      <header className="flex h-13 items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />

      {session && (
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">
            <User className="h-3.5 w-3.5" />
            {session.currentUser}
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {session.currentRole}
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 text-teal-700">
            <Warehouse className="h-3.5 w-3.5" />
            {session.currentWarehouse || "\u2014"}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        <Select value={mode} onValueChange={(v) => setMode(v as "live" | "dry-run")}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dry-run">Dry Run</SelectItem>
            <SelectItem value="live">Live</SelectItem>
          </SelectContent>
        </Select>

        {pendingCount > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {pendingCount} change{pendingCount !== 1 ? "s" : ""}
          </Badge>
        )}

        <ReviewDrawer />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  await fetch("/api/connection/configure", { method: "DELETE" });
                  router.push("/setup");
                }}
              />
            }
          >
            <LogOut className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
        </Tooltip>
      </div>
    </header>
    </>
  );
}
