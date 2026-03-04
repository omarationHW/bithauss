"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Bell,
  ChevronDown,
  User,
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

function SidebarContent({ activeItem }: { activeItem: string }) {
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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 lg:block">
        <SidebarContent activeItem={pathname} />
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Menú de administración</SheetTitle>
              <SidebarContent activeItem={pathname} />
            </SheetContent>
          </Sheet>

          {/* Page Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Panel de Administración</h1>
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/30">
              Admin
            </Badge>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              <span className="sr-only">Notificaciones</span>
            </Button>

            {/* Admin User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-xs font-semibold text-red-500">
                    AR
                  </div>
                  <span className="hidden text-sm font-medium md:inline-block">
                    Admin
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Administrador</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Mi Perfil
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
