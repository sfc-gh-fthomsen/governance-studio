"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Network,
  Database,
  Grid3X3,
  Filter,
  Tag,
  Eye,
  History,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Shield } from "lucide-react";

const navItems = [
  { label: "Role Hierarchy", href: "/roles", icon: Network },
  { label: "Data Catalog", href: "/catalog", icon: Database },
  { label: "Row-Level Security", href: "/rls", icon: Filter },
  { label: "RBAC / Masking", href: "/matrix", icon: Grid3X3 },
  { label: "Tag Governance", href: "/tags", icon: Tag },
  { label: "Simulator", href: "/simulator", icon: Eye },
  { label: "Audit Log", href: "/audit", icon: History },
  { label: "Deployment", href: "/deploy", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-sm">
            <Shield className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm tracking-tight">Governance Studio</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
