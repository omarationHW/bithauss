"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Scale,
  BarChart3,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { label: "Usuarios", icon: Users, href: "/admin/usuarios" },
  { label: "Propiedades", icon: Building2, href: "/admin/propiedades" },
  {
    label: "BRC Expedientes",
    icon: ShieldCheck,
    href: "/admin/brc",
  },
  { label: "Membresías", icon: CreditCard, href: "/admin/membresias" },
  { label: "Notarios", icon: Scale, href: "/admin/notarios" },
  { label: "Reportes", icon: BarChart3, href: "/admin/reportes" },
  { label: "Configuración", icon: Settings, href: "/admin/configuracion" },
];

interface AdminSidebarProps {
  activeItem?: string;
}

function SidebarContent({ activeItem }: AdminSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar-background text-sidebar-foreground">
      {/* Logo + Admin Badge */}
      <div className="flex items-center gap-2 px-6 py-5">
        <Link href="/admin" className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-sidebar-primary" />
          <span className="text-xl font-bold text-sidebar-foreground">
            BitHauss
          </span>
          <Badge className="bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/30 border-red-500/30">
            Admin
          </Badge>
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Admin User Info */}
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-sm font-semibold text-red-400">
          AR
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-sidebar-foreground">
            Administrador
          </span>
          <Badge className="mt-0.5 w-fit bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/30 border-red-500/30">
            Super Admin
          </Badge>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeItem === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Logout */}
      <div className="px-3 pb-4">
        <Separator className="mb-4 bg-sidebar-border" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}

export function AdminSidebar({ activeItem }: AdminSidebarProps) {
  return (
    <>
      {/* Desktop Sidebar - fixed */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 lg:block">
        <SidebarContent activeItem={activeItem} />
      </aside>

      {/* Mobile Sidebar - Sheet */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Menú de administración</SheetTitle>
            <SidebarContent activeItem={activeItem} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
